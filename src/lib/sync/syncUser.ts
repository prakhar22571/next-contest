import { prisma } from "@/lib/prisma";
import { fetchContests } from "@/lib/clist/client";
import { platformName } from "@/lib/clist/platforms";
import { getAuthorizedClient, createContestEvent } from "@/lib/google/calendar";
import type { ClistContest } from "@/lib/clist/types";
import type { SyncTrigger } from "@prisma/client";

const MS_PER_DAY = 86_400_000;

export interface SyncResult {
  found: number;
  created: number;
  failed: number;
}

export async function syncUserContests(
  userId: string,
  trigger: SyncTrigger,
  contestsOverride?: ClistContest[]
): Promise<SyncResult | null> {
  const pref = await prisma.userPreference.findUnique({ where: { userId } });
  if (!pref || pref.platforms.length === 0) return null;

  const credential = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!credential) return null;

  const run = await prisma.syncRun.create({ data: { userId, trigger } });

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + pref.daysAhead * MS_PER_DAY);

    const contests = contestsOverride
      ? contestsOverride.filter(
          (c) => pref.platforms.includes(c.resource) && new Date(c.start) <= windowEnd
        )
      : await fetchContests({ resources: pref.platforms, startGte: now, startLte: windowEnd });

    const existing = await prisma.syncedContest.findMany({
      where: { userId, contestId: { in: contests.map((c) => String(c.id)) } },
    });
    const alreadySucceeded = new Set(
      existing.filter((e) => e.status === "SUCCESS").map((e) => e.contestId)
    );
    const toProcess = contests.filter((c) => !alreadySucceeded.has(String(c.id)));

    let created = 0;
    let failed = 0;

    if (toProcess.length > 0) {
      const authClient = await getAuthorizedClient(userId);

      for (const contest of toProcess) {
        try {
          const event = await createContestEvent(
            authClient,
            contest,
            platformName(contest.resource),
            pref.timeZone
          );
          await prisma.syncedContest.upsert({
            where: { userId_contestId: { userId, contestId: String(contest.id) } },
            create: {
              userId,
              contestId: String(contest.id),
              platform: contest.resource,
              title: contest.event,
              startTime: new Date(contest.start),
              endTime: new Date(contest.end),
              contestUrl: contest.href,
              calendarEventId: event.id,
              status: "SUCCESS",
            },
            update: {
              calendarEventId: event.id,
              status: "SUCCESS",
              errorMessage: null,
              syncedAt: new Date(),
            },
          });
          created++;
        } catch (err) {
          failed++;
          // Per-contest failure doesn't stop the rest of the batch.
          await prisma.syncedContest.upsert({
            where: { userId_contestId: { userId, contestId: String(contest.id) } },
            create: {
              userId,
              contestId: String(contest.id),
              platform: contest.resource,
              title: contest.event,
              startTime: new Date(contest.start),
              endTime: new Date(contest.end),
              contestUrl: contest.href,
              status: "FAILED",
              errorMessage: String(err instanceof Error ? err.message : err),
            },
            update: {
              status: "FAILED",
              errorMessage: String(err instanceof Error ? err.message : err),
              syncedAt: new Date(),
            },
          });
        }
      }
    }

    await prisma.$transaction([
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          contestsFound: contests.length,
          contestsCreated: created,
          contestsFailed: failed,
        },
      }),
      prisma.userPreference.update({ where: { userId }, data: { lastSyncedAt: new Date() } }),
    ]);

    return { found: contests.length, created, failed };
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: String(err instanceof Error ? err.message : err),
      },
    });
    throw err;
  }
}

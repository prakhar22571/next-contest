import type { SyncTrigger, UserPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { errorMessage, DAY_MS } from "@/lib/util";
import { authorizedClientFor, createContestEvent } from "@/lib/google/calendar";
import type { Contest } from "@/lib/contests/types";

export interface SyncResult {
  found: number;
  created: number;
  failed: number;
}

type Outcome =
  | { status: "SUCCESS"; calendarEventId: string | null }
  | { status: "FAILED"; errorMessage: string };

// Narrow a batch of contests to the ones this user actually wants: their
// selected platforms, starting within their look-ahead window.
export function contestsForPreference(
  contests: Contest[],
  pref: Pick<UserPreference, "platforms" | "daysAhead">
): Contest[] {
  const cutoff = Date.now() + pref.daysAhead * DAY_MS;
  return contests.filter(
    (c) => pref.platforms.includes(c.resource) && new Date(c.start).getTime() <= cutoff
  );
}

async function syncedContestIds(userId: string, contests: Contest[]): Promise<Set<string>> {
  if (contests.length === 0) return new Set();
  const rows = await prisma.syncedContest.findMany({
    where: {
      userId,
      status: { in: ["SUCCESS", "DELETED"] },
      contestId: { in: contests.map((c) => c.id) },
    },
    select: { contestId: true },
  });
  return new Set(rows.map((r) => r.contestId));
}

function recordContest(userId: string, c: Contest, outcome: Outcome) {
  const identity = {
    userId,
    contestId: c.id,
    platform: c.resource,
    title: c.event,
    startTime: new Date(c.start),
    endTime: new Date(c.end),
    contestUrl: c.href,
  };
  const state =
    outcome.status === "SUCCESS"
      ? { status: "SUCCESS" as const, calendarEventId: outcome.calendarEventId, errorMessage: null }
      : { status: "FAILED" as const, errorMessage: outcome.errorMessage };

  return prisma.syncedContest.upsert({
    where: { userId_contestId: { userId, contestId: c.id } },
    create: { ...identity, ...state },
    update: { ...state, syncedAt: new Date() },
  });
}

// Wraps `work` in a SyncRun row: records SUCCESS + bumps lastSyncedAt, or marks
// the run FAILED and rethrows.
async function withSyncRun(
  userId: string,
  trigger: SyncTrigger,
  work: () => Promise<SyncResult>
): Promise<SyncResult> {
  const run = await prisma.syncRun.create({ data: { userId, trigger } });
  try {
    const result = await work();
    await prisma.$transaction([
      prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          contestsFound: result.found,
          contestsCreated: result.created,
          contestsFailed: result.failed,
        },
      }),
      prisma.userPreference.update({ where: { userId }, data: { lastSyncedAt: new Date() } }),
    ]);
    return result;
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: errorMessage(err) },
    });
    throw err;
  }
}

// Syncs one user against a batch of already-fetched contests: create a calendar
// event for each new one, skip those already synced or removed, retry past failures. A
// per-contest failure is recorded and doesn't stop the batch. Returns null if
// the user has nothing configured.
export async function syncUserContests(
  userId: string,
  trigger: SyncTrigger,
  contests: Contest[]
): Promise<SyncResult | null> {
  const [pref, credential] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.googleCredential.findUnique({ where: { userId } }),
  ]);
  if (!pref || pref.platforms.length === 0 || !credential) return null;

  return withSyncRun(userId, trigger, async () => {
    const scoped = contestsForPreference(contests, pref);
    const done = await syncedContestIds(userId, scoped);
    const todo = scoped.filter((c) => !done.has(c.id));

    let created = 0;
    let failed = 0;

    if (todo.length > 0) {
      const client = authorizedClientFor(userId, credential.encryptedRefreshToken);
      for (const contest of todo) {
        try {
          const event = await createContestEvent(client, contest, pref.timeZone);
          await recordContest(userId, contest, {
            status: "SUCCESS",
            calendarEventId: event.id ?? null,
          });
          created++;
        } catch (err) {
          await recordContest(userId, contest, { status: "FAILED", errorMessage: errorMessage(err) });
          failed++;
        }
      }
    }

    return { found: scoped.length, created, failed };
  });
}

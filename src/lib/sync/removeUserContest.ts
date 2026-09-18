import { prisma } from "@/lib/prisma";
import { authorizedClientFor, deleteContestEvent } from "@/lib/google/calendar";
import { isValidPlatformSlug } from "@/lib/contests/platforms";
import { errorMessage } from "@/lib/util";

type RemovalResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

async function removeOwnedEvent(
  userId: string,
  client: ReturnType<typeof authorizedClientFor>,
  contest: { id: string; calendarEventId: string }
) {
  await deleteContestEvent(client, contest.calendarEventId);
  // Keep an exclusion for future syncs. A failed write can safely be retried.
  await prisma.syncedContest.update({
    where: { id: contest.id, userId },
    data: { status: "DELETED", errorMessage: null },
  });
}

export async function removeUserContest(userId: string, id: string): Promise<RemovalResult> {
  // Resolve the calendar event from an owned record, never from client input.
  const contest = await prisma.syncedContest.findFirst({ where: { id, userId } });
  if (!contest) return { ok: false, status: 404, error: "Contest not found." };
  if (contest.status === "DELETED") return { ok: true };
  if (contest.status !== "SUCCESS" || !contest.calendarEventId) {
    return { ok: false, status: 409, error: "This contest has no synced calendar event to remove." };
  }

  const credential = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!credential) {
    return { ok: false, status: 409, error: "Sign out and sign in with Google again to reconnect your calendar." };
  }

  const client = authorizedClientFor(userId, credential.encryptedRefreshToken);
  await removeOwnedEvent(userId, client, { id, calendarEventId: contest.calendarEventId });
  return { ok: true };
}

type PlatformRemovalResult =
  | { ok: true; removed: number; failed: number }
  | { ok: false; status: number; error: string };

export async function removeUserPlatformContests(
  userId: string,
  platform: string
): Promise<PlatformRemovalResult> {
  if (!isValidPlatformSlug(platform)) {
    return { ok: false, status: 400, error: "Unknown contest platform." };
  }

  // Query all upcoming events, independently of the dashboard's display limit
  // or the user's current platform and look-ahead preferences.
  const contests = await prisma.syncedContest.findMany({
    where: {
      userId, platform, status: "SUCCESS",
      startTime: { gte: new Date() }, calendarEventId: { not: null },
    },
    select: { id: true, calendarEventId: true },
  });
  if (contests.length === 0) return { ok: true, removed: 0, failed: 0 };

  const credential = await prisma.googleCredential.findUnique({ where: { userId } });
  if (!credential) {
    return { ok: false, status: 409, error: "Sign out and sign in with Google again to reconnect your calendar." };
  }
  const client = authorizedClientFor(userId, credential.encryptedRefreshToken);
  let removed = 0;
  let failed = 0;

  // Limit simultaneous Google requests; one failure must not cancel the rest.
  for (let i = 0; i < contests.length; i += 3) {
    const results = await Promise.allSettled(contests.slice(i, i + 3).map((contest) =>
      removeOwnedEvent(userId, client, { id: contest.id, calendarEventId: contest.calendarEventId! })
    ));
    for (const result of results) {
      if (result.status === "fulfilled") removed++;
      else {
        failed++;
        console.error("[calendar] platform event removal failed:", errorMessage(result.reason));
      }
    }
  }
  return { ok: true, removed, failed };
}

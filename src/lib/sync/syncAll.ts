import { prisma } from "@/lib/prisma";
import { daysFromNow } from "@/lib/util";
import { fetchContests } from "@/lib/contests";
import { syncUserContests } from "@/lib/sync/syncUser";

const CONCURRENCY = 4;

export interface SyncAllResult {
  usersProcessed: number;
  usersFailed: number;
}

// Cron entry point. Fetches every platform selected by any user just once, then
// syncs each user from that shared list (`syncUserContests` scopes it to their
// own platforms and window).
export async function syncAllUsers(): Promise<SyncAllResult> {
  const prefs = await prisma.userPreference.findMany({
    where: { platforms: { isEmpty: false }, user: { credential: { isNot: null } } },
    select: { userId: true, platforms: true, daysAhead: true },
  });
  if (prefs.length === 0) return { usersProcessed: 0, usersFailed: 0 };

  const resources = [...new Set(prefs.flatMap((p) => p.platforms))];
  const maxDays = Math.max(...prefs.map((p) => p.daysAhead));
  const contests = await fetchContests({
    resources,
    startGte: new Date(),
    startLte: daysFromNow(maxDays),
  });

  let usersProcessed = 0;
  let usersFailed = 0;
  for (let i = 0; i < prefs.length; i += CONCURRENCY) {
    const outcomes = await Promise.allSettled(
      prefs.slice(i, i + CONCURRENCY).map((p) => syncUserContests(p.userId, "CRON", contests))
    );
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") usersProcessed++;
      else usersFailed++;
    }
  }

  return { usersProcessed, usersFailed };
}

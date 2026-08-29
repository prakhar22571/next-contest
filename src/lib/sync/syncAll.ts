import { prisma } from "@/lib/prisma";
import { fetchContests } from "@/lib/contests/client";
import { syncUserContests } from "@/lib/sync/syncUser";
import type { Contest } from "@/lib/contests/types";

const MS_PER_DAY = 86_400_000;
const CONCURRENCY = 4;
const RESOURCE_FETCH_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SyncAllResult {
  usersProcessed: number;
  usersFailed: number;
}

// Cron entry point. Fetches each distinct platform selected across all users
// just once (instead of once per user) to keep request volume to the platform
// APIs low, then syncs each user from that shared, in-memory contest set.
export async function syncAllUsers(): Promise<SyncAllResult> {
  const prefs = await prisma.userPreference.findMany({
    where: {
      platforms: { isEmpty: false },
      user: { credential: { isNot: null } },
    },
    select: { userId: true, platforms: true, daysAhead: true },
  });
  if (prefs.length === 0) return { usersProcessed: 0, usersFailed: 0 };

  const distinctResources = [...new Set(prefs.flatMap((p) => p.platforms))];
  const maxDays = Math.max(...prefs.map((p) => p.daysAhead));
  const now = new Date();
  const windowEnd = new Date(now.getTime() + maxDays * MS_PER_DAY);

  const contestsByResource = new Map<string, Contest[]>();
  for (const resource of distinctResources) {
    const contests = await fetchContests({ resources: [resource], startGte: now, startLte: windowEnd });
    contestsByResource.set(resource, contests);
    await sleep(RESOURCE_FETCH_DELAY_MS);
  }

  let usersProcessed = 0;
  let usersFailed = 0;

  for (let i = 0; i < prefs.length; i += CONCURRENCY) {
    const batch = prefs.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.allSettled(
      batch.map((p) => {
        const contests = p.platforms.flatMap((slug) => contestsByResource.get(slug) ?? []);
        return syncUserContests(p.userId, "CRON", contests);
      })
    );
    for (const outcome of outcomes) {
      if (outcome.status === "fulfilled") usersProcessed++;
      else usersFailed++;
    }
  }

  return { usersProcessed, usersFailed };
}

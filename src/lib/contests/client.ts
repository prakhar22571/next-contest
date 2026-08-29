import type { Contest } from "./types";
import { fetchCodeforces } from "./sources/codeforces";
import { fetchLeetCode } from "./sources/leetcode";
import { fetchAtCoder } from "./sources/atcoder";
import { fetchCodeChef } from "./sources/codechef";

type SourceFn = () => Promise<Contest[]>;

// Slug -> upcoming-contest fetcher. Keys must match PLATFORM_CATALOG.
const SOURCES: Record<string, SourceFn> = {
  "codeforces.com": fetchCodeforces,
  "leetcode.com": fetchLeetCode,
  "atcoder.jp": fetchAtCoder,
  "codechef.com": fetchCodeChef,
};

export interface FetchContestsParams {
  resources: string[];
  startGte: Date;
  startLte: Date;
}

// Drop-in replacement for the old clist.by client: fetches each requested
// platform directly, in parallel, and returns the union filtered to the window.
// A single platform failing never fails the whole call; if *every* requested
// platform fails we throw, so the caller records a failed sync instead of
// silently treating an outage as "no contests".
export async function fetchContests({
  resources,
  startGte,
  startLte,
}: FetchContestsParams): Promise<Contest[]> {
  const wanted = resources.filter((r) => r in SOURCES);
  if (wanted.length === 0) return [];

  const settled = await Promise.allSettled(wanted.map((r) => SOURCES[r]()));

  const contests: Contest[] = [];
  const errors: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      contests.push(...result.value);
    } else {
      const reason =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${wanted[i]}: ${reason}`);
    }
  });

  if (errors.length === wanted.length) {
    throw new Error(`All contest sources failed - ${errors.join("; ")}`);
  }
  if (errors.length > 0) {
    console.warn(`[contests] partial fetch failure - ${errors.join("; ")}`);
  }

  const gte = startGte.getTime();
  const lte = startLte.getTime();
  return contests
    .filter((c) => {
      const t = new Date(c.start).getTime();
      return t >= gte && t <= lte;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

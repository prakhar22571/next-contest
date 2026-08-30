import type { Contest } from "./types";
import { errorMessage } from "@/lib/util";
import { fetchCodeforces } from "./sources/codeforces";
import { fetchLeetCode } from "./sources/leetcode";
import { fetchAtCoder } from "./sources/atcoder";
import { fetchCodeChef } from "./sources/codechef";

// Slug -> upcoming-contest fetcher. Keys must match PLATFORM_CATALOG.
const SOURCES: Record<string, () => Promise<Contest[]>> = {
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

// Fetches each requested platform directly, in parallel, and returns the union
// filtered to [startGte, startLte] and sorted by start. One platform failing is
// logged and skipped; only every requested platform failing throws, so the
// caller records a failed sync instead of mistaking an outage for "no contests".
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
    if (result.status === "fulfilled") contests.push(...result.value);
    else errors.push(`${wanted[i]}: ${errorMessage(result.reason)}`);
  });

  if (errors.length === wanted.length) {
    throw new Error(`all contest sources failed - ${errors.join("; ")}`);
  }
  if (errors.length > 0) console.warn(`[contests] partial fetch failure - ${errors.join("; ")}`);

  const gte = startGte.getTime();
  const lte = startLte.getTime();
  return contests
    .filter((c) => {
      const t = new Date(c.start).getTime();
      return t >= gte && t <= lte;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

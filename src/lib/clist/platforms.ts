// clist.by "resource" slugs -> display names for platforms we support in the UI.
// https://clist.by/api/v4/resource/ lists all resources; these are the common
// competitive-programming ones surfaced in the dashboard.
export const PLATFORM_CATALOG = [
  { slug: "codeforces.com", name: "Codeforces" },
  { slug: "leetcode.com", name: "LeetCode" },
  { slug: "atcoder.jp", name: "AtCoder" },
  { slug: "codechef.com", name: "CodeChef" },
  { slug: "hackerrank.com", name: "HackerRank" },
  { slug: "codingcompetitions.withgoogle.com", name: "Google Code Jam / Kick Start" },
  { slug: "topcoder.com", name: "TopCoder" },
] as const;

export type PlatformSlug = (typeof PLATFORM_CATALOG)[number]["slug"];

const SLUG_SET = new Set<string>(PLATFORM_CATALOG.map((p) => p.slug));

export function isValidPlatformSlug(slug: string): slug is PlatformSlug {
  return SLUG_SET.has(slug);
}

export function platformName(slug: string): string {
  return PLATFORM_CATALOG.find((p) => p.slug === slug)?.name ?? slug;
}

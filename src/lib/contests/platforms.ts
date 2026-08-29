// Platforms surfaced in the dashboard. Each slug has a matching source module in
// ./sources and an entry in ./client's SOURCES map. Slugs are kept in the
// clist.by "resource" style ("codeforces.com") for continuity with existing data.
export const PLATFORM_CATALOG = [
  { slug: "codeforces.com", name: "Codeforces" },
  { slug: "leetcode.com", name: "LeetCode" },
  { slug: "atcoder.jp", name: "AtCoder" },
  { slug: "codechef.com", name: "CodeChef" },
] as const;

export type PlatformSlug = (typeof PLATFORM_CATALOG)[number]["slug"];

const SLUG_SET = new Set<string>(PLATFORM_CATALOG.map((p) => p.slug));

export function isValidPlatformSlug(slug: string): slug is PlatformSlug {
  return SLUG_SET.has(slug);
}

export function platformName(slug: string): string {
  return PLATFORM_CATALOG.find((p) => p.slug === slug)?.name ?? slug;
}

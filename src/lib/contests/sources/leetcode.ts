import type { Contest } from "../types";
import { fetchJson } from "./http";

const RESOURCE = "leetcode.com";
const QUERY = "query { upcomingContests { title titleSlug startTime duration } }";

interface LeetCodeContest {
  title: string;
  titleSlug: string;
  startTime: number; // epoch seconds
  duration: number; // seconds
}

// LeetCode's public GraphQL endpoint - no auth, but needs a browser-ish
// User-Agent (from http.ts) and Referer.
export async function fetchLeetCode(): Promise<Contest[]> {
  const json = await fetchJson<{
    data?: { upcomingContests: LeetCodeContest[] };
    errors?: { message: string }[];
  }>("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com/contest/" },
    body: JSON.stringify({ query: QUERY }),
  });

  if (json.errors?.length) {
    throw new Error(`LeetCode: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data?.upcomingContests) throw new Error("LeetCode: no upcomingContests in response");

  return json.data.upcomingContests.map((c) => ({
    id: `${RESOURCE}:${c.titleSlug}`,
    resource: RESOURCE,
    event: c.title,
    href: `https://leetcode.com/contest/${c.titleSlug}`,
    start: new Date(c.startTime * 1000).toISOString(),
    end: new Date((c.startTime + c.duration) * 1000).toISOString(),
  }));
}

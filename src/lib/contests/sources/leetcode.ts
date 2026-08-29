import type { Contest } from "../types";
import { USER_AGENT } from "./http";

const RESOURCE = "leetcode.com";
const QUERY = "query { upcomingContests { title titleSlug startTime duration } }";

interface LeetCodeContest {
  title: string;
  titleSlug: string;
  startTime: number; // epoch seconds
  duration: number; // seconds
}

// LeetCode's public GraphQL endpoint. No auth required for upcoming contests,
// but it rejects requests without a browser-ish User-Agent / Referer.
export async function fetchLeetCode(): Promise<Contest[]> {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Referer: "https://leetcode.com/contest/",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ query: QUERY }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`LeetCode GraphQL returned ${res.status}`);

  const json = (await res.json()) as {
    data?: { upcomingContests: LeetCodeContest[] };
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  const contests = json.data?.upcomingContests;
  if (!contests) throw new Error("LeetCode GraphQL: missing upcomingContests");

  return contests.map((c) => ({
    id: `${RESOURCE}:${c.titleSlug}`,
    resource: RESOURCE,
    event: c.title,
    href: `https://leetcode.com/contest/${c.titleSlug}`,
    start: new Date(c.startTime * 1000).toISOString(),
    end: new Date((c.startTime + c.duration) * 1000).toISOString(),
  }));
}

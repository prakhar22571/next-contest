import type { Contest } from "../types";
import { httpGet } from "./http";

const RESOURCE = "codeforces.com";

interface CodeforcesContest {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds?: number;
  durationSeconds: number;
}

// Official public API - no auth, no rate limit worth worrying about here.
// https://codeforces.com/apiHelp/methods#contest.list
export async function fetchCodeforces(): Promise<Contest[]> {
  const res = await httpGet("https://codeforces.com/api/contest.list?gym=false", {
    Accept: "application/json",
  });
  if (!res.ok) throw new Error(`Codeforces API returned ${res.status}`);

  const json = (await res.json()) as {
    status: string;
    result: CodeforcesContest[];
    comment?: string;
  };
  if (json.status !== "OK") {
    throw new Error(`Codeforces API: ${json.comment ?? "non-OK status"}`);
  }

  return json.result
    .filter((c) => c.phase === "BEFORE" && typeof c.startTimeSeconds === "number")
    .map((c) => {
      const startMs = (c.startTimeSeconds as number) * 1000;
      return {
        id: `${RESOURCE}:${c.id}`,
        resource: RESOURCE,
        event: c.name,
        href: `https://codeforces.com/contests/${c.id}`,
        start: new Date(startMs).toISOString(),
        end: new Date(startMs + c.durationSeconds * 1000).toISOString(),
      };
    });
}

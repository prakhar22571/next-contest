import type { Contest } from "../types";
import { fetchJson } from "./http";

const RESOURCE = "codeforces.com";

interface CodeforcesContest {
  id: number;
  name: string;
  phase: string;
  startTimeSeconds?: number;
  durationSeconds: number;
}

// Official public API - no auth. https://codeforces.com/apiHelp/methods#contest.list
export async function fetchCodeforces(): Promise<Contest[]> {
  const json = await fetchJson<{ status: string; result: CodeforcesContest[]; comment?: string }>(
    "https://codeforces.com/api/contest.list?gym=false"
  );
  if (json.status !== "OK") throw new Error(`Codeforces: ${json.comment ?? json.status}`);

  return json.result
    .filter((c) => c.phase === "BEFORE" && c.startTimeSeconds != null)
    .map((c) => {
      const start = c.startTimeSeconds! * 1000;
      return {
        id: `${RESOURCE}:${c.id}`,
        resource: RESOURCE,
        event: c.name,
        href: `https://codeforces.com/contests/${c.id}`,
        start: new Date(start).toISOString(),
        end: new Date(start + c.durationSeconds * 1000).toISOString(),
      };
    });
}

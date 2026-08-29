import type { Contest } from "../types";
import { httpGet } from "./http";

const RESOURCE = "codechef.com";

interface CodeChefContest {
  contest_code: string;
  contest_name: string;
  contest_start_date_iso: string; // e.g. "2026-09-02T20:00:00+05:30"
  contest_end_date_iso: string;
}

// Unofficial but long-stable endpoint that backs the codechef.com/contests page.
// Needs a User-Agent or it 403s.
export async function fetchCodeChef(): Promise<Contest[]> {
  const res = await httpGet("https://www.codechef.com/api/list/contests/all", {
    Accept: "application/json",
  });
  if (!res.ok) throw new Error(`CodeChef API returned ${res.status}`);

  const json = (await res.json()) as { future_contests?: CodeChefContest[] };

  return (json.future_contests ?? []).map((c) => ({
    id: `${RESOURCE}:${c.contest_code}`,
    resource: RESOURCE,
    event: c.contest_name,
    href: `https://www.codechef.com/${c.contest_code}`,
    start: new Date(c.contest_start_date_iso).toISOString(),
    end: new Date(c.contest_end_date_iso).toISOString(),
  }));
}

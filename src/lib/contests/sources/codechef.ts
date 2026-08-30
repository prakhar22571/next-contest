import type { Contest } from "../types";
import { fetchJson } from "./http";

const RESOURCE = "codechef.com";

interface CodeChefContest {
  contest_code: string;
  contest_name: string;
  contest_start_date_iso: string; // e.g. "2026-09-02T20:00:00+05:30"
  contest_end_date_iso: string;
}

// Unofficial but long-stable endpoint behind the codechef.com/contests page.
export async function fetchCodeChef(): Promise<Contest[]> {
  const json = await fetchJson<{ future_contests?: CodeChefContest[] }>(
    "https://www.codechef.com/api/list/contests/all"
  );

  return (json.future_contests ?? []).map((c) => ({
    id: `${RESOURCE}:${c.contest_code}`,
    resource: RESOURCE,
    event: c.contest_name,
    href: `https://www.codechef.com/${c.contest_code}`,
    start: new Date(c.contest_start_date_iso).toISOString(),
    end: new Date(c.contest_end_date_iso).toISOString(),
  }));
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { contestsForPreference } from "../src/lib/sync/syncUser";
import type { Contest } from "../src/lib/contests/types";

function contest(event: string, resource = "codeforces.com"): Contest {
  return {
    id: `${resource}:${event}`, resource, event, href: "https://x",
    start: new Date().toISOString(), end: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

test("codeforces division filter keeps matching and undivided rounds, leaves other platforms alone", () => {
  const contests = [
    contest("Codeforces Round 1 (Div. 2)"),
    contest("Codeforces Round 2 (Div. 1)"),
    contest("Codeforces Round 3 (Div. 1 + Div. 2)"),
    contest("Codeforces Global Round 25"),
    contest("Educational Codeforces Round 10 (Rated for Div. 3)"),
    contest("AtCoder Beginner Contest 1", "atcoder.jp"),
  ];
  const pref = { platforms: ["codeforces.com", "atcoder.jp"], daysAhead: 30, codeforcesDivisions: ["2"] };
  assert.deepEqual(contestsForPreference(contests, pref).map((c) => c.event), [
    "Codeforces Round 1 (Div. 2)",
    "Codeforces Round 3 (Div. 1 + Div. 2)",
    "Codeforces Global Round 25",
    "AtCoder Beginner Contest 1",
  ]);
});

test("no divisions selected means no division filtering", () => {
  const contests = [contest("Codeforces Round 1 (Div. 4)")];
  const pref = { platforms: ["codeforces.com"], daysAhead: 30, codeforcesDivisions: [] };
  assert.equal(contestsForPreference(contests, pref).length, 1);
});

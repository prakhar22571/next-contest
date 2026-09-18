import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { google } from "googleapis";
import type { SyncedContest } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { encrypt } from "../src/lib/crypto";
import { removeUserContest, removeUserPlatformContests } from "../src/lib/sync/removeUserContest";
import { syncUserContests, clearRemovedContests } from "../src/lib/sync/syncUser";

let row: SyncedContest;
let rows: SyncedContest[];
let eventErrors: Map<string, Error>;
let deleteError: unknown;
let databaseError: Error | undefined;
let hasCredential: boolean;
let deletedEventIds: string[];
let insertedEvents: number;
const originalKey = process.env.ENCRYPTION_KEY;
const restoreMethods: (() => void)[] = [];

// Prisma delegates are proxies; replace methods directly rather than mocking
// property descriptors, which do not expose their callable implementations.
function stub(target: object, method: string, implementation: unknown) {
  const original = Reflect.get(target, method);
  Reflect.set(target, method, implementation);
  restoreMethods.push(() => { Reflect.set(target, method, original); });
}

beforeEach(() => {
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  row = {
    id: "row-1", userId: "owner", contestId: "codeforces.com:123",
    platform: "codeforces.com", title: "Test contest", status: "SUCCESS",
    calendarEventId: "google-event-1", contestUrl: "https://codeforces.com/contest/123",
    startTime: new Date(Date.now() + 3_600_000), endTime: new Date(Date.now() + 7_200_000),
    syncedAt: new Date(), errorMessage: null,
  };
  rows = [row];
  eventErrors = new Map();
  deleteError = undefined;
  databaseError = undefined;
  hasCredential = true;
  deletedEventIds = [];
  insertedEvents = 0;

  stub(prisma.syncedContest, "findFirst", async ({ where }: { where: { id: string; userId: string } }) =>
    rows.find((record) => where.id === record.id && where.userId === record.userId) ?? null
  );
  stub(prisma.syncedContest, "findMany", async ({ where, take }: {
    where: {
      userId?: string; platform?: string; status?: string;
      startTime?: { gte: Date }; calendarEventId?: { not: null };
    }; take?: number;
  }) => rows.filter((record) =>
    (!where.userId || record.userId === where.userId) &&
    (!where.platform || record.platform === where.platform) &&
    (!where.status || record.status === where.status) &&
    (!where.startTime || record.startTime >= where.startTime.gte) &&
    (!where.calendarEventId || record.calendarEventId !== null)
  ).slice(0, take).map((record) => ({ ...record })));
  stub(prisma.syncedContest, "deleteMany", async ({ where }: {
    where: { userId: string; platform: { in: string[] }; status: string };
  }) => {
    const before = rows.length;
    rows = rows.filter((record) => !(
      record.userId === where.userId &&
      where.platform.in.includes(record.platform) &&
      record.status === where.status
    ));
    return { count: before - rows.length };
  });
  stub(prisma.syncedContest, "update", async ({ where, data }: {
    where: { id: string; userId: string }; data: Partial<SyncedContest>;
  }) => {
    const record = rows.find((record) => record.id === where.id);
    assert.ok(record);
    assert.equal(where.userId, record.userId);
    if (databaseError) throw databaseError;
    Object.assign(record, data);
    return { ...record };
  });
  stub(prisma.googleCredential, "findUnique", async ({ where }: { where: { userId: string } }) => {
    assert.equal(where.userId, "owner");
    return hasCredential ? { encryptedRefreshToken: encrypt("test-refresh-token") } : null;
  });
  stub(google, "calendar", () => ({
    events: {
      delete: async ({ calendarId, eventId }: { calendarId: string; eventId: string }) => {
        assert.equal(calendarId, "primary");
        deletedEventIds.push(eventId);
        if (eventErrors.has(eventId)) throw eventErrors.get(eventId);
        if (deleteError) throw deleteError;
      },
      insert: async () => { insertedEvents++; return { data: { id: "new-event" } }; },
    },
  }));
});

test("platform removal covers more than 50 events and preserves other users, platforms and past events", async () => {
  rows = Array.from({ length: 55 }, (_, i) => ({
    ...row, id: `target-${i}`, contestId: `contest-${i}`, calendarEventId: `event-${i}`,
  }));
  const excluded: SyncedContest[] = [
    { ...row, id: "other-user", userId: "someone-else" },
    { ...row, id: "other-platform", platform: "codechef.com" },
    { ...row, id: "past", startTime: new Date(Date.now() - 86_400_000) },
    { ...row, id: "ongoing", startTime: new Date(Date.now() - 60_000) },
    { ...row, id: "failed", status: "FAILED" },
    { ...row, id: "deleted", status: "DELETED" },
    { ...row, id: "no-event", calendarEventId: null },
  ];
  const unchanged = structuredClone(excluded);
  rows.push(...excluded);

  assert.deepEqual(await removeUserPlatformContests("owner", "codeforces.com"), {
    ok: true, removed: 55, failed: 0,
  });
  assert.equal(deletedEventIds.length, 55);
  assert.ok(rows.slice(0, 55).every((record) => record.status === "DELETED"));
  assert.deepEqual(excluded, unchanged);
  assert.deepEqual(await removeUserPlatformContests("owner", "codeforces.com"), {
    ok: true, removed: 0, failed: 0,
  });
  assert.equal(deletedEventIds.length, 55);
});

test("platform removal reports partial failures and retries only remaining events", async () => {
  rows.push({ ...row, id: "row-2", calendarEventId: "google-event-2" });
  eventErrors.set("google-event-1", new Error("Google unavailable"));
  stub(console, "error", () => {});
  assert.deepEqual(await removeUserPlatformContests("owner", row.platform), {
    ok: true, removed: 1, failed: 1,
  });
  assert.equal(row.status, "SUCCESS");
  assert.equal(rows[1].status, "DELETED");
  eventErrors.clear();
  assert.deepEqual(await removeUserPlatformContests("owner", row.platform), {
    ok: true, removed: 1, failed: 0,
  });
  assert.deepEqual(deletedEventIds, ["google-event-1", "google-event-2", "google-event-1"]);
});

test("platform removal preserves events when credentials are missing", async () => {
  hasCredential = false;
  const result = await removeUserPlatformContests("owner", row.platform);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  assert.equal(row.status, "SUCCESS");
  assert.deepEqual(deletedEventIds, []);
});

test("platform removal with no matching events is a safe no-op", async () => {
  hasCredential = false;
  assert.deepEqual(await removeUserPlatformContests("owner", "codechef.com"), {
    ok: true, removed: 0, failed: 0,
  });
  assert.deepEqual(deletedEventIds, []);
});

test("platform removal rejects invalid platforms before looking up events", async () => {
  stub(prisma.syncedContest, "findMany", () => { throw new Error("Must not query"); });
  const result = await removeUserPlatformContests("owner", "unknown-platform");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 400);
  assert.deepEqual(deletedEventIds, []);
});

afterEach(() => {
  for (const restore of restoreMethods.reverse()) restore();
  restoreMethods.length = 0;
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalKey;
});

test("removes the owned Google event and retains an exclusion; repeat requests are safe", async () => {
  assert.deepEqual(await removeUserContest("owner", row.id), { ok: true });
  assert.equal(row.status, "DELETED");
  assert.deepEqual(deletedEventIds, ["google-event-1"]);
  assert.deepEqual(await removeUserContest("owner", row.id), { ok: true });
  assert.equal(deletedEventIds.length, 1);
});

test("clearing removed contests only affects the given user and platforms", async () => {
  rows.push(
    { ...row, id: "deleted-codeforces", status: "DELETED" },
    { ...row, id: "deleted-codechef", platform: "codechef.com", status: "DELETED" },
    { ...row, id: "success-codeforces", status: "SUCCESS" },
    { ...row, id: "deleted-other-user", userId: "someone-else", status: "DELETED" },
  );
  await clearRemovedContests("owner", ["codeforces.com"]);
  assert.deepEqual(rows.map((r) => r.id), [
    "row-1", "deleted-codechef", "success-codeforces", "deleted-other-user",
  ]);
  await clearRemovedContests("owner", []);
  assert.equal(rows.length, 4);
});

test("another user cannot delete or discover the owner's event", async () => {
  const result = await removeUserContest("other-user", row.id);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 404);
  assert.equal(row.status, "SUCCESS");
  assert.deepEqual(deletedEventIds, []);
});

test("missing contests return not found without calling Google", async () => {
  assert.deepEqual(await removeUserContest("owner", "unknown"), {
    ok: false, status: 404, error: "Contest not found.",
  });
  assert.deepEqual(deletedEventIds, []);
});

test("missing credentials leave the contest available for retry", async () => {
  hasCredential = false;
  const result = await removeUserContest("owner", row.id);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 409);
  assert.equal(row.status, "SUCCESS");
  assert.deepEqual(deletedEventIds, []);
});

test("records without a successfully synced event cannot be removed", async () => {
  row.calendarEventId = null;
  assert.equal((await removeUserContest("owner", row.id)).ok, false);
  row.calendarEventId = "google-event-1";
  row.status = "FAILED";
  assert.equal((await removeUserContest("owner", row.id)).ok, false);
  assert.deepEqual(deletedEventIds, []);
});

for (const status of [404, 410]) {
  test(`an event already absent from Google (${status}) is excluded from future syncs`, async () => {
    deleteError = { response: { status } };
    assert.deepEqual(await removeUserContest("owner", row.id), { ok: true });
    assert.equal(row.status, "DELETED");
  });
}

for (const status of [401, 403, 429, 500]) {
  test(`Google failure ${status} does not mark the contest deleted`, async () => {
    deleteError = Object.assign(new Error("Google failure"), { response: { status } });
    await assert.rejects(removeUserContest("owner", row.id), /Google failure/);
    assert.equal(row.status, "SUCCESS");
  });
}

test("a failed database write can be retried after Google has removed the event", async () => {
  databaseError = new Error("Database unavailable");
  await assert.rejects(removeUserContest("owner", row.id), /Database unavailable/);
  assert.equal(row.status, "SUCCESS");
  databaseError = undefined;
  deleteError = { response: { status: 410 } };
  assert.deepEqual(await removeUserContest("owner", row.id), { ok: true });
  assert.equal(row.status, "DELETED");
});

for (const trigger of ["MANUAL", "CRON"] as const) {
  test(`${trigger} sync skips removed contests while adding new contests and retrying failures`, async () => {
    await removeUserContest("owner", row.id);
    stub(prisma.userPreference, "findUnique", async () => ({
      platforms: ["codeforces.com"], codeforcesDivisions: [], daysAhead: 14, timeZone: "UTC",
    }));
    stub(prisma.syncedContest, "findMany", async ({ where }: {
      where: { userId: string; status: { in: string[] } };
    }) => {
      assert.equal(where.userId, "owner");
      return where.status.in.includes(row.status) ? [{ contestId: row.contestId }] : [];
    });
    const recorded: string[] = [];
    stub(prisma.syncedContest, "upsert", async ({ create }: { create: SyncedContest }) => {
      recorded.push(create.contestId);
      return create;
    });
    stub(prisma.syncRun, "create", async () => ({ id: "run-1" }));
    stub(prisma.syncRun, "update", async () => ({}));
    stub(prisma.userPreference, "update", async () => ({}));
    stub(prisma, "$transaction", async (operations: Promise<unknown>[]) => Promise.all(operations));
    const contest = {
      id: row.contestId, resource: row.platform, event: row.title,
      start: row.startTime.toISOString(), end: row.endTime.toISOString(),
      href: row.contestUrl!,
    };
    const result = await syncUserContests("owner", trigger, [
      contest, { ...contest, id: "new-contest" }, { ...contest, id: "previously-failed" },
    ]);
    assert.deepEqual(result, { found: 3, created: 2, failed: 0 });
    assert.equal(insertedEvents, 2);
    assert.deepEqual(recorded, ["new-contest", "previously-failed"]);
    assert.equal(row.status, "DELETED");
  });
}

import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PreferencesForm } from "./components/PreferencesForm";
import { SyncStatusPanel } from "./components/SyncStatusPanel";
import { UpcomingContestsList } from "./components/UpcomingContestsList";
import { StripOAuthParams } from "./components/StripOAuthParams";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const userId = session.user.id;

  const now = new Date();
  const [preference, latestRun, upcomingContests, platformCounts, removedCounts] = await Promise.all([
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.syncRun.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } }),
    prisma.syncedContest.findMany({
      where: { userId, status: "SUCCESS", startTime: { gte: now } },
      orderBy: { startTime: "asc" },
      take: 50,
    }),
    prisma.syncedContest.groupBy({
      by: ["platform"],
      where: {
        userId, status: "SUCCESS", startTime: { gte: now },
        calendarEventId: { not: null },
      },
      _count: { _all: true },
      orderBy: { platform: "asc" },
    }),
    prisma.syncedContest.groupBy({
      by: ["platform"],
      where: { userId, status: "DELETED" },
      _count: { _all: true },
      orderBy: { platform: "asc" },
    }),
  ]);

  // Restoring only makes sense for a platform still selected in preferences.
  const restorablePlatforms = removedCounts
    .filter((group) => preference?.platforms.includes(group.platform))
    .map((group) => ({ platform: group.platform, count: group._count._all }));

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <StripOAuthParams />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500">{session.user.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-sm text-zinc-500 underline">
            Sign out
          </button>
        </form>
      </div>

      <PreferencesForm
        initialPlatforms={preference?.platforms ?? []}
        initialDaysAhead={preference?.daysAhead ?? 14}
        timeZone={preference?.timeZone ?? "UTC"}
      />

      <SyncStatusPanel lastSyncedAt={preference?.lastSyncedAt ?? null} latestRun={latestRun} />

      <UpcomingContestsList
        contests={upcomingContests}
        platformCounts={platformCounts.map((group) => ({ platform: group.platform, count: group._count._all }))}
        restorablePlatforms={restorablePlatforms}
      />
    </div>
  );
}

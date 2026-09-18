import type { SyncedContest } from "@prisma/client";
import { platformName } from "@/lib/contests/platforms";
import { RemoveContestButton, RemovePlatformContestsButton } from "./RemoveContestButton";

interface UpcomingContestsListProps {
  contests: SyncedContest[];
  platformCounts: { platform: string; count: number }[];
}

export function UpcomingContestsList({ contests, platformCounts }: UpcomingContestsListProps) {
  if (contests.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
        No upcoming contests in your calendar. Save your preferences to sync new contests.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-medium">Upcoming contests</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Remove contests you don’t want from Google Calendar. Future syncs won’t add them back.
        </p>
        {platformCounts.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Remove by platform</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Use the trash icon, then ✓ to remove all upcoming events for that platform or × to cancel.
              To stop adding new contests, deselect the platform in your preferences and save.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {platformCounts.map(({ platform, count }) => (
                <div key={platform} className="flex items-start gap-2 rounded-lg border border-zinc-200 py-1 pl-3 pr-1 dark:border-zinc-800">
                  <span className="whitespace-nowrap py-2 text-sm">
                    {platformName(platform)} <span className="text-zinc-500">({count})</span>
                  </span>
                  <RemovePlatformContestsButton platform={platform} count={count} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-2 font-medium">Contest</th>
            <th className="px-4 py-2 font-medium">Platform</th>
            <th className="px-4 py-2 font-medium">Starts</th>
            <th className="px-4 py-2 font-medium">Calendar</th>
          </tr>
        </thead>
        <tbody>
          {contests.map((contest) => (
            <tr key={contest.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
              <td className="px-4 py-2">
                {contest.contestUrl ? (
                  <a
                    href={contest.contestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {contest.title}
                  </a>
                ) : (
                  contest.title
                )}
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {platformName(contest.platform)}
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {contest.startTime.toLocaleString()}
              </td>
              <td className="px-4 py-2">
                {contest.calendarEventId ? (
                  <RemoveContestButton id={contest.id} title={contest.title} />
                ) : (
                  <span className="text-xs text-zinc-500">Calendar event unavailable</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

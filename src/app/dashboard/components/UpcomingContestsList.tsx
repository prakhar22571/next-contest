import type { SyncedContest } from "@prisma/client";
import { platformName } from "@/lib/clist/platforms";

interface UpcomingContestsListProps {
  contests: SyncedContest[];
}

export function UpcomingContestsList({ contests }: UpcomingContestsListProps) {
  if (contests.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800">
        No contests synced yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-2 font-medium">Contest</th>
            <th className="px-4 py-2 font-medium">Platform</th>
            <th className="px-4 py-2 font-medium">Starts</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

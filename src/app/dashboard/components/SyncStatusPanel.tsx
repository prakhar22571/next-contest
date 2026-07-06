import type { SyncRun } from "@prisma/client";

interface SyncStatusPanelProps {
  lastSyncedAt: Date | null;
  latestRun: SyncRun | null;
}

export function SyncStatusPanel({ lastSyncedAt, latestRun }: SyncStatusPanelProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-6 text-sm dark:border-zinc-800">
      <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Sync status</h2>
      <p className="text-zinc-600 dark:text-zinc-400">
        Last synced:{" "}
        {lastSyncedAt ? lastSyncedAt.toLocaleString() : "never — save your preferences to sync"}
      </p>
      {latestRun && (
        <p className="text-zinc-600 dark:text-zinc-400">
          Latest run ({latestRun.trigger.toLowerCase()}, {latestRun.status.toLowerCase()}):{" "}
          {latestRun.contestsFound} found, {latestRun.contestsCreated} added,{" "}
          {latestRun.contestsFailed} failed
          {latestRun.errorMessage ? ` — ${latestRun.errorMessage}` : ""}
        </p>
      )}
    </div>
  );
}

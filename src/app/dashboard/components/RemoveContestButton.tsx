"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RemoveContestButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "removing" | "removed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setStatus("removing");
    setError(null);
    try {
      const response = await fetch(`/api/contests/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Could not remove this event. Please try again.");
      }
      setStatus("removed");
      router.refresh();
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Could not remove this event. Please try again.");
    }
  }

  if (status === "removed") {
    return <span role="status" className="text-zinc-500">Removed from calendar.</span>;
  }

  return (
    <div className="flex min-w-36 flex-col gap-2">
      {confirming ? (
        <>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">Remove this event from Google Calendar?</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={remove}
              disabled={status === "removing"}
              aria-label={`Confirm removal of ${title} from calendar`}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {status === "removing" ? "Removing…" : "Remove"}
            </button>
            <button
              type="button"
              disabled={status === "removing"}
              onClick={() => { setConfirming(false); setError(null); }}
              className="text-xs text-zinc-500 underline disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${title} from calendar`}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-red-300 hover:text-red-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-red-400"
        >
          Remove from calendar
        </button>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

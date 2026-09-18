"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { platformName } from "@/lib/contests/platforms";

export function RemoveContestButton({ id, title }: { id: string; title: string }) {
  return <RemoveCalendarButton endpoint={`/api/contests/${encodeURIComponent(id)}`} title={title} />;
}

export function RemovePlatformContestsButton({ platform, count }: { platform: string; count: number }) {
  return (
    <RemoveCalendarButton
      endpoint={`/api/contests/platform/${encodeURIComponent(platform)}`}
      title={`all ${count} upcoming ${platformName(platform)} events`}
    />
  );
}

function RemoveCalendarButton({ endpoint, title }: { endpoint: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<"idle" | "removing" | "removed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setStatus("removing");
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.failed > 0) {
        // Refresh successful deletions even when some events need another try.
        router.refresh();
        throw new Error(body?.error ?? "Could not finish removing calendar events. Please try again.");
      }
      setStatus("removed");
      router.refresh();
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Could not remove calendar events. Please try again.");
    }
  }

  if (status === "removed") {
    return (
      <span role="status" className="inline-flex size-9 items-center justify-center text-zinc-500">
        <ActionIcon name="check" />
        <span className="sr-only">Removed from calendar.</span>
      </span>
    );
  }

  return (
    <div className="flex min-w-20 flex-col gap-2">
      {confirming ? (
        <div role="group" aria-label={`Remove ${title} from Google Calendar?`} className="flex items-center gap-1">
          <button
            type="button"
            onClick={remove}
            disabled={status === "removing"}
            aria-label={status === "removing" ? `Removing ${title} from calendar` : `Confirm removal of ${title} from calendar`}
            aria-busy={status === "removing"}
            title={`Confirm removal of ${title}`}
            className="inline-flex size-9 items-center justify-center rounded-md text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
          >
            <ActionIcon name={status === "removing" ? "spinner" : "check"} />
          </button>
          <button
            type="button"
            disabled={status === "removing"}
            onClick={() => { setConfirming(false); setError(null); }}
            aria-label={`Cancel removal of ${title}`}
            title="Cancel"
            className="inline-flex size-9 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            <ActionIcon name="cross" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Remove ${title} from calendar`}
          title={`Remove ${title} from calendar`}
          className="inline-flex size-9 items-center justify-center self-start rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
          <ActionIcon name="trash" />
        </button>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function ActionIcon({ name }: { name: "trash" | "check" | "cross" | "spinner" }) {
  const paths = {
    trash: "M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6",
    check: "m5 12 4 4L19 6",
    cross: "m6 6 12 12M6 18 18 6",
    spinner: "M20 12a8 8 0 1 1-8-8",
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`size-4 ${name === "spinner" ? "animate-spin motion-reduce:animate-none" : ""}`}
    >
      <path d={paths[name]} />
    </svg>
  );
}

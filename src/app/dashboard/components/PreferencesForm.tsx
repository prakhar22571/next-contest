"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlatformSelector } from "./PlatformSelector";
import { DaysAheadSelector } from "./DaysAheadSelector";

interface PreferencesFormProps {
  initialPlatforms: string[];
  initialDaysAhead: number;
  timeZone: string;
}

export function PreferencesForm({
  initialPlatforms,
  initialDaysAhead,
  timeZone,
}: PreferencesFormProps) {
  const router = useRouter();
  const [platforms, setPlatforms] = useState(initialPlatforms);
  const [daysAhead, setDaysAhead] = useState(initialDaysAhead);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms, daysAhead, timeZone }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error ? JSON.stringify(body.error) : "Failed to save preferences");
      }
      setStatus("idle");
      if (body?.syncError) {
        setMessage(`Preferences saved, but sync failed: ${body.syncError}`);
      } else if (body?.sync) {
        setMessage(
          `Preferences saved. Found ${body.sync.found}, added ${body.sync.created}` +
            (body.sync.failed > 0 ? `, ${body.sync.failed} failed` : "") +
            "."
        );
      } else {
        setMessage("Preferences saved.");
      }
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
      <PlatformSelector selected={platforms} onChange={setPlatforms} />
      <DaysAheadSelector value={daysAhead} onChange={setDaysAhead} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving" || platforms.length === 0}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {status === "saving" ? "Saving & syncing…" : "Save & sync now"}
        </button>
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        {message && !error && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{message}</span>
        )}
      </div>
    </div>
  );
}

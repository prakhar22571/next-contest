"use client";

import { DAYS_AHEAD_OPTIONS } from "@/lib/validation/preferences";

interface DaysAheadSelectorProps {
  value: number;
  onChange: (days: number) => void;
}

export function DaysAheadSelector({ value, onChange }: DaysAheadSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Fetch contests within
      </legend>
      <div className="flex gap-2">
        {DAYS_AHEAD_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => onChange(days)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              value === days
                ? "bg-foreground text-background"
                : "border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
            }`}
          >
            {days} days
          </button>
        ))}
      </div>
    </fieldset>
  );
}

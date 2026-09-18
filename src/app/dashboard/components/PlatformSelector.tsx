"use client";

import { PLATFORM_CATALOG, CODEFORCES_DIVISIONS } from "@/lib/contests/platforms";

interface PlatformSelectorProps {
  selected: string[];
  onChange: (slugs: string[]) => void;
  codeforcesDivisions: string[];
  onCodeforcesDivisionsChange: (divisions: string[]) => void;
}

export function PlatformSelector({
  selected,
  onChange,
  codeforcesDivisions,
  onCodeforcesDivisionsChange,
}: PlatformSelectorProps) {
  function toggle(slug: string) {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  }

  function toggleDivision(div: string) {
    onCodeforcesDivisionsChange(
      codeforcesDivisions.includes(div)
        ? codeforcesDivisions.filter((d) => d !== div)
        : [...codeforcesDivisions, div]
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Platforms
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PLATFORM_CATALOG.map((platform) => (
          <label
            key={platform.slug}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
          >
            <input
              type="checkbox"
              checked={selected.includes(platform.slug)}
              onChange={() => toggle(platform.slug)}
              className="h-4 w-4"
            />
            {platform.name}
          </label>
        ))}
      </div>
      {selected.includes("codeforces.com") && (
        <div className="flex flex-wrap items-center gap-3 pl-1">
          <span className="text-xs text-zinc-500">Codeforces divisions (all if none picked):</span>
          {CODEFORCES_DIVISIONS.map((div) => (
            <label key={div} className="flex items-center gap-1 text-xs text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={codeforcesDivisions.includes(div)}
                onChange={() => toggleDivision(div)}
                className="h-3.5 w-3.5"
              />
              Div {div}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

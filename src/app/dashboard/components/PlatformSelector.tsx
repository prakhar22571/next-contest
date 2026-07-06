"use client";

import { PLATFORM_CATALOG } from "@/lib/clist/platforms";

interface PlatformSelectorProps {
  selected: string[];
  onChange: (slugs: string[]) => void;
}

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  function toggle(slug: string) {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
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
    </fieldset>
  );
}

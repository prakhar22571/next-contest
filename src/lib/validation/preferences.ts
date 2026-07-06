import { z } from "zod";
import { isValidPlatformSlug } from "@/lib/clist/platforms";

export const DAYS_AHEAD_OPTIONS = [7, 14, 30] as const;

export const preferencesSchema = z.object({
  platforms: z
    .array(z.string())
    .min(1, "Select at least one platform")
    .refine((slugs) => slugs.every(isValidPlatformSlug), {
      message: "Unknown platform slug",
    }),
  daysAhead: z.number().int().refine((n) => (DAYS_AHEAD_OPTIONS as readonly number[]).includes(n), {
    message: "daysAhead must be one of 7, 14, 30",
  }),
  timeZone: z.string().min(1).default("UTC"),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

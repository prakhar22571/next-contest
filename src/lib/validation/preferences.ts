import { z } from "zod";
import { isValidPlatformSlug, CODEFORCES_DIVISIONS } from "@/lib/contests/platforms";

export const DAYS_AHEAD_OPTIONS = [7, 14, 30] as const;

export const preferencesSchema = z.object({
  platforms: z
    .array(z.string())
    .min(1, "Select at least one platform")
    .refine((slugs) => slugs.every(isValidPlatformSlug), {
      message: "Unknown platform slug",
    }),
  // Empty means all divisions - unset unless the user narrows it down.
  codeforcesDivisions: z.array(z.enum(CODEFORCES_DIVISIONS)).default([]),
  daysAhead: z.number().int().refine((n) => (DAYS_AHEAD_OPTIONS as readonly number[]).includes(n), {
    message: "daysAhead must be one of 7, 14, 30",
  }),
  timeZone: z.string().min(1).default("UTC"),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

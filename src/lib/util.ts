export const DAY_MS = 86_400_000;

export const daysFromNow = (days: number): Date => new Date(Date.now() + days * DAY_MS);

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

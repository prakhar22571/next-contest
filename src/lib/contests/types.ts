// Normalized contest shape produced by every platform source. Field names match
// what the sync/calendar code consumes (previously the clist.by response shape).
export interface Contest {
  // Globally unique and stable across syncs, e.g. "codeforces.com:1234".
  id: string;
  // Platform slug - matches PLATFORM_CATALOG / UserPreference.platforms.
  resource: string;
  event: string;
  href: string;
  // ISO 8601 timestamps in UTC.
  start: string;
  end: string;
}

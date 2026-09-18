-- Keep removed contests so future syncs do not recreate their calendar events.
ALTER TYPE "SyncContestStatus" ADD VALUE 'DELETED';

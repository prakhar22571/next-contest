-- Codeforces round divisions ("1".."4") a user wants synced; empty = all.
ALTER TABLE "UserPreference" ADD COLUMN "codeforcesDivisions" TEXT[] NOT NULL DEFAULT '{}';

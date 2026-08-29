# Contest Calendar Sync

Sign in with Google, pick which competitive-programming platforms you follow and how many days
ahead to look, and upcoming contests get added straight to your Google Calendar — both
immediately when you save, and automatically every day via a scheduled sync.

## Stack

Next.js (App Router) + Auth.js (NextAuth v5, Google OAuth) + Prisma/Postgres + the Google
Calendar API. Contest data is pulled directly from each platform (Codeforces, LeetCode,
AtCoder, CodeChef) — no third-party aggregator or API key.

## Setup

### 1. Database

Provision a free Postgres instance (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com))
and copy its connection string into `DATABASE_URL`.

### 2. Google Cloud OAuth client

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Google Calendar API** (APIs & Services → Library).
3. Configure the **OAuth consent screen**: External, keep it in **Testing** mode, and add every
   Google account you'll sign in with as a test user (the `calendar.events` scope is a "sensitive
   scope" that requires Google's app-verification process before it can be used by arbitrary
   users — Testing mode skips that for development).
4. Create an **OAuth client ID** (Web application). Add
   `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI (and your
   production URL's equivalent once deployed).
5. Copy the client ID/secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### 3. Secrets

```bash
# AUTH_SECRET and ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run that twice for `AUTH_SECRET` and `ENCRYPTION_KEY` (the latter encrypts stored Google refresh
tokens at rest). Set `CRON_SECRET` to any long random string — it's the bearer token the cron
route checks for.

Copy `.env.local.example` to `.env` and fill in all of the above.

### 4. Install, migrate, seed

```bash
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with Google, and confirm the consent
screen asks for calendar-events access.

## How it works

- `src/auth.ts` — Auth.js Google provider requesting offline access (`access_type=offline`,
  `prompt=consent`) so a refresh token is always issued. The `signIn` callback encrypts and stores
  it in the `GoogleCredential` table (independent of Auth.js's own `Account` row) so background
  syncs work without an active browser session.
- `src/lib/contests/` — one module per platform under `sources/` (Codeforces' official API,
  LeetCode's public GraphQL, a scrape of AtCoder's contests page, CodeChef's unofficial contest
  list endpoint), each normalizing to a common `Contest` shape. `client.ts` fans out to the
  requested platforms in parallel and filters to the date range; one platform failing doesn't
  fail the sync (only all of them failing does).
- `src/lib/google/calendar.ts` — creates Google Calendar events using a user's stored refresh
  token.
- `src/lib/sync/syncUser.ts` — syncs one user: diffs contests against previously-synced ones (the
  `SyncedContest` table, unique per `(userId, contestId)`) so re-syncing never creates duplicate
  events, and retries any contest that previously failed.
- `src/lib/sync/syncAll.ts` — the cron entry point (`syncAllUsers`). Fetches each distinct
  platform selected across *all* users once, then syncs every user from that shared result, to
  keep request volume to the platform APIs low.
- `PUT /api/preferences` — saves a user's platform/day-range choices and immediately syncs.
- `GET /api/cron/sync-all` — protected by a `CRON_SECRET` bearer token; triggered daily by
  Vercel Cron (see `vercel.json`). On another host, point any scheduler (GitHub Actions cron, a VM
  cron job, etc.) at this same route with that header.

## Verifying end-to-end

1. Sign in, select a couple of platforms and a day range on `/dashboard`, and save — check that
   events show up in your real Google Calendar with the right title/time/link.
2. Save the same preferences again and confirm no duplicate events are created.
3. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-all` to
   exercise the cron fan-out path manually.

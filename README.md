# Contest Calendar Sync

Sign in with Google, pick which competitive-programming platforms you follow and how many days
ahead to look, and upcoming contests get added straight to your Google Calendar — both
immediately when you save, and automatically every day via a scheduled sync.

Remove unwanted upcoming contests from Google Calendar using **Remove from calendar** on the
dashboard. After confirmation, the event is deleted and excluded from future manual and daily
syncs. Removal only affects the signed-in user's event; failed removals can be retried.

## Stack

Next.js (App Router) + Auth.js (NextAuth v5, Google OAuth) + Prisma/Postgres + the Google
Calendar API. Contest data is pulled directly from each platform (Codeforces, LeetCode,
AtCoder, CodeChef) — no third-party aggregator or API key.

## Setup

### 1. Database

Provision a free Postgres instance (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com))
and copy its connection string into `DATABASE_URL` (and `DIRECT_URL` — locally they can be the
same; on Neon see the [Deploying](#deploying-free-tier-netlify--neon--github-actions) section).

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
  `prompt=consent`) so a refresh token is always issued. The `signIn` *event* encrypts and stores
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
  `.github/workflows/cron.yml` (GitHub Actions `schedule`), which just `curl`s this route.

## Verifying end-to-end

Run `npm test` for the calendar-removal and sync regression tests (Google and database calls are
mocked). Apply pending database migrations with `npm run db:deploy` before running the updated
app; Netlify applies these automatically during deployment.

1. Sign in, select a couple of platforms and a day range on `/dashboard`, and save — check that
   events show up in your real Google Calendar with the right title/time/link.
2. Save the same preferences again and confirm no duplicate events are created.
3. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-all` to
   exercise the cron fan-out path manually.
4. Remove a contest from the dashboard, confirm that its Google Calendar event disappears, then
   sync again and confirm that it stays removed. Cancelling a removal should leave it unchanged.

## Deploying (free tier: Netlify + Neon + GitHub Actions)

This is a single Next.js app — pages, API routes and server actions all deploy together to one
host. The pieces:

| Piece | Service | Notes |
| --- | --- | --- |
| App | **Netlify** | `@netlify/plugin-nextjs` runs the App Router server as functions. Config in `netlify.toml`. |
| Postgres | **Neon** | Free, never expires. `DATABASE_URL` = pooled endpoint, `DIRECT_URL` = direct (for migrations). |
| Daily sync | **GitHub Actions** | `.github/workflows/cron.yml` curls `/api/cron/sync-all` at 03:00 UTC. |

### 1. Database (Neon)

Create a project at [neon.tech](https://neon.tech). From the dashboard's connection panel copy
**both** strings: the *pooled* one (host contains `-pooler`) into `DATABASE_URL`, and the
*direct* one into `DIRECT_URL`.

### 2. App (Netlify)

1. Push this repo to GitHub and "Add new site → Import an existing project" on
   [netlify.com](https://netlify.com). Build settings come from `netlify.toml`.
2. Set environment variables (Site config → Environment variables): `DATABASE_URL`, `DIRECT_URL`,
   `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `AUTH_TRUST_HOST=true`, and `NEXTAUTH_URL=https://<your-site>.netlify.app`.
3. Deploy. The build runs `prisma migrate deploy` against Neon automatically. Seed the platform
   catalog once: `DATABASE_URL=<neon-direct-url> npx prisma db seed` from your machine.
4. In Google Cloud Console, add `https://<your-site>.netlify.app/api/auth/callback/google` to the
   OAuth client's authorized redirect URIs.

### 3. Cron (GitHub Actions)

In the GitHub repo → Settings → Secrets and variables → Actions, add:
`APP_URL=https://<your-site>.netlify.app` and `CRON_SECRET=<same value as Netlify>`.
The workflow then runs daily; trigger it manually once from the Actions tab to verify.

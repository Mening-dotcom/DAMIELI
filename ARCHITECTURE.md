# DAMIELI — Job Search Automation Architecture

Extends the existing Cvbuilder (DAMIELI) app with a job-discovery + prep layer.
Human stays in the loop for login + the actual application send.

## Goal

Find jobs across many sites → match to criteria → auto-tailor the CV (reusing the
existing Claude pipeline) → present each job "ready to send" on a dashboard. The
user logs into each site and sends the application manually.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Location / scope | Based in Costa Rica. Primary: **remote from anywhere**. Secondary: **CR hybrid/on-site**. Flag each posting's eligibility (worldwide / LATAM / US-only). |
| App structure | **One app** — fold into existing DAMIELI (Next.js 16, App Router). |
| Output | **Tailored CV only** for now (cover letters later). |
| Tailoring engine | **Claude** via `@anthropic-ai/sdk` — reuse the existing `/api/generate` route. |
| Deployment | **Vercel** (serverless). No localhost dependency. |
| Human-in-the-loop | User does login + the actual send. System does find → match → tailor → organize → track. |

## Existing pieces reused (already in the repo)

- `src/app/api/generate/route.ts` — tailors CV from `profileText + jobText` via Claude.
- `src/app/api/fetch-job/route.ts` — pulls a job description from a URL.
- `src/app/api/profile/route.ts`, `auth/*`, `history/*` — profile, auth, history.
- PDF/Word export via `jspdf` + `docx`.

## ⚠️ Prerequisite fix: storage

Current `src/lib/db.ts` uses SQLite (`sql.js` / `better-sqlite3`) under `.data/`,
falling back to `/tmp/.data` on Vercel. **`/tmp` is ephemeral on Vercel** — data
does not persist across invocations or deploys. Migrate persistence to
**Supabase Postgres** (`@supabase/supabase-js` is already a dependency). Supabase
is the single source of truth in production; SQLite may stay for local dev only.

## Job sources (legal, serverless-friendly — no scraping)

Scraping LinkedIn/Indeed directly is avoided: it violates ToS, triggers anti-bot,
and needs a headless browser that runs poorly on Vercel serverless. Use aggregator
APIs instead.

| Stream | Sources |
|---|---|
| Remote (anywhere) — primary | Remotive (free, no key), RemoteOK (free), Arbeitnow (free), JSearch via RapidAPI (`remote` filter) |
| Costa Rica hybrid/on-site — secondary | JSearch filtered to Costa Rica (indexes LinkedIn/Indeed) |

Each job stores its raw location/eligibility text so matching can flag
worldwide / LATAM-friendly / US-only.

## New components

```
src/app/api/search/route.ts        # query job APIs → normalize → upsert into jobs
src/app/api/jobs/route.ts          # list stored jobs + statuses (dashboard data)
src/app/api/jobs/[id]/prep/route.ts# tailor CV for one job (reuse generate logic)
src/app/api/jobs/[id]/status/route.ts # update application status
src/app/jobs/page.tsx              # dashboard: Remote/CR toggle, cards, Prep/Apply/status
vercel.json                        # cron → GET /api/search daily
```

## Data model (Supabase/Postgres)

```
jobs(
  id, source, external_id, title, company,
  location_text, remote_type,            -- remote | hybrid | onsite
  eligibility,                           -- worldwide | latam | us_only | unknown
  url, description, posted_at, fetched_at, user_id
)
applications(
  id, user_id, job_id,
  status,                                -- saved | prepped | applied | interviewing | rejected
  tailored_cv_ref, applied_at, notes
)
```

## Data flow

```
Vercel Cron (daily)
  └─▶ /api/search  → job APIs → normalize + eligibility flag → upsert jobs (Supabase)

User opens /jobs
  └─▶ /api/jobs    → list jobs + status
      per job:
        [Prep CV] → /api/jobs/[id]/prep → reuse generate (Claude) → store tailored CV
        [Open & Apply →] opens the posting URL (user logs in + sends)
        [status dropdown] → /api/jobs/[id]/status
```

## Vercel constraints to respect

- Function timeout: Hobby 10s, Pro up to 60s (`generate` already sets `maxDuration=60`).
  Tailor **one job per request**, never batch many CVs in one function call.
- Cron frequency: Hobby ~once/day (fine for a daily sweep); Pro allows more.
- Stateless functions → external DB (Supabase) + blob/export handled per request.

## Environment variables (Vercel)

```
ANTHROPIC_API_KEY            # exists — CV tailoring
SUPABASE_URL                 # Postgres persistence
SUPABASE_SERVICE_ROLE_KEY    # server-side writes
RAPIDAPI_KEY                 # JSearch (optional at first)
# Remotive / RemoteOK / Arbeitnow need no key
```

## Build order (phased)

0. **DB migration** — move persistence to Supabase (prerequisite for reliable tracking).
1. **Phase 1 — Discovery slice:** `/api/search` with ONE free source (Remotive, no key)
   → `jobs` table → basic `/jobs` list page. Proves the pipeline end to end.
2. **Phase 2 — More sources + matching:** add RemoteOK, Arbeitnow, JSearch; eligibility
   flagging; Remote/CR toggle.
3. **Phase 3 — Per-job CV prep:** wire "Prep CV" to the existing generate route; store +
   download the tailored CV.
4. **Phase 4 — Tracking + automation:** status workflow + Vercel Cron daily sweep.

## Out of scope (deliberately)

- Auto-login to job sites, auto-submit applications (ToS/security/anti-bot — human does this).
- Cover letters (planned later).
- Storing job-site passwords.

## Primary source: Mentorhood (verified)

Favorite board: https://www.mentorhood.com/en/oportunidades?locationType=remote&seniority=Junior
LATAM-focused, ideal for a Costa Rica base. Verified it serves job data as
schema.org `JobPosting` JSON-LD embedded in the server HTML — so a plain
`fetch()` + `JSON.parse` extracts clean, structured jobs (no headless browser).
Fields available per job: title, hiringOrganization, description, jobLocationType
(TELECOMMUTE=remote), jobLocation (country), baseSalary, datePosted. 20 jobs per
page, 58 total (pagination via "Load more" — deferred). No per-job apply URL in
the JSON-LD yet → link back to the board for now.

## Phase 1 — BUILT (discovery slice)

- `src/lib/sources/mentorhood.ts` — fetch + JSON-LD parse → `NormalizedJob[]`.
- `src/app/api/search/route.ts` — `GET /api/search?locationType=remote&seniority=Junior`.
- `src/app/jobs/page.tsx` — `/jobs` dashboard: live count + cards (title, company,
  remote/location/salary/date, Open & Apply link).
- No new dependencies required.

Next: Phase 3 "Prep CV" button on each card (reuse `/api/generate`), then Supabase
migration (Phase 0) for persistence + status tracking + Vercel Cron (Phase 4).

# University Info Retrieval System

A production-shaped demo of a university information retrieval system. A
Next.js (App Router) app backed by local Supabase that searches 40 years of
student records — 80,000 students and ~10M related rows — in milliseconds using
B-tree and GIN trigram indexes, then shows full student profiles with
per-section tabs.

## What it is

- **Search** over 80k students by PNR, roll number, or name, returning results
  in single-digit-to-tens of milliseconds.
- **Student profiles** with six lazy-loaded tabs: personal, admission,
  academic, attendance, fees, and documents.
- **Admin CRUD** for students, courses, and departments, with an audit log of
  every write.
- **Document upload** to private Supabase Storage, served back via 10-minute
  signed URLs.

## Architecture

```
Browser ──▶ Next.js (App Router) ──▶ local Supabase
                                      ├─ PostgreSQL: metadata + search (21 tables)
                                      ├─ Auth: email/password (Supabase)
                                      └─ Storage: document blobs (private bucket)
```

No separate API server — the Next.js app talks directly to Supabase.

- Reads run as the **authenticated** user (RLS grants SELECT to
  `authenticated` on every table).
- Writes (seed, admin CRUD backfill, uploads) run as the **service_role**,
  which bypasses RLS.
- Search uses index-assisted queries: PNR / roll → unique B-tree `eq` lookup;
  name → GIN trigram `ilike` over `search_name`.
- Documents are stored in a private `student-documents` bucket; only metadata
  (path, size, mime) lives in `student_documents`, and files are fetched with
  signed URLs that expire after 10 minutes.

## Scale

The seed generates 40 years (1986–2025) × 2,000 students/year:

| Table | Rows |
| --- | --- |
| students | 80,000 |
| enrollments | 3,200,000 |
| subject_results | 3,200,000 |
| attendance | 3,200,000 |
| student_fees | 640,000 |
| payments | 640,000 |
| programs | 4 |
| subjects | 160 |

That's the point: at this scale, a unique B-tree lookup is O(log N) — so
index-assisted queries stay in the milliseconds even with ~10M related rows.

## Local setup

Prerequisites: [Node.js](https://nodejs.org) (20+) and
[Docker](https://www.docker.com).

```bash
# 1. Start local Supabase (Postgres, Auth, Storage) in Docker
npx supabase start

# 2. Configure environment variables
cp .env.example .env
# Fill NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY from `npx supabase status`
# and set AADHAAR_ENCRYPTION_KEY via:  openssl rand -base64 32

# 3. Install dependencies
npm install

# 4. Start Redis (Docker) — layered cache (LRU hot path → Redis). App works without it (LRU-only degraded mode)
npm run db:redis:up   # or: docker compose up -d redis
# Verify: docker compose ps  (erp-redis should be healthy)

# 5. Reset DB, seed, and refresh materialized views
npx supabase db reset
npm run db:seed            # 40 years × 2000/year (~80k students; a few minutes, batch 500)
npm run db:refresh:views   # refresh_report_views() for mv_* (concurrently, with no data on reset)

# 6. Verify
npm run db:smoke           # RPC/view smoke: courses, student_summary, dashboard_stats, search_students

# 7. Start the app
npm run dev
```

Open http://localhost:3000, sign in at `/login`, and you'll land on `/search`.
Dual dashboards: `/dashboard/viewer` (read-only) and `/dashboard/admin` (full ERP, RBAC-gated).

## Seeding the dataset

The database starts empty after `npx supabase start`. Seed the full 40-year
dataset (80,000 students; a few minutes in batches of 500):

```bash
npm run seed
```

`npm run seed` defaults to `--years=40 --perYear=2000`. You can tune it:

```bash
npm run seed -- --years=5 --perYear=200
```

> **Idempotency guard:** the seeder refuses to run twice — it throws
> `Demo University already exists`. To reseed from scratch, wipe local data
> first (this also clears auth users, so you'll need to recreate the demo
> admin below):

```bash
npx supabase db reset
npm run seed
```

## Demo admin

The demo admin login is:

```
admin@uni.local / demo1234
```

`npx supabase db reset` wipes auth users, so after a reset you must recreate
the admin: create the user (e.g. via a sign-up request to Supabase Auth), then
promote them:

```bash
curl -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@uni.local","password":"demo1234"}'

npx supabase db query "insert into user_roles(user_id, role_id) select id, (select id from roles where name='admin') from users where email='admin@uni.local';"
```

## Features

- **Query classification** — `classifyQuery` routes input to the right index:
  `NNCCNNNN` → PNR (`eq` on `pnr`), `1–6` digits → roll (`eq` on
  `roll_number`), anything else → name (`ilike` on `search_name`, trigram
  GIN).
- **Keyset pagination** — results page via `gt("id", cursor)` with a 50-row
  limit and a "Load more" cursor, no OFFSET.
- **Student profile tabs** — academic, attendance, fees, and documents load
  their data lazily on tab switch.
- **Admin CRUD** — create/edit students, courses, and departments; every
  mutation writes an `audit_logs` row.
- **Document upload** — private-bucket upload with a `student_documents`
  metadata row, downloaded through 10-minute signed URLs.

## Benchmark

Single-request probes over the full synthetic dataset (80,000 students)
with `npm run benchmark` (20 iterations per probe, direct Supabase RPC):

| type | query | avg (ms) | min (ms) | max (ms) |
| --- | --- | --- | --- | --- |
| pnr | 22CS0001 | 4.21 | 2.25 | 21.56 |
| roll | 1045 | 2.80 | 2.27 | 3.49 |
| name | Rahul Sharma | 50.77 | 48.85 | 55.34 |
| name | Rahul | 14.17 | 13.12 | 15.22 |

```bash
npm run benchmark            # single-request DB probes
npm run benchmark:load       # concurrency gate — requires `npm run dev` running
npm run benchmark:load -- --concurrency=10 --requests=100 --base=http://127.0.0.1:3000
```

### Concurrency gate (Task 10)

`npm run benchmark:load` hits the live HTTP API at 50 concurrent × 2K requests
with a mixed read profile (search 30% · profile 40% · dashboard stats 20% · list 10%)
and reports p50/p95/p99, throughput, error rate, and per-endpoint breakdown.
Also probes cache-hot (same search query twice, second hit < 5ms) and dashboard page load (< 2s).
Exits non-zero on gate failure; handles no-server gracefully (clear message, no crash).

Targets (spec §11, Gate C):

| Metric | Target | Notes |
| --- | --- | --- |
| p50 | < 100ms | overall |
| p95 | < 250ms | overall |
| errors | 0 | no error spikes |
| Redis hot query | < 5ms | second hit on same `search:` key (LRU hot path sub-ms → Redis) |
| Dashboard load | < 2s | GET /dashboard/admin (or /) under load |

Example run (local, Redis + seeded DB, dev server on 3000):

```
────────────────────────────────────────────────────────
  ERP v4 load test — Task 10 concurrency gate
────────────────────────────────────────────────────────
  base:           http://127.0.0.1:3000
  concurrency:    50 workers
  requests:       2000
  Completed 2000 requests in …  (… req/s)
  Overall latency (ms):
    p50    …   ✓ < 100ms
    p95    …   ✓ < 250ms
    errors 0 (0.00%)   ✓ 0 errors
  Per-endpoint breakdown:
    search / profile / stats / list  avg/p50/p95/p99/max + errors
  Cache-hot probe: second … ✓ < 5ms
  Dashboard load: … ✓ < 2s
  Gate: PASS ✓
────────────────────────────────────────────────────────
```

If the server is not running, the script prints:
`✗ Server not reachable. Could not connect to http://127.0.0.1:3000 — start the app first: npm run dev`
and exits 1 (gate FAIL, no crash).

## Project structure

```
src/
  app/                 Next.js routes (search, students/[id], admin, api)
  components/          UI + profile + admin components
  lib/
    search/            query classifier, index params, search runner, hooks
    seed/              synthetic data generation
    supabase/          client / server / service helpers
  scripts/
    seed.ts            40-year dataset generator
    benchmark.ts       latency probes over the seeded dataset
supabase/
  migrations/          0001 schema · 0002 indexes + RLS · 0003 grants · 0004 fixes
```

## Tests

```bash
npm test        # vitest: classifier, queries, search integration, seed, benchmark
npm run lint    # eslint
```
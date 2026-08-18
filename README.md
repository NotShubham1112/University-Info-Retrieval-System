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

# 3. Install dependencies
npm install

# 4. Start the app
npm run dev
```

Open http://localhost:3000, sign in at `/login`, and you'll land on `/search`.

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

Measured over the full synthetic dataset (80,000 students, 3.2M enrollments)
with `npm run benchmark` (20 iterations per probe):

| type | query | avg (ms) | min (ms) | max (ms) |
| --- | --- | --- | --- | --- |
| pnr | 22CS0001 | 4.21 | 2.25 | 21.56 |
| roll | 1045 | 2.80 | 2.27 | 3.49 |
| name | Rahul Sharma | 50.77 | 48.85 | 55.34 |
| name | Rahul | 14.17 | 13.12 | 15.22 |

Run it yourself:

```bash
npm run benchmark
```

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
# ERP v4 Architecture & Performance Design

Date: 2026-08-19
Status: Approved (pending user review)

## 1. Overview

Transform the current Next.js 16 + Supabase (PostgreSQL) student ERP from a v3-era
schema (~21 tables, university search focus) into a v4 enterprise-grade schema
(~35+ tables) with a performance layer designed so the API does not lag under high
request load — **without introducing any new infrastructure** (no Redis, no
BullMQ, no Docker, no separate backend service).

Key decisions:
- **Stack-native only.** Next.js API routes + Supabase Postgres remain the entire
  backend. Performance comes from Postgres-side optimization (indexes, views,
  materialized views, RPC functions) plus an in-process LRU cache and HTTP-layer
  caching.
- **Demo data.** `supabase db reset` is the intended reset path. Migrations are
  appended (`0005+`), never rewritten, preserving history and matching the v4
  image's ALTER/CREATE migration guide.
- **Extensible schema.** A modular migration convention plus a scaffold script
  make adding any new table a one-command, self-contained operation.
- **Benchmark-gated.** A concurrency load test against the real HTTP API is the
  performance gate: at 50 concurrent × 2K requests, **p50 < 100ms, p95 < 250ms,
  0 error spikes**. Hot cached queries should serve from memory (< 5ms).

## 2. Current Architecture Assessment

### 2.1 Stack

- Next.js 16 (App Router), React 19, TypeScript.
- Supabase (PostgreSQL) via `@supabase/ssr` + `@supabase/supabase-js`, postgREST.
- shadcn/ui + Tailwind CSS v4.
- Vitest for unit tests; a single-request search benchmark script exists.
- Seed script generates 40 years × 2000 students/year synthetic data.

### 2.2 Detected bottlenecks & anti-patterns

| # | Problem | Impact |
|---|---------|--------|
| B1 | Single-request benchmark only (avg/min/max, 20 iters) — no concurrency, no HTTP layer | No evidence the system survives burst load |
| B2 | N+1 / multi-round-trip profile queries (student + academic + fees + attendance fetched separately) | Slow profile page, high DB round-trips |
| B3 | No caching layer anywhere — every request hits Postgres | Pool saturation under load → latency spikes |
| B4 | RLS is "read for all authenticated" on every table | No real RBAC; any authenticated user reads everything |
| B5 | `guardians` as a separate table; `audit_logs` unstructured | v4 replaces both |
| B6 | No input validation (zod) on API routes | Malformed payloads reach the DB |
| B7 | No rate limiting | Auth/search abuse under load |
| B8 | Profile/admission/result/fee types in `src/types/database.ts` are v3-shaped | Must be regenerated for v4 |
| B9 | No pagination beyond the partial keyset on search | Large result sets → slow payloads |
| B10 | `aadhaar_number` (new) would be plaintext if naively added | Must be encrypted at rest |

### 2.3 Kept as-is (preserved functionality)

- Existing auth flow (Supabase email/password + route protection).
- Existing admin CRUD (students, courses, departments) — extended, not replaced.
- Existing student profile tabs — extended with v4 data.
- Document upload to Supabase Storage — metadata table upgraded.
- pg_trgm search infrastructure.

## 3. Database Design (v4 Schema)

### 3.1 Migration strategy

- Append `supabase/migrations/0005_schema_v4.sql` through `0008_*` (grouped
  logically). Existing `0001–0004` untouched.
- Each migration is self-contained for one concern (see Section 7 for the
  convention that makes future tables easy to add).

### 3.2 Table changes

**Modified tables:**

- `students` — add FKs/columns: `category_id → reservation_category(id)`,
  `abc_id`, `gender`, `aadhaar_number` (pgcrypto `PGP_SYM_ENCRYPT`, encrypted at
  rest, **never** selected by default), `address`, `photo_path`, `guardian_name`,
  `guardian_contact_number` (inline; drop `guardians` table).
- `programs` → replaced by `courses` with `branch_or_course`, `course_type`.
- `enrollments` → replaced by `admissions` (`admission_mode`, `seat_type`,
  `intake_stream`, `roll_number`, `expected_grad_year`).
- `subject_results` → replaced by `subject_marks` (`internal_marks`,
  `external_marks`, `attempt_number`).
- `fee_structures` → replaced by `fee_category_rates` (`year_of_study`,
  `academic_year`).
- `student_fees` + `payments` → merged into `fee_payments`
  (`scholarship_application_id` FK).
- `student_documents` → renamed `documents` (`verified_status`, `verified_by`,
  `verified_date`).
- `audit_logs` → removed; replaced by `student_status_history` for student status
  transitions.

**New tables:**

1. `reservation_category` — 14 categories (OPEN, OBC, SC, ST, EWS, NT, VINT, SBC,
   SFBC, MINORITY, TFWS, GEWS, CAP, I_CAP) with `code`, `name`, `parent_code`,
   `category_type`; seeded.
2. `intake_plan` — `course_id`, `batch_year`, `intake_stream`, `total_seats`,
   `general_open_seats`, `tfws_seats`, `ews_seats`, `reserved_breakdown` JSONB.
3. `category_seat_eligibility` — `category_id`, `seat_type`, `admission_mode`
   business rules.
4. `admissions` — per-student admission record (replaces enrollment concept).
5. `semester_records` — `student_id`, `semester_no`, `sgpa`, `result_status`,
   `declared_at`.
6. `academic_progress` — `student_id`, `current_semester`, `backlog_count`.
7. `backlogs` — `student_id`, `subject_id`, `attempt`, `cleared` flag.
8. `scholarships` + `scholarship_applications` — scholarship catalog + per-student
   applications (status, `fee_payments` link).
9. `extra_curricular`, `certifications`, `internships` — achievements.
10. `assignments` + `assignment_submissions` — coursework.
11. `student_status_history` — status transitions (replaces `audit_logs`).

### 3.3 Types

- `src/types/database.ts` regenerated to match v4: one interface per table, a
  `Db` namespace with `Tables`, `Enums`, `Functions`, `Views`.
- Supabase generated types (`supabase gen types`) become the single source of
  truth; hand-written interfaces kept only for view/RPC shapes.

### 3.4 Seed

- Rewrite `src/scripts/seed.ts` for v4: categories seeded first, then courses,
  intake plans, admissions (with seat-type/category assignment), semester
  records, subject_marks (internal/external split), fee_payments, documents,
  achievements, scholarships.
- Idempotency guard preserved (refuse double-seed).

## 4. Database Performance Layer

### 4.1 Indexes (composite/covering for real query paths)

- `students (campus_id, program_id)`, `students (category_id)`, trgm on
  `search_name` (existing).
- `admissions (student_id)`, `admissions (intake_stream, batch_year)`.
- `subject_marks (enrollment_id, attempt_number)`, `subject_marks (subject_id)`.
- `semester_records (student_id, semester_no)`.
- `fee_payments (student_id, payment_date)`, `fee_payments (status)`.
- `backlogs (student_id, cleared)`.
- `documents (student_id)`, `student_status_history (student_id)`.
- `intake_plan (course_id, batch_year)`.

### 4.2 Views (kill N+1)

- `student_summary` view: joins `students` + `admissions` +
  `academic_progress` + latest `semester_records` — the profile page reads one
  row instead of 4+ round-trips.

### 4.3 Materialized views (reports/dashboards)

- Fee collection by course/year.
- Admission counts by category/seat-type/year.
- Pass rates by course/semester.
- Refreshed on-demand (documented RPC `refresh_report_views()`), never in the
  request path.

### 4.4 RPC functions

- `search_students(q, limit, cursor)` — keyset search in one round-trip.
- `dashboard_stats(...)` — report aggregations.
- Reduces postgREST overhead; enables prepared statements.

## 5. API Optimization

### 5.1 Caching (in-process LRU)

- New dependency: `lru-cache`.
- Shared layer `src/lib/cache/index.ts`:
  - student profile → TTL 60s
  - search results → TTL 10s
  - fee/course/reference lists → TTL 300s
  - cache key = method + URL + relevant query params
- Invalidated on mutation (admin writes bust the affected keys). Single-instance
  in-process cache — acceptable for demo; documented as non-horizontally-scalable.

### 5.2 HTTP-layer caching

- `Cache-Control` headers on read-only GET routes; Next.js `revalidate` where
  applicable.
- Response compression: verify `compress` is effective in production build.

### 5.3 Pagination, validation, protection

- Cursor/keyset pagination extended to all list endpoints.
- **zod** DTO validation on every API route (request body, query params, params).
- **Rate limiting** in `middleware.ts`: in-process sliding window per IP on
  `/api/*` (300 req/min general; stricter on auth routes).
- Query batching where multiple small fetches can become one `in` filter.

## 6. Authentication & Security

- **RBAC permission matrix**: roles `admin`, `registrar`, `faculty`, `student`;
  granular permission keys (`student:write`, `fees:read`, `docs:verify`, ...).
  Enforced in API routes (server-side) **and** RLS policies (row-level).
- **RLS upgrade**: replace "read for all authenticated" with role-aware policies
  per table.
- **Audit**: structured `student_status_history` + a scoped audit table for
  sensitive writes (fees, document verification).
- **Aadhaar at rest**: pgcrypto `PGP_SYM_ENCRYPT`, key from env; excluded from
  all list projections; never returned by default; only decrypted for authorized
  admin reads.
- **OWASP pass**: zod validation, rate limiting, `next.config` security headers
  (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy), auth token
  lifetime review, no secrets in client bundles.

## 7. Extensibility: Adding Tables Is Easy

Target developer experience: **adding a new table = one command, self-contained,
consistent with every other table.**

### 7.1 Migration convention

- One migration per concern: `supabase/migrations/NNNN_<slug>.sql`.
- Every table migration is **self-contained** and includes, in order:
  1. `create table`
  2. indexes (naming: `idx_<table>_<columns>`)
  3. `alter table ... enable row level security`
  4. RLS policies (read_authenticated base + role-specific)
  5. grants
  6. (optional) seed rows
- Naming: snake_case, singular table names, `id bigint generated always as
  identity primary key`, `created_at`/`updated_at timestamptz not null default
  now()`.

### 7.2 Scaffold script

- `npm run add-table -- <name>` runs `src/scripts/scaffold-table.ts` and
  generates:
  - a numbered migration file with the full template (table + index stubs + RLS
    + policy + grants)
  - a TypeScript interface stub + `Db.Tables` entry in `src/types/database.ts`
  - an optional seed stub
- Template is shared so every new table follows the same shape.

### 7.3 Documentation

- `docs/schema-conventions.md`: naming, index rules, RLS patterns, grants,
  view/RPC rules, aadhaar/encryption rules, when to use a materialized view.

## 8. Frontend Performance

- Server components for static sections; profile tabs lazy-loaded (already done,
  extended for v4 data).
- **TanStack Query** (new dep) replaces ad-hoc `use-section-data` fetches for
  client data: caching, refetch windows, dedupe.
- Dynamic imports for heavy components; review `next build` bundle report.
- Streaming/Suspense on the profile page.

## 9. Reporting & Analytics

- Reports served from materialized views + RPC functions — no ad-hoc heavy
  aggregation in request paths.
- `refresh_report_views()` documented; refresh scheduling left to manual/CLI for
  demo (no new infra).

## 10. Testing & Benchmark Gates

### 10.1 Unit (vitest)

- Cache layer (hit/miss/expiry/invalidation).
- Rate limiter (window, burst, per-IP isolation).
- zod DTOs (accept/reject).
- Search classifier + pagination helpers.
- Seed generators (existing tests extended).

### 10.2 Integration

- Lib layers against mocked supabase client; RPC/view shapes verified via local
  Supabase reset + smoke queries.

### 10.3 Load test (performance gate)

- New script `src/scripts/load-test.ts` (worker-thread loader) hitting the local
  API at 50 concurrent × 2K requests; reports p50/p95/p99, throughput, error rate.
- Gate: p50 < 100ms, p95 < 250ms, 0 error spikes.

### 10.4 Scope note

- E2E browser tests deferred (unit + integration + load test in this pass).

## 11. Execution Approach

- One implementation plan (writing-plans), executed subagent-driven:
  - Task 1: schema v4 migrations + types + seed
  - Task 2: DB performance layer (indexes, views, materialized views, RPCs)
  - Task 3: cache layer + API optimization (zod, pagination, cache headers,
    rate limiting)
  - Task 4: security/RBAC + audit + aadhaar encryption
  - Task 5: frontend performance (TanStack Query, dynamic imports, streaming)
  - Task 6: tests + load-test benchmark
  - Task 7: extensibility tooling (scaffold script + conventions doc)
- Each task: implementer subagent → task review → fix loop; final whole-branch
  review.

## 12. Non-Goals (explicit)

- No Redis, BullMQ, Docker, Kubernetes, Prometheus/Grafana, or any new
  infrastructure.
- No read/write replication or horizontal scaling.
- No E2E browser test suite in this pass.
- No data migration of existing demo records (reset-safe).

## 13. Deliverables

- Appended v4 migrations (`0005+`).
- Regenerated `src/types/database.ts` + seed.
- `student_summary` view, materialized report views, RPC functions.
- `src/lib/cache` LRU layer; zod DTOs; rate limiting middleware.
- RBAC permission matrix + RLS upgrade + aadhaar encryption.
- TanStack Query integration; frontend perf pass.
- `src/scripts/load-test.ts` + benchmark gates in README.
- `src/scripts/scaffold-table.ts` + `docs/schema-conventions.md`.
# ERP v4 Architecture & Performance Design

Date: 2026-08-19
Status: Approved (pending user review)

## 1. Overview

Transform the current Next.js 16 + Supabase (PostgreSQL) student ERP from a v3-era
schema (~21 tables, university search focus) into a v4 enterprise-grade schema
(~40+ tables) with:

- A **high-performance API layer** that does not lag under heavy request load.
- A **dual-dashboard** experience: the existing dashboard preserved as the
  read-only **Viewer**, plus a new full-CRUD **Admin Data Entry Dashboard**.
- A **Redis cache** (Docker) as the primary cache with an in-process LRU hot path.
- An **extensible schema**: adding a new table is a one-command, self-contained
  operation.

Data access remains Supabase postgREST (no ORM — explicitly decided). Demo data:
`supabase db reset` is the reset path; migrations are appended (`0005+`), never
rewritten.

### Key decisions

- **No new backend service.** Next.js API routes + Supabase Postgres remain the
  entire backend. Performance comes from Postgres-side optimization (indexes,
  views, materialized views, RPC functions), a Redis cache (Docker), and an
  in-process LRU hot path.
- **Redis is in scope** via `docker-compose.yml` (overrides the earlier
  stack-native caching constraint — caching only; no queues, no observability
  stack).
- **Demo data / reset-safe.** Migrations appended (`0005+`), never rewritten.
- **Extensible schema.** Modular migration convention + scaffold script.
- **Benchmark-gated.** Concurrency load test against the real HTTP API: at 50
  concurrent × 2K requests, **p50 < 100ms, p95 < 250ms, 0 error spikes**;
  dashboard load < 2s; Redis-served hot queries < 5ms.

## 2. Current Architecture Assessment

### 2.1 Stack

- Next.js 16 (App Router), React 19, TypeScript.
- Supabase (PostgreSQL) via `@supabase/ssr` + `@supabase/supabase-js`, postgREST.
- shadcn/ui + Tailwind CSS v4 (`base-nova` style, `components.json` present).
- Vitest for unit tests; a single-request search benchmark script exists.
- Seed script generates 40 years × 2000 students/year synthetic data.

### 2.2 Detected bottlenecks & anti-patterns

| # | Problem | Impact |
|---|---------|--------|
| B1 | Single-request benchmark only — no concurrency, no HTTP layer | No evidence the system survives burst load |
| B2 | N+1 / multi-round-trip profile queries (student + academic + fees + attendance fetched separately) | Slow profile page, high DB round-trips |
| B3 | No caching layer anywhere — every request hits Postgres | Pool saturation under load → latency spikes |
| B4 | RLS is "read for all authenticated" on every table | No real RBAC; any authenticated user reads everything |
| B5 | `guardians` separate table; `audit_logs` unstructured | v4 replaces both |
| B6 | No input validation (zod) on API routes | Malformed payloads reach the DB |
| B7 | No rate limiting | Auth/search abuse under load |
| B8 | Types in `src/types/database.ts` are v3-shaped | Must be regenerated for v4 |
| B9 | No pagination beyond partial keyset on search | Large result sets → slow payloads |
| B10 | `aadhaar_number` (new) would be plaintext if naively added | Must be encrypted at rest |
| B11 | Admin surface is only a few linked CRUD forms | No real data-entry workflow; no bulk import/export, dashboards, or module management |
| B12 | Client data fetched via ad-hoc `use-section-data` fetches | No caching/dedupe; refetch storms under load |

### 2.3 Kept as-is (preserved functionality)

- Existing auth flow (Supabase email/password + route protection).
- `/search`, `/admin`, `/students/[id]` — **unchanged**.
- Existing student profile tabs — extended with v4 data.
- Document upload to Supabase Storage — metadata table upgraded.
- pg_trgm search infrastructure.

## 3. Database Design (v4 Schema)

### 3.1 Migration strategy

- Append `supabase/migrations/0005_*` onward, grouped logically. Existing
  `0001–0004` untouched.
- Each migration is self-contained for one concern (see Section 8 for the
  convention that makes future tables easy to add).

### 3.2 Table changes

**Modified tables:**

- `students` — add FKs/columns: `category_id → reservation_category(id)`,
  `abc_id`, `gender`, `aadhaar_number` (pgcrypto `PGP_SYM_ENCRYPT`, encrypted at
  rest, **never** selected by default), `address`, `city`, `state`, `country`,
  `blood_group`, `photo_path`, `guardian_name`, `guardian_contact_number`
  (inline; drop `guardians` table).
- `programs` → replaced by `courses` (`branch_or_course`, `course_type`,
  `duration_years`, `credits`, `description`).
- `enrollments` → replaced by `admissions` (`admission_mode`, `seat_type`,
  `intake_stream`, `roll_number`, `expected_grad_year`).
- `subject_results` → replaced by `subject_marks` (`internal_marks`,
  `external_marks`, `attempt_number`, `exam_id` FK).
- `fee_structures` → replaced by `fee_category_rates` (`year_of_study`,
  `academic_year`).
- `student_fees` + `payments` → merged into `fee_payments`
  (`scholarship_application_id` FK); receipt view derived from `fee_payments`.
- `student_documents` → renamed `documents` (`verified_status`, `verified_by`,
  `verified_date`).
- `audit_logs` → removed; replaced by `student_status_history`.

**New tables (v4 core):**

1. `reservation_category` — 14 categories (OPEN, OBC, SC, ST, EWS, NT, VINT, SBC,
   SFBC, MINORITY, TFWS, GEWS, CAP, I_CAP) with `code`, `name`, `parent_code`,
   `category_type`; seeded.
2. `intake_plan` — `course_id`, `batch_year`, `intake_stream`, `total_seats`,
   `general_open_seats`, `tfws_seats`, `ews_seats`, `reserved_breakdown` JSONB.
3. `category_seat_eligibility` — `category_id`, `seat_type`, `admission_mode`.
4. `admissions` — per-student admission record.
5. `semester_records` — `student_id`, `semester_no`, `sgpa`, `result_status`,
   `declared_at`.
6. `academic_progress` — `student_id`, `current_semester`, `backlog_count`.
7. `backlogs` — `student_id`, `subject_id`, `attempt`, `cleared`.
8. `scholarships` + `scholarship_applications`.
9. `extra_curricular`, `certifications`, `internships` — achievements.
10. `assignments` + `assignment_submissions` — coursework.
11. `student_status_history` — status transitions.

**New tables (admin ERP modules):**

12. `teachers` — replaces `faculty`: `employee_id`, `department_id`,
    `designation`, `email`, `phone`, `joining_date`, `salary` (numeric, not
    projected by default), `status`.
13. `exams` — `course_id`, `semester_no`, `exam_type` (midterm/final), `date`,
    `status` (draft/scheduled/published).
14. `exam_subjects` — `exam_id`, `subject_id`, `max_marks`, `pass_marks`.
15. `rooms` — `name`, `building`, `capacity`.
16. `timetables` — `course_id`, `semester_no`, `day_of_week`, `period_no`,
    `subject_id`, `teacher_id`, `room_id`.
17. `notifications` — `title`, `body`, `type`, `priority`, `channel`
    (in-app/email/sms), `sent_at`.
18. `notification_recipients` — `notification_id`, `recipient_role` or
    `student_id`, `status` (unread/read).

### 3.3 Types

- `src/types/database.ts` regenerated to match v4: one interface per table, a
  `Db` namespace with `Tables`, `Enums`, `Functions`, `Views`.
- Supabase generated types (`supabase gen types`) become the single source of
  truth; hand-written interfaces kept only for view/RPC shapes.

### 3.4 Seed

- Rewrite `src/scripts/seed.ts` for v4: categories → courses → intake plans →
  departments → teachers → rooms → exams → students → admissions (seat-type/
  category assignment) → semester records → subject_marks (internal/external
  split, per exam) → timetables → fee_payments → documents → achievements →
  scholarships → notifications.
- Idempotency guard preserved (refuse double-seed).

## 4. Database Performance Layer

### 4.1 Indexes (composite/covering for real query paths)

- `students (campus_id, program_id)`, `students (category_id)`, trgm on
  `search_name` (existing).
- `admissions (student_id)`, `admissions (intake_stream, batch_year)`.
- `subject_marks (enrollment_id, attempt_number)`, `subject_marks (subject_id)`,
  `subject_marks (exam_id)`.
- `semester_records (student_id, semester_no)`.
- `fee_payments (student_id, payment_date)`, `fee_payments (status)`.
- `backlogs (student_id, cleared)`.
- `documents (student_id)`, `student_status_history (student_id)`.
- `intake_plan (course_id, batch_year)`.
- `timetables (teacher_id, day_of_week)`, `timetables (room_id, day_of_week)`.
- `teachers (department_id)`, `teachers (email)` unique.
- `exams (course_id, semester_no)`, `notification_recipients (recipient_role)`.

### 4.2 Views (kill N+1)

- `student_summary` view: joins `students` + `admissions` + `academic_progress` +
  latest `semester_records` — the profile page reads one row instead of 4+
  round-trips.

### 4.3 Materialized views (reports/dashboards)

- Fee collection by course/year.
- Admission counts by category/seat-type/year.
- Pass rates by course/semester.
- Attendance summary by course/semester.
- Refreshed on-demand (documented RPC `refresh_report_views()`), never in the
  request path.

### 4.4 RPC functions

- `search_students(q, limit, cursor)` — keyset search in one round-trip.
- `dashboard_stats(...)` — widget/report aggregations (total students, teachers,
  courses, attendance %, pending fees, upcoming exams, active users).
- Reduces postgREST overhead; enables prepared statements.

## 5. Caching Architecture

### 5.1 Layered cache

```
API route → [Redis cache (primary)] → [in-process LRU hot path] → Supabase
```

- **Redis** via `docker-compose.yml` (`redis:7-alpine`, port 6379, volume for
  persistence). Client: `node-redis`.
- **LRU** (`lru-cache`) as a sub-ms in-process fast path in front of Redis for
  the hottest keys.
- `src/lib/cache/index.ts` exports `get`, `set`, `del`, `invalidate(pattern)`.
- TTLs:
  - student profile → 60s
  - search results → 10s
  - fee/course/reference lists → 300s
  - dashboard stats → 30s
  - auth/session data → not cached (never cache secrets or PII)
- Cache key = method + URL + relevant query params.
- Invalidation: mutations call `invalidate()` for affected key patterns.
- Redis-unavailable fallback: LRU only (degraded, non-fatal).

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

- **RBAC permission matrix** — five roles: `super_admin`, `admin`, `teacher`,
  `accountant`, `viewer`. Granular permission keys (`student:write`,
  `student:delete`, `fees:read`, `fees:approve`, `docs:verify`,
  `timetable:write`, `exam:publish`, ...). Enforced in API routes (server-side)
  **and** RLS policies (row-level).
- **RLS upgrade**: replace "read for all authenticated" with role-aware policies
  per table.
- **Audit**: structured `student_status_history` + a scoped audit table for
  sensitive writes (fees, document verification, role changes).
- **Aadhaar at rest**: pgcrypto `PGP_SYM_ENCRYPT`, key from env; excluded from
  all list projections; never returned by default; only decrypted for authorized
  admin reads.
- **OWASP pass**: zod validation, rate limiting, `next.config` security headers
  (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy), auth token
  lifetime review, no secrets in client bundles.

## 7. Dual-Dashboard Experience

### 7.1 Routes

- Existing `/search`, `/admin`, `/students/[id]` — **unchanged**.
- **`/dashboard/viewer`** — read-only analytics dashboard (server components,
  no write controls).
- **`/dashboard/admin`** — full data-entry ERP (foundation: shadcn `dashboard-01`
  block, customized).
- RBAC middleware gates access: viewer = read-only; admin tree requires
  `student:write`+ or `super_admin`/`admin`.

### 7.2 Admin modules (all: RHF + Zod + TanStack Query + optimistic updates +
dialogs + data tables + import/export)

1. **Students** — Add/Edit/Delete/Upload Documents/View Profile/Bulk CSV import;
   fields per Section 3.2.
2. **Teachers** — full CRUD.
3. **Courses** — CRUD (v4 `courses`).
4. **Attendance** — mark attendance, bulk upload, daily/monthly reports, %
   calculation.
5. **Exams** — exam creation, subject mapping (`exam_subjects`), marks entry
   (`subject_marks`), grade generation, result publishing (`semester_records`).
6. **Fees** — fee structure (`fee_category_rates`), student payments
   (`fee_payments`), pending fees, payment history, receipts.
7. **Timetable** — class schedules, teacher schedules, room allocation.
8. **Notifications** — send (in-app; email/SMS as channel placeholders), student
   announcements, read receipts.
9. **Dashboard widgets** — Total Students, Teachers, Courses, Attendance %,
   Pending Fees, Upcoming Exams, Active Users (backed by `dashboard_stats` RPC).

### 7.3 Form requirements

Every form: client validation (zod + RHF), server validation (zod DTOs),
loading states, success notifications (toast), error handling, confirmation
dialogs (delete/destructive), TanStack Query mutations with optimistic updates.

**Autosave + draft** (scoped, per approval): debounced autosave + localStorage
draft persistence **only** on the longest forms — student add/edit and bulk
import. Not on every form.

### 7.4 UI

- shadcn/ui + Tailwind; `dashboard-01` block as the admin foundation.
- Components: data tables (pagination), dialogs, drawers/sheets, tabs, cards,
  charts, dropdowns, date pickers, multi-selects.
- Responsive; modern SaaS ERP look.
- Viewer: read-only table + stats cards; no mutation controls.

## 8. Extensibility: Adding Tables Is Easy

Target developer experience: **adding a new table = one command, self-contained,
consistent with every other table.**

### 8.1 Migration convention

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

### 8.2 Scaffold script

- `npm run add-table -- <name>` runs `src/scripts/scaffold-table.ts` and
  generates:
  - a numbered migration file with the full template (table + index stubs + RLS
    + policy + grants)
  - a TypeScript interface stub + `Db.Tables` entry in `src/types/database.ts`
  - an optional seed stub
- Template is shared so every new table follows the same shape.

### 8.3 Documentation

- `docs/schema-conventions.md`: naming, index rules, RLS patterns, grants,
  view/RPC rules, aadhaar/encryption rules, when to use a materialized view,
  when to add a Redis-cached endpoint.

## 9. Frontend Performance

- Server components for static sections; profile tabs lazy-loaded (already done,
  extended for v4 data).
- **TanStack Query** for client data: caching, refetch windows, dedupe,
  optimistic mutations.
- Dynamic imports for heavy components; review `next build` bundle report.
- Streaming/Suspense on the profile and dashboard pages.

## 10. Reporting & Analytics

- Reports served from materialized views + RPC functions — no ad-hoc heavy
  aggregation in request paths.
- `refresh_report_views()` documented; refresh scheduling left to manual/CLI for
  demo (no queue infra).

## 11. Testing & Benchmark Gates

### 11.1 Unit (vitest)

- Cache layer (Redis + LRU: hit/miss/expiry/invalidation, Redis-down fallback).
- Rate limiter (window, burst, per-IP isolation).
- zod DTOs (accept/reject).
- Search classifier + pagination helpers.
- Seed generators (existing tests extended).

### 11.2 Integration

- Lib layers against mocked supabase client; RPC/view shapes verified via local
  Supabase reset + smoke queries.

### 11.3 Load test (performance gate)

- New script `src/scripts/load-test.ts` (worker-thread loader) hitting the local
  API at 50 concurrent × 2K requests; reports p50/p95/p99, throughput, error rate.
- Gate: p50 < 100ms, p95 < 250ms, 0 error spikes; dashboard load < 2s;
  Redis-served hot queries < 5ms.

### 11.4 Scope note

- E2E browser tests deferred (unit + integration + load test in this pass).

## 12. Execution Approach

- One implementation plan (writing-plans), executed subagent-driven:
  - Task 0: Docker + Redis setup (`docker-compose.yml`, `node-redis` client,
    env vars, Redis health check).
  - Task 1: schema v4 migrations + types + seed.
  - Task 2: DB performance layer (indexes, views, materialized views, RPCs).
  - Task 3: cache layer + API optimization (zod, pagination, cache headers,
    rate limiting).
  - Task 4: security/RBAC + audit + aadhaar encryption.
  - Task 5: dual-dashboard scaffold (`dashboard-01` block, routes, RBAC
    middleware, layout).
  - Task 6: admin modules (students, teachers, courses, attendance, exams, fees,
    timetable, notifications, widgets) + viewer dashboard.
  - Task 7: frontend performance (TanStack Query, dynamic imports, streaming).
  - Task 8: tests + load-test benchmark.
  - Task 9: extensibility tooling (scaffold script + conventions doc).
- Each task: implementer subagent → task review → fix loop; final whole-branch
  review.

## 13. Non-Goals (explicit)

- No separate backend service, no ORM (Supabase postgREST remains the data
  layer).
- No queue infra (BullMQ), no observability stack (Prometheus/Grafana), no
  Kubernetes.
- No horizontal scaling / read-write replication.
- No E2E browser test suite in this pass.
- No SMTP/SMS sending — email/SMS are channel placeholders only.
- No data migration of existing demo records (reset-safe).

## 14. Deliverables

- Appended v4 migrations (`0005+`) + regenerated types + seed.
- `student_summary` view, materialized report views, RPC functions.
- Redis cache layer (`src/lib/cache`) + `docker-compose.yml`.
- zod DTOs; rate limiting middleware; pagination everywhere.
- RBAC permission matrix + RLS upgrade + aadhaar encryption.
- `/dashboard/admin` (full data-entry ERP) + `/dashboard/viewer` (read-only) on
  the `dashboard-01` foundation; existing routes unchanged.
- TanStack Query + RHF + Zod form layer; import/export; widgets.
- `src/scripts/load-test.ts` + benchmark gates in README.
- `src/scripts/scaffold-table.ts` + `docs/schema-conventions.md`.
- New deps: `lru-cache`, `@tanstack/react-query`, `react-hook-form`,
  `@hookform/resolvers`, `zod`, `redis` (node-redis).
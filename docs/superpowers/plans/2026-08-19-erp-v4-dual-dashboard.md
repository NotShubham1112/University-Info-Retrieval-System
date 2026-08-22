# ERP v4 Dual-Dashboard Implementation Plan

Date: 2026-08-19
Status: Approved — ready to execute (subagent-driven)

## 1. Context

This plan implements the approved spec
(`docs/superpowers/specs/2026-08-19-erp-v4-architecture-design.md`, committed at
`8f467dd` + `029659b`) on the existing Next.js 16 + Supabase ERP at
`D:\University Info Retrieval System`.

The system today is a search-first university portal (Next.js App Router +
Supabase postgREST, no ORM) with a v3-era schema (~21 tables), a single-request
benchmark only, no caching, weak RLS, and a few ad-hoc admin CRUD forms. It must
become a v4 enterprise-grade ERP (~40+ tables) with a dual-dashboard experience
(read-only viewer + full data-entry admin), a Redis cache (Docker), RBAC/RLS,
and a concurrency load-test gate.

Data access stays **Supabase postgREST only** (no ORM — decided). Demo data:
`supabase db reset` is the reset path; migrations are appended (`0005+`),
never rewritten.

## 2. Goals (locked decisions)

- G1 — **Performance without lag.** Postgres-side optimization (indexes, views,
  materialized views, RPC functions) + Redis cache (Docker) + in-process LRU hot
  path. Gate: 50 concurrent × 2K requests → **p50 < 100ms, p95 < 250ms, 0 error
  spikes**; dashboard load < 2s; Redis-served hot queries < 5ms.
- G2 — **Dual dashboard.** Existing `/search`, `/admin`, `/students/[id]`
  **unchanged**. New `/dashboard/viewer` (read-only) and `/dashboard/admin`
  (full data-entry ERP on the shadcn `dashboard-01` foundation).
- G3 — **Extensible schema.** Adding a table = one command (`npm run add-table
  -- <name>`), self-contained migration, shared template,
  `docs/schema-conventions.md`.
- G4 — **Demo data / reset-safe.** Migrations appended, seed idempotent.
- G5 — **RBAC + security.** Five roles; permission keys enforced server-side and
  in RLS; Aadhaar encrypted at rest (app-side AES-256-GCM, never projected by
  default); zod validation on every route; rate limiting in middleware.
- G6 — **Client data layer.** TanStack Query (caching/dedupe/optimistic
  mutations) + React Hook Form + Zod on every admin form.
- G7 — **Autosave + draft** only on the longest forms: student add/edit and bulk
  import. Not on every form.
- G8 — Email/SMS are **channel placeholders only** (no SMTP/SMS sending).

## 3. Prerequisites (stack facts)

- P1 — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui
  (`base-nova` style, `components.json` present).
- P2 — Supabase local via CLI at `127.0.0.1:54321`. Migrations `0001–0004`
  present. `src/types/database.ts` is v3-shaped (must be regenerated).
- P3 — `src/scripts/seed.ts` (40 years × 2000 students/year, BATCH 500,
  idempotency guard) and `src/scripts/benchmark.ts` (single-request) exist.
- P4 — Docker available (needed for Redis).
- P5 — `.env.example` has `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Will add:
  `REDIS_URL`, `REDIS_ENABLED`, `REDIS_CONNECT_TIMEOUT_MS`,
  `AADHAAR_ENCRYPTION_KEY`, `RATE_LIMIT_PER_MINUTE`.
- P6 — Existing libs: `src/lib/supabase/{server,service,client,middleware}.ts`,
  `src/lib/db.ts`, `src/lib/admin.ts`, `src/lib/search/*`, `src/middleware.ts`.
- P7 — Vitest configured for unit tests.

## 4. Task list

| # | Task | Verify |
|---|------|--------|
| 0 | Docker + Redis setup | `docker compose up -d redis`; cache unit tests pass |
| 1 | Schema v4 migrations + types + seed | `supabase db reset` + seed smoke queries |
| 2 | DB performance layer (views, matviews, RPCs) | smoke queries against local Supabase |
| 3 | Cache layer + API optimization (zod, pagination, rate limit, headers) | unit tests + route smoke |
| 4 | Security & RBAC (crypto, permission matrix, RLS, audit) | unit tests + route-level RBAC checks |
| 5 | Dual-dashboard scaffold (layout, routes, RBAC middleware) | dev-server route smoke |
| 6 | Admin modules — Students (reference module) | CRUD + CSV import + autosave tests |
| 7 | Admin modules — Teachers, Courses, Attendance | CRUD + bulk attendance tests |
| 8 | Admin modules — Exams, Fees, Timetable, Notifications + widgets | CRUD + RPC-backed widgets |
| 9 | Frontend performance (TanStack provider, dynamic imports, streaming) | `next build` + load < 2s |
| 10 | Tests + concurrency load test | vitest pass + load-test gate |
| 11 | Extensibility tooling (scaffold + conventions doc) | `npm run add-table` generates template |

## 5. Verification gates

- **Gate A (every task):** `npx tsc --noEmit` clean; `npx vitest run` passes
  for that task's tests; `npm run lint` clean.
- **Gate B (Task 1):** `npx supabase db reset` completes; seed runs; smoke
  queries return v4 columns (courses, admissions, fee_payments, etc.).
- **Gate C (Task 10):** `npx tsx src/scripts/load-test.ts` → p50 < 100ms,
  p95 < 250ms at 50 concurrent × 2K, 0 error spikes. Dashboard load < 2s.
- **Gate D (final):** whole-branch review; README updated with new setup,
  Redis, seed, benchmark commands.

Execution model: subagent-driven. Each task: implementer subagent → task review
→ fix loop. The reviewer never writes code; findings go back to the implementer.
No commit is made until a task's gates pass and the review is clean.

## Task 0 — Docker + Redis setup

**Goal:** A runnable Redis for local dev with a thin, tested client wrapper.

**Files:**
- `docker-compose.yml` (new)
- `.env.example` (add Redis vars)
- `package.json` (add `redis` dep + `db:redis:up`/`db:redis:down` scripts)
- `src/lib/cache/redis.ts` (new)
- `src/lib/cache/__tests__/redis.test.ts` (new)

**Steps:**

1. **Dependency.** `npm install redis` (node-redis). Confirm it lands in
   `dependencies` (not devDependencies).

2. **docker-compose.yml.** Add a root-level compose file:

   ```yaml
   services:
     redis:
       image: redis:7-alpine
       container_name: erp-redis
       ports:
         - "6379:6379"
       command: ["redis-server", "--appendonly", "yes"]
       volumes:
         - redis-data:/data
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 5s
         timeout: 3s
         retries: 5
   volumes:
     redis-data:
   ```

3. **Env vars.** Append to `.env.example`:

   ```
   REDIS_URL=redis://127.0.0.1:6379
   REDIS_ENABLED=true
   REDIS_CONNECT_TIMEOUT_MS=1000
   ```

4. **Client wrapper** `src/lib/cache/redis.ts`:
   - Singleton `getRedisClient()` using `createClient({ url, socket: {
     connectTimeout } })`, lazy connect, idempotent.
   - Exports: `redisGet(key)`, `redisSet(key, value, ttlSeconds)`,
     `redisDel(key)`, `redisPing()` (used for health check), `isRedisEnabled()`
     (reads `REDIS_ENABLED`), `closeRedis()`.
   - **Redis-unavailable is non-fatal**: all helpers return `null`/`false` and
     log a single warn on connection failure; never throw into the request path.
   - JSON values are `JSON.stringify`'d on set and `JSON.parse`'d on get
     (guard against parse errors → return `null`).

5. **Unit tests** `src/lib/cache/__tests__/redis.test.ts`:
   - Mock the `redis` module (`vi.mock`) so no real connection is needed.
   - Cover: `redisSet`+`redisGet` round-trip with JSON, expiry honored (TTL
     passed to client), `redisDel`, `isRedisEnabled()===false` short-circuits
     without touching the client, connection failure returns `null` (fallback
     path).

6. **Verify (Gate A):**
   - `docker compose up -d redis` (print the health status; if Docker Desktop is
     not running, note it as a blocker and ask).
   - `npx vitest run src/lib/cache` passes.
   - `npx tsc --noEmit` clean, `npm run lint` clean.

## Task 1 — Schema v4 migrations + types + seed

**Goal:** Append v4 schema (`0005+`) exactly per spec §3.2, regenerate types,
rewrite seed.

**Files:**
- `supabase/migrations/0005_v4_core.sql` (new)
- `supabase/migrations/0006_v4_academics.sql` (new)
- `supabase/migrations/0007_v4_erp.sql` (new)
- `supabase/migrations/0008_v4_rbac_seed.sql` (new)
- `supabase/migrations/0009_v4_indexes_rls.sql` (new)
- `src/types/database.ts` (regenerated)
- `src/scripts/seed.ts` (rewritten)
- `package.json` (scripts: `db:types`, `db:seed`)

**Steps:**

1. **0005_v4_core.sql — core + reference data.** In dependency order:
   `reservation_category` (14 seeded categories with `code`, `name`,
   `parent_code`, `category_type`), `courses` (replaces `programs`:
   `branch_or_course`, `course_type`, `duration_years`, `credits`,
   `description`; backfill from `programs` before dropping it), `departments`,
   `teachers` (replaces `faculty`: `employee_id`, `department_id`,
   `designation`, `email` unique, `phone`, `joining_date`, `salary` numeric not
   projected by default, `status`), `rooms`, `intake_plan` (`course_id`,
   `batch_year`, `intake_stream`, `total_seats`, `general_open_seats`,
   `tfws_seats`, `ews_seats`, `reserved_breakdown` JSONB),
   `category_seat_eligibility` (`category_id`, `seat_type`, `admission_mode`).

2. **0005_v4_core.sql — modify `students`.** Add columns: `category_id` FK,
   `abc_id`, `gender`, `aadhaar_number` (text; holds the app-side AES-256-GCM
   encrypted value — see Task 4; never select it in default column lists),
   `aadhaar_hash` (text; deterministic SHA-256 of the plaintext — **unique
   index on this**, never on the ciphertext, which is non-deterministic),
   `address`, `city`, `state`, `country`, `blood_group`, `photo_path`,
   `guardian_name`, `guardian_contact_number` (inline; drop `guardians`
   table). `programs` → `courses` rename with data backfill, then drop
   `programs`.

3. **0006_v4_academics.sql — academics.** `enrollments` → `admissions`
   (`admission_mode`, `seat_type`, `intake_stream`, `roll_number`,
   `expected_grad_year`; backfill from enrollments, then drop). `subject_results`
   → `subject_marks` (`internal_marks`, `external_marks`, `attempt_number`,
   `exam_id` FK). `semester_records` (`student_id`, `semester_no`, `sgpa`,
   `result_status`, `declared_at`). `academic_progress` (`student_id`,
   `current_semester`, `backlog_count`). `backlogs` (`student_id`, `subject_id`,
   `attempt`, `cleared`). `exams` (`course_id`, `semester_no`, `exam_type`
   midterm/final, `date`, `status` draft/scheduled/published). `exam_subjects`
   (`exam_id`, `subject_id`, `max_marks`, `pass_marks`).

4. **0007_v4_erp.sql — ERP modules.** `fee_category_rates` (replaces
   `fee_structures`: `year_of_study`, `academic_year`). `fee_payments` (merges
   `student_fees` + `payments`: `scholarship_application_id` FK; backfill from
   both, then drop). `documents` (rename `student_documents`; add
   `verified_status`, `verified_by`, `verified_date`). `scholarships` +
   `scholarship_applications`. `extra_curricular`, `certifications`,
   `internships`. `assignments` + `assignment_submissions`. `timetables`
   (`course_id`, `semester_no`, `day_of_week`, `period_no`, `subject_id`,
   `teacher_id`, `room_id`). `notifications` (`title`, `body`, `type`,
   `priority`, `channel` in-app/email/sms, `sent_at`) + `notification_recipients`
   (`recipient_role` or `student_id`, `status` unread/read).
   `student_status_history` (status transitions). Drop `audit_logs`.

5. **0008_v4_rbac_seed.sql — RBAC seed.** Tables: `permissions`, `role_permissions`.
   Seed rows for roles `super_admin`, `admin`, `teacher`, `accountant`, `viewer`
   and permission keys: `student:write`, `student:delete`, `fees:read`,
   `fees:approve`, `docs:verify`, `timetable:write`, `exam:publish`,
   `teacher:write`, `course:write`, `attendance:write`, `notification:send`.
   Default grant matrix: `super_admin` = all; `admin` = all except
   `student:delete`+`docs:verify` optional (decide: admin gets
   `student:delete`); `teacher` = `attendance:write`, `exam:publish`,
   `timetable:write`; `accountant` = `fees:read`, `fees:approve`; `viewer` = no
   write keys. Store the matrix as rows so it is data, not code.

6. **0009_v4_indexes_rls.sql — indexes + RLS.** Indexes per spec §4.1
   (composite/covering for real query paths). Enable RLS on every new/modified
   table. Policies: base `read` for authenticated on reference/read tables;
   role-aware `write` policies keyed off a `current_user_role()` SECURITY
   DEFINER helper or JWT claim (permission checks reference `permissions` /
   `role_permissions`). Document that `/admin` uses the service role but the
   **API routes enforce permissions explicitly** — RLS is defense-in-depth, not
   the only gate.

7. **Types.** `npx supabase gen types typescript --local > src/types/database.ts`.
   Keep hand-written interfaces only for view/RPC shapes (student_summary,
   dashboard_stats, search_students results).

8. **Seed rewrite** `src/scripts/seed.ts`:
   - Order per spec §3.4: categories → courses → intake plans → departments →
     teachers → rooms → exams → students → admissions → semester records →
     subject_marks (internal/external split, per exam) → timetables →
     fee_payments → documents → achievements → scholarships → notifications.
   - Keep BATCH 500 and the idempotency guard (refuse double-seed).
   - Deterministic fake data (no faker runtime dep; reuse existing name-pool
     approach). ~2000 students × 40 years preserved.

9. **Verify (Gate B):**
   - `npx supabase db reset` completes with no errors.
   - `npx tsx src/scripts/seed.ts` runs; smoke queries:
     - `select count(*) from courses;` > 0, `students.category_id` populated,
       `fee_payments` merged, `teachers` present, `reservation_category` has 14
       rows.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 2 — DB performance layer

**Goal:** Kill N+1 and heavy aggregation from the request path using views,
materialized views, and RPC functions (spec §4).

**Files:**
- `supabase/migrations/0010_v4_views_rpc.sql` (new)
- `src/scripts/refresh-views.ts` (new)
- `package.json` (`db:refresh:views` script)

**Steps:**

1. **`student_summary` view** (spec §4.2): one row per student joining
   `students` + `admissions` + `academic_progress` + latest `semester_records`
   (via `distinct on (student_id) order by student_id, semester_no desc`).
   Exclude `aadhaar_number` from this view. The profile page and student list
   read this view instead of 4+ round-trips.

2. **Materialized views** (spec §4.3), all with `with no data` + refresh via
   RPC so `db reset`/seed never blocks on building them:
   - `mv_fee_collection` — fee collection by course/year.
   - `mv_admission_counts` — admission counts by category/seat-type/year.
   - `mv_pass_rates` — pass rates by course/semester.
   - `mv_attendance_summary` — attendance % by course/semester.
   - Indexes on each matview's primary grouping columns.

3. **RPC functions:**
   - `refresh_report_views()` — `refresh materialized view concurrently ...` for
     all four (must be called after seed/imports; documented, never in the
     request path).
   - `search_students(q text, limit int, cursor text)` — keyset search in one
     round-trip; reuse the existing `pg_trgm` `search_name` index.
   - `dashboard_stats(...)` — widget aggregations: total students, teachers,
     courses, attendance %, pending fees, upcoming exams, active users. Accept
     granularity params (e.g., academic year) with sane defaults.

4. **Refresh script** `src/scripts/refresh-views.ts`: service-role client that
   calls `refresh_report_views()` and exits non-zero on failure.

5. **Verify (Gate A + smoke):**
   - `npx supabase db reset`; `npx tsx src/scripts/seed.ts`;
     `npx tsx src/scripts/refresh-views.ts`.
   - Smoke: `select count(*) from student_summary;` matches student count;
     `select * from dashboard_stats();` returns the 7 widget numbers;
     `select * from search_students('ram', 10, null);` returns keyset rows.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 3 — Cache layer + API optimization

**Goal:** Layered cache (Redis → LRU → Supabase), zod validation everywhere,
cursor pagination, rate limiting, cache headers (spec §5).

**Files:**
- `src/lib/cache/index.ts` (new)
- `src/lib/cache/__tests__/cache.test.ts` (new)
- `src/lib/validation/schemas.ts` (new) + per-route schema files
- `src/lib/api/handlers.ts` (new)
- `src/lib/api/rate-limit.ts` (new) + tests
- `src/lib/db.ts` (edit: `DEFAULT_PAGE_SIZE`, `CACHE_TTL` consts)
- `src/middleware.ts` + `src/lib/supabase/middleware.ts` (edit: rate limit +
  matcher)
- `src/app/api/search/route.ts`, `src/app/api/students/[id]/route.ts` (rewired)
- `next.config.ts` (security headers + compression verify)

**Steps:**

1. **`src/lib/cache/index.ts`** — layered facade:
   - `cacheGet<T>(key): Promise<T | null>` — LRU → Redis → miss (`null`).
   - `cacheSet<T>(key, value, ttlSeconds)` — writes LRU + Redis.
   - `cacheDel(key)` — deletes from both layers.
   - `cacheInvalidate(prefix)` — deletes all keys whose string key starts with
     `prefix` from LRU (iterate `lru.keys()`) and Redis (scan + del). Keep it a
     single straightforward loop over a bounded key scan; do **not** build a
     complex key registry. Prefixes: `profile:`, `search:`, `list:`, `stats:`.
   - LRU: `new LRUCache<string, string>({ max: 500, ttl: 60_000 })` — sub-ms hot
     path in front of Redis.
   - `getCachedOrSet(key, ttl, fetch)` helper: get → miss → `fetch()` → set →
     return; swallow fetch errors only on the cache write path (source of truth
     is the DB).
   - Keys: `method:url:queryString` (stable hash of sorted query params).
   - Redis-down → LRU-only degraded mode (Task 0's non-fatal client makes this
     automatic).

2. **TTL table** (spec §5.1) as constants in `src/lib/cache/index.ts`:
   - student profile → 60s, search results → 10s, fee/course/reference lists →
     300s, dashboard stats → 30s. **Never cache auth/session/PII.** `profile:`
     keys hold the non-sensitive `student_summary` projection only (no
     `aadhaar_number`).

3. **zod DTOs** `src/lib/validation/schemas.ts`:
   - `paginationSchema` (`limit` 1–100 default 20, `cursor` optional string).
   - `studentCreateSchema` / `studentUpdateSchema` / `bulkStudentRowSchema` per
     v4 `students` + `admissions` fields (aadhaar optional, validated format,
     never echoed back).
   - Schemas for each admin module payload (teachers, courses, attendance,
     exams, fees, timetable, notifications) defined here or colocated with the
     module; every route parses with `safeParse` and returns
     `400 { error }` on failure.

4. **`src/lib/api/handlers.ts`** — shared route helpers:
   - `parseQuery(schema, searchParams)`, `parseBody(schema, request)`,
     `ok(data, {cacheControl})`, `fail(status, message)` with a consistent
     error JSON shape `{ error: { code, message } }`.
   - `setCacheControl(response, ttlSeconds)` and a `no-store` helper for
     mutations.

5. **Rate limiter** `src/lib/api/rate-limit.ts`:
   - In-process sliding window per IP (Map<ip, number[] of timestamps>, prune on
     access). Default `RATE_LIMIT_PER_MINUTE` = 300 general; 30 on auth routes
     (per spec §5.3). Exports `checkRateLimit(ip, routeGroup)` returning
     `{ ok, retryAfterSec }`.
   - Unit tests: window resets, burst over-limit rejected, per-IP isolation,
     configurable limit.

6. **Middleware integration:**
   - `src/middleware.ts` matcher already covers `/api/*`; add the rate-limit
     check against `x-forwarded-for`/`request.ip` at the top of the middleware
     chain; return `429 { error: { code: 'RATE_LIMITED' } }` with
     `Retry-After`.
   - **Do not cache auth/session reads** (profile keys only).

7. **Rewrite routes:**
   - `src/app/api/search/route.ts` — use `search_students` RPC + `getCachedOrSet`
     (`search:` prefix, 10s TTL) + keyset pagination from the RPC cursor.
   - `src/app/api/students/[id]/route.ts` (GET) — read `student_summary` view
     through `getCachedOrSet` (`profile:` prefix, 60s TTL); mutations call
     `cacheInvalidate('profile:')` + `cacheInvalidate('search:')`.

8. **`next.config.ts`** — add security headers (HSTS, `X-Content-Type-Options`,
   `X-Frame-Options`, `Referrer-Policy`) and confirm `compress: true`.

9. **Verify (Gate A):**
   - `npx vitest run src/lib/cache src/lib/api` passes (LRU hit/miss, Redis
     fallback, invalidation by prefix, rate limiter, zod accept/reject).
   - Route smoke via dev server: search returns keyset page; second identical
     request served from cache (check via a log line or timing).
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 4 — Security & RBAC

**Goal:** Aadhaar encryption at rest, server-side permission matrix, RLS
polish, audit trail (spec §6).

**Files:**
- `src/lib/crypto.ts` (new)
- `src/lib/crypto.test.ts` (new)
- `src/lib/auth/rbac.ts` (new)
- `src/lib/auth/rbac.test.ts` (new)
- `src/lib/admin.ts` (upgrade: permission-gated helpers)
- `supabase/migrations/0009_v4_indexes_rls.sql` (RLS policies; already authored
  in Task 1, add any missing role policies here or in `0011_v4_rls_fix.sql` if
  needed)

**Steps:**

1. **`src/lib/crypto.ts`** — app-side AES-256-GCM:
   - Key from `AADHAAR_ENCRYPTION_KEY` (32-byte base64 in env; validate length
     at startup).
   - `encryptAadhaar(plain)` → `v1.<iv>.<tag>.<ciphertext>` base64;
     `decryptAadhaar` with timing-safe failure → `null` (never throw into
     callers). `aadhaarHash(plain)` → deterministic SHA-256 hex used for the
     `students.aadhaar_hash` uniqueness column; written alongside the
     ciphertext on create/update.
   - **Never projected by default**: every query/route that reads `students`
     selects an explicit column list that omits `aadhaar_number`. Only an
     explicit `getAadhaarForAdmin(studentId)` helper (RBAC-checked) decrypts.
   - Unit tests: round-trip, tamper-detection, wrong-key fails to null.

2. **`src/lib/auth/rbac.ts`** — permission matrix:
   - `ROLES` and `PERMISSIONS` constants mirroring the 0008 seed.
   - `getUserRole(user)` reads JWT claim `role` (or maps Supabase `user_metadata`).
   - `hasPermission(user, key)` — checks role's key set; used by every admin
     route + UI gate. `assertPermission(user, key)` throws/returns typed error.
   - Unit tests: matrix completeness (every seeded permission reachable), denied
     cases per role, super_admin override.

3. **`src/lib/admin.ts` upgrade** — route helpers now take the caller and call
   `assertPermission` before any mutation; return `403 { error }` when denied.
   Keep existing exported functions' shapes so `/admin` pages don't break.

4. **RLS verification + polish** — confirm `0009` policies exist for every v4
   table; add a `current_user_role()` helper (SECURITY DEFINER reading the JWT)
   used by `write` policies. `select` policies remain role-aware (viewer reads
   allowed; teacher reads limited to own scope where feasible). Document: API
   routes are the primary gate; RLS is defense-in-depth.

5. **Audit trail** — writes to `student_status_history` on status transitions;
   scoped `audit_trail` entries for sensitive writes (fees, document
   verification, role changes) with `actor_id`, `action`, `target`, `meta`.

6. **Verify (Gate A):**
   - `npx vitest run src/lib/crypto src/lib/auth` passes.
   - Route-level check: an unprivileged token hitting a `student:write` route
     gets 403; a `viewer` hitting a mutation gets 403.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 5 — Dual-dashboard scaffold

**Goal:** `/dashboard/viewer` (read-only) + `/dashboard/admin` (data-entry ERP)
with RBAC gating and the shadcn `dashboard-01` foundation (spec §7.1).

**Files:**
- `src/app/dashboard/layout.tsx` (new)
- `src/app/dashboard/viewer/page.tsx` (new)
- `src/app/dashboard/admin/layout.tsx` (new)
- `src/app/dashboard/admin/page.tsx` (new)
- `src/components/dashboard/admin-nav.tsx` (new)
- `src/components/dashboard/widget-card.tsx` (new)
- `src/app/dashboard/admin/loading.tsx` (new)
- `src/lib/auth/rbac.ts` (add `requireDashboardAccess`)
- `src/middleware.ts` (add `/dashboard/*` matcher rules)

**Steps:**

1. **RBAC gate.** Add to `src/lib/auth/rbac.ts`:
   `requireDashboardAccess(role)` — viewer tree requires an authenticated role
   (read-only); admin tree requires `student:write`+ OR `super_admin`/`admin`.
   Middleware redirects unauthenticated users to `/login` and unauthorized
   users to `/dashboard/viewer`.

2. **Layout** `src/app/dashboard/layout.tsx` — shared shell: sidebar nav
   (`admin-nav.tsx`), topbar with user chip, max-width container. Server
   component; no client data fetching here.

3. **`/dashboard/viewer/page.tsx`** — read-only: stat cards + a table of
   students from `student_summary` (via the cached search RPC), no mutation
   controls. Server components + TanStack Query for any client interactivity
   (page refresh on filter only).

4. **`/dashboard/admin/layout.tsx`** — admin shell: sidebar groups
   (Overview, Students, Teachers, Courses, Attendance, Exams, Fees, Timetable,
   Notifications), guarded by `requireDashboardAccess`; header actions area for
   import buttons.

5. **`/dashboard/admin/page.tsx`** — overview: 7 widget cards fed by the
   `dashboard_stats` RPC through the cache (`stats:` prefix, 30s TTL). Wire
   `widget-card.tsx` (icon, label, value, delta, loading skeleton).

6. **Foundation.** Initialize the shadcn `dashboard-01` block as the visual
   foundation (sidebar + topnav pattern), customized with the base-nova style.
   Keep components tree small (`dashboard-01` adapted, not wholesale).

7. **Verify (Gate A):**
   - Dev-server smoke: `/dashboard/viewer` renders for a viewer token;
     `/dashboard/admin` redirects a viewer token to `/dashboard/viewer`; admin
     token sees the overview with all 7 widgets.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 6 — Admin modules: Students (reference module)

**Goal:** Full CRUD + bulk CSV import + documents + autosave/draft for the
students module — the reference pattern every later module copies (spec §7.2,
§7.3).

**Files:**
- `src/lib/validation/student.ts` (new; extends `schemas.ts`)
- `src/app/api/dashboard/students/route.ts` (new: GET list + POST create)
- `src/app/api/dashboard/students/[id]/route.ts` (new: GET/PATCH/DELETE)
- `src/app/api/dashboard/students/[id]/documents/route.ts` (new)
- `src/app/api/dashboard/students/import/route.ts` (new: CSV bulk)
- `src/hooks/use-students.ts` (new: TanStack Query hooks)
- `src/hooks/use-autosave.ts` (new)
- `src/components/dashboard/students/*` (table, form dialog, import dialog,
  document upload, delete confirm)
- `src/components/ui/` additions via shadcn CLI where missing (data-table,
  sheet, date-picker, multi-select, toast already present?)

**Steps:**

1. **Routes.** All routes: parse zod DTOs, `assertPermission(user,
   'student:write')` for mutations, service-role client, `cacheInvalidate`
   (`profile:` + `search:`) after every mutation.
   - GET list: `student_summary` view, cursor pagination (RPC `search_students`
     or keyset on `(id, name)`), `list:` cache 60s.
   - POST create: insert `students` + `admissions` in one transaction (service
     role, RLS bypassed but permissions enforced in code).
   - PATCH: partial update, validate `studentUpdateSchema`, encrypt aadhaar if
     provided, write `student_status_history` when `status` changes.
   - DELETE: soft-delete (set `status='inactive'` + history row) — hard delete
     only for `super_admin` (G5 decision: default is soft).
   - Documents: upload to Supabase Storage, insert `documents` row
     (`verified_status='pending'`), `docs:verify` permission for verification.

2. **`src/hooks/use-students.ts`** — TanStack Query hooks: `useStudents(params)`
   (queryKey `['students', params]`, cacheTime/staleTime tuned), `useStudent(id)`,
   `useCreateStudent`, `useUpdateStudent`, `useDeleteStudent`,
   `useImportStudents`. Mutations: optimistic updates + rollback on error +
   `invalidateQueries` on `['students']` + `['dashboard-stats']`. Toast on
   success/error.

3. **`src/hooks/use-autosave.ts`** — debounced (800ms) autosave of the form
   draft to `localStorage` keyed by form id; restores on mount with a
   "Resume draft?" banner (G7 — **only** student add/edit + import forms use
   this).

4. **UI components:**
   - `students-table` — data table with pagination, search box, row actions
     (edit, delete, upload docs, view).
   - `student-form` — RHF + zodResolver (client zod mirrors server DTO),
     sections: Personal / Admission / Academic; aadhaar field masked, value
     never echoed back after save.
   - `student-dialog` (create/edit via `Sheet`), `delete-confirm` dialog,
     `document-upload` dialog, `csv-import` dialog (template download +
     per-row validation report, BATCH 100 inserts via the import route).
   - `/dashboard/admin/students/page.tsx` — wires table + dialogs + stats strip.

5. **CSV import route** — validate every row against `bulkStudentRowSchema`
   (skip invalid rows with per-row errors, do not fail the whole batch), insert
   in batches, return `{ inserted, failed: [{row, error}] }`, then
   `refresh_report_views()` note + `cacheInvalidate`.

6. **`src/lib/api/students.ts`** — thin, intentionally minimal (delete this file
   in Task 10 if unused): only the `StudentRow` type shared by hooks/routes.

7. **Verify (Gate A):**
   - Vitest: zod student schemas accept/reject; `use-autosave` (mocked
     localStorage) round-trip.
   - Route smoke (dev server + admin token): create → list → edit → soft-delete;
     CSV import with 1 invalid row reports it and imports the rest; document
     upload row created.
   - Viewer token gets 403 on mutations.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 7 — Admin modules: Teachers, Courses, Attendance

**Goal:** CRUD for teachers/courses; attendance marking with bulk upload and
percentage reports (spec §7.2 modules 2–4).

**Files:**
- `src/lib/validation/{teacher,course,attendance}.ts` (new)
- `src/app/api/dashboard/teachers/route.ts` + `[id]/route.ts` (new)
- `src/app/api/dashboard/courses/route.ts` + `[id]/route.ts` (new)
- `src/app/api/dashboard/attendance/route.ts` + `bulk/route.ts` +
  `report/route.ts` (new)
- `src/hooks/use-teachers.ts`, `use-courses.ts`, `use-attendance.ts` (new)
- `src/components/dashboard/{teachers,courses,attendance}/*` (table, form,
  dialogs)
- `src/app/dashboard/admin/{teachers,courses,attendance}/page.tsx` (new)

**Steps:**

1. **Teachers CRUD** — mirror Task 6 pattern: `teacher:write` gate, zod DTOs
   (email unique check), list from `teachers` with department join, salary never
   projected in list/GET by default (RBAC + explicit admin override with
   `salary` excluded from column lists). Cache `list:teachers:` 300s.

2. **Courses CRUD** — `course:write` gate; CRUD on `courses`; `intake_plan`
   editable inline (seats per stream/batch). Cache `list:courses:` 300s.

3. **Attendance module:**
   - `attendance:write` gate for mutations; `attendance:read` for reports.
   - POST single: `{ course_id, subject_id, date, records: [{ student_id,
     status }] }` — upsert against `enrollments` (student must be enrolled);
     validate status enum (present/absent/late/leave).
   - POST bulk: CSV (student list × date) with per-row validation report like
     the student import; BATCH upsert.
   - GET report: daily and monthly; `attendance %` from the
     `mv_attendance_summary` matview (refresh after imports via
     `refresh_report_views()` — documented, not synchronous in the request
     path; for demo the report endpoint may refresh the matview lazily on a
     stale-timeout).
   - Cache `list:attendance:` 60s; invalidate on write.

4. **UI** — per module: data table + form `Sheet` + delete confirm + import
   dialog (attendance only). Attendance marking UI: date + subject picker, class
   roster with status segmented control, "save all" one mutation.

5. **Verify (Gate A):**
   - Route smoke: teacher CRUD; course CRUD; attendance single + bulk; report
     returns `%` per course/semester; unpermitted role → 403.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 8 — Admin modules: Exams, Fees, Timetable, Notifications + widgets

**Goal:** Remaining admin modules per spec §7.2 modules 5–8 + finish the widget
layer.

**Files:**
- `src/lib/validation/{exam,fee,timetable,notification}.ts` (new)
- `src/app/api/dashboard/exams/route.ts` + `[id]/route.ts` +
  `[id]/marks/route.ts` + `[id]/publish/route.ts` (new)
- `src/app/api/dashboard/fees/route.ts` + `[id]/route.ts` +
  `receipt/route.ts` (new)
- `src/app/api/dashboard/timetables/route.ts` (new)
- `src/app/api/dashboard/notifications/route.ts` +
  `recipients/route.ts` (new)
- `src/hooks/use-{exams,fees,timetables,notifications}.ts` (new)
- `src/components/dashboard/{exams,fees,timetables,notifications}/*` (new)
- `src/app/dashboard/admin/{exams,fees,timetable,notifications}/page.tsx` (new)

**Steps:**

1. **Exams module** — `exam:publish` gate for publish; `teacher:write`/admin for
   creation.
   - CRUD `exams` + `exam_subjects` (subject, max/pass marks).
   - Marks entry: POST `[id]/marks` upserts `subject_marks`
     (`internal_marks`/`external_marks`, `attempt_number`, computed `total` and
     `grade` via the v4 grade rule — store raw marks, derive grade in a view or
     at read time).
   - Publish: `[id]/publish` computes `sgpa`/`result_status`, writes
     `semester_records`, sets exam `status='published'`, sends in-app
     `notifications` to recipients. Transactional (single service-role call via
     RPC `publish_exam_results(exam_id)` to keep it atomic).
   - Cache `list:exams:` 60s; invalidate + refresh matviews on publish.

2. **Fees module** — `fees:read` for reads, `fees:approve` for payments/receipts.
   - `fee_category_rates` management (structure per year_of_study/academic_year).
   - `fee_payments` entry (apply scholarship_application link when present);
     pending-fees report from `mv_fee_collection`; receipt derived from the
     payment row (receipt view or generated at read).
   - Cache `list:fees:` 300s; invalidate on payment + refresh matview.

3. **Timetable module** — `timetable:write` gate. CRUD on `timetables`
   (course/semester/day/period/subject/teacher/room) with conflict checks
   (teacher busy, room double-booked) in the zod/route validation. Teacher and
   room schedule views. Cache `list:timetables:` 300s.

4. **Notifications module** — `notification:send` gate.
   - POST create: title/body/type/priority/channel; recipients by role or
     explicit student ids → `notification_recipients` rows.
   - In-app delivery: recipients GET their unread; mark-read mutation.
   - Email/SMS: **channel placeholders only** — store the chosen channel on the
     row, log "sent" timestamp in `sent_at` without any SMTP/SMS call (G8).
   - Cache `list:notifications:` 60s; invalidate on send/read.

5. **Widgets finish** — ensure `dashboard_stats` RPC drives all 7 overview
   widgets (Task 5 step 5) and add a small "upcoming exams" widget backed by
   `exams` + cache.

6. **Verify (Gate A):**
   - Route smoke: create exam + subjects → enter marks → publish → verify
     `semester_records` row + notification rows created; fee payment → receipt +
     pending list updates; timetable double-book rejected; notification send
     with role recipients; mark-read works.
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 9 — Frontend performance

**Goal:** TanStack Query provider, dynamic imports, streaming/Suspense,
bundle review (spec §9).

**Files:**
- `src/app/providers.tsx` (new: QueryClientProvider + theme)
- `src/app/layout.tsx` (edit: wrap providers)
- `src/components/dashboard/**` (add `dynamic` imports where heavy)
- `src/app/(app)/students/[id]/page.tsx` + tab components (extend with v4 data)
- `next.config.ts` (bundle analyzer flag or manual `next build` review)

**Steps:**

1. **Provider** — `src/app/providers.tsx` with a single `QueryClient`
   (`staleTime: 30s`, `gcTime: 5m`, `retry: 1`) + `ReactQueryDevtools` only in
   dev. Wrap the app layout.

2. **Client components → TanStack Query** — replace ad-hoc `use-section-data`
   fetches on profile tabs and dashboard lists with `useQuery` hooks (dedupe +
   caching); keep server components for static sections.

3. **Dynamic imports** — heavy/rarely-used components (CSV import dialog, marks
   entry grid, charts) via `next/dynamic` with `loading` fallbacks; profile tabs
   already lazy-loaded, extend for v4 data sections.

4. **Streaming/Suspense** — dashboard overview and profile page wrap slow data
   regions in `<Suspense>` with skeleton fallbacks (widget skeletons already in
   `widget-card`).

5. **Bundle review** — `npx next build`; inspect the report/`next build` output
   for oversized chunks; split vendor chunks for heavy deps (react-hook-form,
   zod are fine; any chart lib must be dynamically imported).

6. **Verify (Gate A + Gate C partial):**
   - `npx next build` succeeds; dashboard overview + profile load < 2s locally.
   - No console hydration errors; no fetch duplicated in network tab (dedupe
     working).
   - `npx tsc --noEmit`, `npm run lint` clean.

## Task 10 — Tests + concurrency load test

**Goal:** Full unit/integration pass + the benchmark gate (spec §11).

**Files:**
- `src/scripts/load-test.ts` (new; replaces/extends `benchmark.ts`)
- `src/scripts/benchmark.ts` (keep or fold into load-test — fold if it adds
  no unique value)
- `src/lib/cache/__tests__/*` (any missing coverage from Task 3)
- `package.json` (`benchmark:load` script)

**Steps:**

1. **Load test** `src/scripts/load-test.ts`:
   - Worker-thread loader: **50 concurrent × 2K requests** against the real
     local HTTP API (`http://127.0.0.1:3000`), mixed read profile: search (30%),
     student profile (40%), dashboard stats (20%), list endpoints (10%).
   - Reports p50/p95/p99, throughput (req/s), error rate, and per-endpoint
     breakdown.
   - Targets: **p50 < 100ms, p95 < 250ms, 0 error spikes**. Dashboard load
     < 2s; Redis-served hot queries < 5ms (assert separately by timing
     cached-vs-uncached on one hot key).
   - Exits non-zero on gate failure.

2. **Unit/integration sweep** — confirm coverage for: cache layer (hit/miss/
   expiry/invalidation by prefix, Redis-down fallback), rate limiter, zod DTOs
   (accept/reject per module), crypto round-trip + tamper, rbac matrix, autosave
   hook, search/pagination helpers. Extend seed-generator tests for v4 shapes.

3. **Integration smoke** — RPC/view shapes verified against local Supabase
   (reset + seed + refresh-views + the Task 2/8 smoke queries), documented as a
   runnable script (`src/scripts/smoke.ts`) so CI/README can reproduce.

4. **README** — update setup: Docker Redis step, `.env.example` copy,
   `supabase db reset`, seed, refresh views, run dev, run load test, benchmark
   gate results table.

5. **Verify (Gate C):**
   - `npx tsx src/scripts/load-test.ts` passes all three targets with Redis
     running.
   - `npx vitest run` (full) passes; `npx tsc --noEmit`; `npm run lint` clean.

## Task 11 — Extensibility tooling

**Goal:** Adding a table = one command (spec §8).

**Files:**
- `src/scripts/scaffold-table.ts` (new)
- `package.json` (`add-table` script)
- `docs/schema-conventions.md` (new)

**Steps:**

1. **Scaffold script** `src/scripts/scaffold-table.ts`:
   - `npm run add-table -- <name>` prompts/generates:
     - `supabase/migrations/NNNN_<name>.sql` with the full self-contained
       template: `create table` (`id bigint generated always as identity primary
       key`, `created_at`/`updated_at timestamptz not null default now()`),
       index stubs (`idx_<table>_<columns>`), `alter table ... enable row level
       security`, RLS policies (read_authenticated base + role-specific),
       grants, optional seed stub — per §8.1 ordering.
     - `src/types/database.ts` interface stub + `Db.Tables` entry.
     - Optional `src/scripts/seed-<name>.ts` stub.
   - Numbering: read the highest existing `NNNN_` prefix and increment.

2. **Conventions doc** `docs/schema-conventions.md` — naming, index rules, RLS
   patterns, grants, view/RPC rules, aadhaar/encryption rules, when to use a
   materialized view vs view vs RPC, when to add a Redis-cached endpoint, and
   the scaffold usage example.

3. **Verify:**
   - `npm run add-table -- dummy_feature` produces the template files; run
     `npx supabase db reset` still passes with the dummy migration present
     (then delete the dummy migration and files).
   - `npx tsc --noEmit`, `npm run lint` clean.

## 6. Exit criteria / definition of done

- All 11 tasks complete with their verification steps passing.
- **Gate C** passes: p50 < 100ms, p95 < 250ms at 50 concurrent × 2K, 0 error
  spikes; dashboard < 2s; Redis hot < 5ms.
- `/dashboard/admin` supports full CRUD for students, teachers, courses,
  attendance, exams, fees, timetable, notifications; `/dashboard/viewer` is
  read-only; existing `/search`, `/admin`, `/students/[id]` unchanged.
- `npm run add-table -- <name>` generates a consistent, self-contained table
  migration.
- README documents setup (Docker Redis, env, reset, seed, load test) + gate
  results.
- Final whole-branch review completed; findings resolved (reviewer never writes
  code).

## 7. Risk notes

- **Docker unavailable** → Redis tasks block; fallback is LRU-only degraded mode
  (still benchmarked, gate may fail on Redis hot-path assertion — surface this
  explicitly, don't silently skip).
- **`supabase db reset` resets data** → all smoke/verification runs are
  expected to re-seed; never assume persisted demo rows.
- **Migration 0001–0004 must not change** → any need to touch them is a
  stop-and-ask.
- **postgREST + RLS nuance** → API routes use the service role for admin
  writes; the permission gate is in code (Task 4). Do not rely on RLS alone.
- **Aadhaar leakage** → every new query/route selecting `students` must use an
  explicit column list omitting `aadhaar_number`; flagged in review each task.





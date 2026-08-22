# Schema Conventions — ERP v4

> **Source of truth:** `docs/superpowers/specs/2026-08-19-erp-v4-architecture-design.md` §8 and `docs/superpowers/plans/2026-08-19-erp-v4-dual-dashboard.md` Task 11. Every new table follows this document. When in doubt, copy the scaffold template and then narrow it.

---

## 1. Migration convention & ordering (§8.1)

One migration per concern: `supabase/migrations/NNNN_<slug>.sql` where `NNNN` is zero-padded and strictly increments from the current highest prefix. **Never edit `0001–0004`; append `0005+`.**

Every table migration is **self-contained** and includes these sections **in order**:

1. `create table`
2. indexes (`idx_<table>_<columns>`)
3. `alter table ... enable row level security`
4. RLS policies (read base + role-specific)
5. grants
6. optional idempotent seed

The scaffold script generates all six. Delete sections you do not need, but do not reorder.

```sql
-- 0011_my_table.sql — scaffolded via `npm run add-table -- my_table`
-- 1) create table
create table if not exists my_table (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 2) indexes
create index if not exists idx_my_table_created_at on my_table(created_at);
-- 3) enable RLS
alter table my_table enable row level security;
-- 4) policies
create policy read_authenticated on my_table for select to authenticated using (true);
-- 5) grants
grant select on my_table to authenticated;
grant all on my_table to service_role;
```

---

## 2. Naming

- **Tables:** `snake_case`, singular (`course`, `teacher`, `fee_payment` not `fee_payments` for new tables — legacy tables keep their existing plural names like `courses`, `teachers` for backward compatibility).
- **Columns:** `snake_case`. Foreign keys: `<singular>_id` (`course_id`, `student_id`). Booleans: `is_*` or `has_*`/`cleared`. Timestamps: `*_at`.
- **Indexes:** `idx_<table>_<columns>` (e.g. `idx_students_campus_program`, `idx_admissions_student`). Unique indexes: `idx_<table>_<column>_unique` or `idx_<table>_unique` for composite.
- **Policies:** `read_authenticated` (base select), `write_admin`/`write_<table>`/`update_role` etc. One-word suffix per action is fine; keep the read name stable.
- **Sequences:** `<table>_id_seq` (auto-created for `generated always as identity`).
- **Views / matviews / RPCs:** `snake_case`; matviews prefixed `mv_` (`mv_fee_collection`), views descriptive (`student_summary`), RPCs verb-like (`search_students`, `dashboard_stats`, `refresh_report_views`).

---

## 3. Table shape

All new tables use:

```sql
id bigint generated always as identity primary key,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

- `id` is always `bigint generated always as identity` — never `serial` or `uuid`.
- `created_at` / `updated_at` are always `timestamptz not null default now()`. Update `updated_at` via application code on writes (or add a trigger if you need DB-side bumping — document it).
- Add domain columns between `id` and timestamps. Use `text` / `varchar` / `int` / `numeric(12,2)` / `jsonb` / `timestamptz` / `date` as in existing migrations. Prefer `text` over `varchar(n)` unless a hard limit is required.
- FKs: `bigint not null references <table>(id) on delete cascade` for owned children, `on delete set null` for optional references. Always index FK columns (see §4).
- `not null` + `default` for required columns; nullable for optional. Add `unique` constraints only where business-unique (e.g. `employee_id`, `aadhaar_hash` where not null).

Reference: `supabase/migrations/0005_v4_core.sql`, `0007_v4_erp.sql`, and scaffold template in `src/scripts/scaffold-table.ts`.

---

## 4. Index rules

Naming: `idx_<table>_<columns>` (e.g. `idx_timetables_teacher_day`).

Rules:

- **Every FK gets an index** (e.g. `admissions(student_id)`, `timetables(teacher_id, day_of_week)`).
- **Every filter / sort / join path in the API gets a composite index.** See `supabase/migrations/0009_v4_indexes_rls.sql` §4.1:
  - `students(campus_id, program_id)`, `students(category_id)`, `pg_trgm` on `search_name`
  - `admissions(student_id)`, `admissions(intake_stream, expected_grad_year)`
  - `subject_marks(student_id, attempt_number)`, `subject_marks(subject_id)`, `subject_marks(exam_id)`
  - `semester_records(student_id, semester_no)`, `fee_payments(student_id, payment_date)`, `fee_payments(status)`
  - `intake_plan(course_id, batch_year)`, `timetables(teacher_id, day_of_week)`, `timetables(room_id, day_of_week)`
  - `notification_recipients(recipient_role)`, `exams(course_id, semester_no)`
- **Unique indexes use `where ... is not null`** when the column is nullable (e.g. `idx_students_aadhaar_hash where aadhaar_hash is not null`).
- Use `if not exists` in migrations to keep them re-runnable.
- Matviews: every matview refreshed `concurrently` needs a **unique index** on its grouping keys (`idx_mv_fee_collection_unique` etc.).
- Prefer `btree` (default) for equality/range; `gin` with `pg_trgm` only for `ILIKE %q%` search.

---

## 5. RLS patterns

- **Enable RLS on every new/modified table:**

```sql
alter table my_table enable row level security;
```

- **Base read policy** — every table has it (defense-in-depth; API routes are the primary gate):

```sql
create policy read_authenticated on my_table for select to authenticated using (true);
```

- **Write policies** keyed off `current_user_role()` (a `security definer` helper reading `request.jwt.claim.role` / `user_metadata.role`, falling back to `viewer` — see `0009_v4_indexes_rls.sql`):

```sql
create policy write_admin on my_table for all to authenticated
  using (current_user_role() in ('\''super_admin'\'','\''admin'\''))
  with check (current_user_role() in ('\''super_admin'\'','\''admin'\''));
```

Narrow the role list to least privilege:
- `teachers` → `super_admin, admin, teacher` (or `teacher:write`)
- `timetables, exams, subject_marks` → `super_admin, admin, teacher`
- `fee_payments` → `super_admin, admin, accountant` (`fees:approve`)
- `documents` verification → `docs:verify`
- `notifications` send → `notification:send`

- **Split policies when needed:** `for insert` / `for update` / `for delete` with separate `using` / `with check` is preferred over a single `for all` when roles differ by action.
- **Guard with `if not exists (select 1 from pg_policies ...)`** inside a `do $$ ... $$` block to keep migrations idempotent.
- **API routes still enforce `assertPermission(user, key)`** — RLS is not the only gate. `/dashboard/admin` service-role writes bypass RLS but are permission-checked in code (`src/lib/auth/rbac.ts`).

---

## 6. Grants

After policies, grant least privilege (see `0009_v4_indexes_rls.sql` top + scaffold template):

```sql
grant usage on schema public to anon, authenticated, service_role;
grant select on my_table to authenticated;
grant all on my_table to service_role;
grant usage, select on sequence my_table_id_seq to service_role;
```

- `authenticated` gets `select` only (writes go through policies).
- `service_role` gets `all` on tables and sequences (bypasses RLS; used by API routes after RBAC check).
- Sequences: `grant usage, select on sequence <table>_id_seq to service_role` (required for `generated always as identity`).
- Future tables: `0009` also does `alter default privileges` so new tables inherit grants — keep that block as-is; per-table grants remain explicit for clarity.

---

## 7. View / RPC / Matview rules

### Views (kill N+1)

- Use `create or replace view` for idempotent views (e.g. `student_summary` in `0010_v4_views_rpc.sql`).
- Join `students` + `admissions` + `academic_progress` + latest `semester_records` via `lateral (...) limit 1`.
- **Never project `aadhaar_number`** in views. Only `aadhaar_hash` if needed.
- `grant select on <view> to anon, authenticated, service_role`.

### Materialized views (reports/dashboards)

- Create `with no data` so `supabase db reset` / seed never blocks: `create materialized view mv_* as select ... with no data`.
- Add a **unique index** on grouping keys — required for `refresh concurrently`.
- Include secondary indexes on primary grouping columns (e.g. `idx_mv_fee_collection_course`).
- Never query matviews in the hot request path without checking staleness; refresh explicitly.

### RPC functions (single round-trip)

- Use `security definer` + `set search_path = public`.
- `stable` for read-only RPCs, `plpgsql` for multi-statement (e.g. `refresh_report_views()`).
- `revoke all on function ... from public; grant execute to anon, authenticated, service_role` (or at least `authenticated, service_role` for write RPCs).
- Examples: `search_students(q, p_limit, p_cursor)` (keyset, `limit least(coalesce(p_limit,20),100)`), `dashboard_stats(p_academic_year)`, `refresh_report_views()`.

**When to use what:**

| Need | Use | Why |
|------|-----|-----|
| Kill N+1 on profile/list | **view** (`student_summary`) | One row per student, live, no refresh |
| Heavy aggregation (fees, admissions, pass rates, attendance) | **materialized view** (`mv_*`) + `refresh_report_views()` | Precomputed, concurrent refresh off hot path |
| Keyset search / widget aggregation in one round-trip | **RPC** (`search_students`, `dashboard_stats`) | Single call, `pg_trgm` index, prepared-statement friendly |
| Ad-hoc filter that does not justify a view | Plain table query with indexes | Over-engineering hurts |

See `supabase/migrations/0010_v4_views_rpc.sql` for the canonical patterns.

---

## 8. Aadhaar / encryption rules

- `students.aadhaar_number` holds the **app-side AES-256-GCM ciphertext** (`v1.<iv>.<tag>.<ciphertext>` base64) — see `src/lib/crypto.ts`. `students.aadhaar_hash` holds the **deterministic SHA-256 hex** and has a `unique where aadhaar_hash is not null` index — never unique on the ciphertext (non-deterministic).
- Key from `AADHAAR_ENCRYPTION_KEY` (32-byte base64, validated at startup).
- Helpers: `encryptAadhaar(plain)`, `decryptAadhaar(cipher)` (returns `null` on tamper, never throws), `aadhaarHash(plain)`.
- **Never project `aadhaar_number` by default.** Every `select` uses an explicit column list omitting it. Only `getAadhaarForAdmin(studentId)` (RBAC-checked `docs:verify` / `super_admin`) decrypts.
- New tables holding PII: follow the same pattern — encrypt at rest, hash for uniqueness, never return by default, audit access.

---

## 9. When to use a materialized view vs view vs RPC (decision tree)

1. **Is it an N+1 join that the list/profile page hits every request?** → regular **view**.
2. **Is it a heavy `group by` report that can tolerate 30s–5m staleness?** → **matview** + scheduled/manual `refresh_report_views()` (documented, never in request path).
3. **Do you need keyset pagination or a single aggregated widget payload?** → **RPC**.
4. **Do you need both precomputation and a single-call API?** → matview + RPC that reads the matview (`dashboard_stats` reads `mv_attendance_summary`).
5. Otherwise → indexed table query (+ Redis cache if hot).

---

## 10. When to add a Redis-cached endpoint

Add caching when the endpoint is **read-heavy, safe to stale, and hit under load** (see `src/lib/cache/index.ts`):

- **TTL table (spec §5.1):** `profile:` 60s (`student_summary`), `search:` 10s (`search_students` RPC), `list:` 300s (fee/course/reference lists), `stats:` 30s (`dashboard_stats`). **Never cache auth/session/PII.**
- **Key:** `method:url:sortedQueryString` (stable hash).
- **Facade:** `getCachedOrSet(key, ttl, fetch)` — LRU (sub-ms hot) → Redis → DB. Mutations call `cacheInvalidate(prefix)` (`profile:`, `search:`, `list:`, `stats:`).
- **Redis-down is degraded LRU-only** — never throw into the request path.
- Add a cached endpoint when: p95 is high due to repeated identical reads (search, dashboard stats, fee lists) or the load test shows pool saturation. Skip when: data is per-user auth, PII, or must be strongly consistent.
- Invalidation: after every mutation on the table, `cacheInvalidate` the affected prefix. For matviews, invalidate `stats:` after `refresh_report_views()`.

---

## 11. RBAC / permissions

Matrix (see `supabase/migrations/0008_v4_rbac_seed.sql` and `src/lib/auth/rbac.ts`):

- Roles: `super_admin` (all), `admin` (all except `student:delete` narrowly — currently admin *does* get `student:delete`), `teacher` (`attendance:write`, `exam:publish`, `timetable:write`), `accountant` (`fees:read`, `fees:approve`), `viewer` (no write keys).
- Keys: `student:write`, `student:delete`, `teacher:write`, `course:write`, `attendance:write`, `exam:publish`, `fees:read`, `fees:approve`, `docs:verify`, `timetable:write`, `notification:send`.
- New tables: pick the narrowest key(s), add rows to `permissions`/`role_permissions` in a follow-up migration if needed, and enforce via `assertPermission(user, key)` in the route + narrow the RLS `write_*` role list.
- `current_user_role()` is the RLS-side mirror of `getUserRole(user)` (JWT `role` claim).

---

## 12. Seed / idempotency

- Migrations are append-only; `supabase db reset` is the reset path.
- `src/scripts/seed.ts` has an idempotency guard (`Demo University` exists → refuse double-seed) and `BATCH 500` insertion.
- New table seeds: insert with `on conflict (...) do nothing` or check `count` first. Keep `seed-<table>.ts` stubs idempotent and `BATCH 500`.
- Refresh matviews after bulk loads: `npx tsx --env-file=.env src/scripts/refresh-views.ts` (calls `refresh_report_views()`).

---

## 13. Scaffold usage

### One-command table creation

```bash
# 1) scaffold
npm run add-table -- audit_event
# → creates supabase/migrations/0011_audit_event.sql
# → patches src/types/database.ts (interface AuditEvent + Db.Tables.audit_event)
# → prints next steps

# with optional seed stub
npm run add-table -- audit_event --seed
# → also creates src/scripts/seed-audit_event.ts
```

### What you get

- `supabase/migrations/NNNN_<name>.sql` — full template (§8.1 ordering). File is `supabase db reset`-safe (`if not exists`).
- `src/types/database.ts` — `export interface <Pascal> { id, created_at, updated_at }` + `Db.Tables.<name>` entry.
- `src/scripts/seed-<name>.ts` — optional, idempotent, `BATCH 500` template (only with `--seed`).

### After scaffolding

1. **Edit the migration:** add domain columns between `id` and `created_at`, add composite indexes, narrow the `write_admin` roles.
2. **Extend the type:**

```ts
export interface AuditEvent {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  meta: Json | null;
  created_at: string;
  updated_at: string;
}
```

3. **Add validation:**

```ts
// src/lib/validation/schemas.ts
export const auditEventSchema = z.object({ action: z.string().min(1), target: z.string().optional() });
```

4. **Add RBAC if needed:** new permission rows in `0012_rbac_<key>.sql` + `assertPermission` in the route.
5. **Add cache if hot:** `getCachedOrSet("list:audit_event:"+key, 60, fetch)` + `cacheInvalidate("list:")` on write.
6. **Verify:**

```bash
npx tsc --noEmit
npm run lint
npx supabase db reset   # dry-run the migration (delete dummy migration after test if it was a trial)
```

---

## 14. Checklist (copy into your PR description)

- [ ] Migration `NNNN_<table>.sql` follows 1→6 ordering, indexes named `idx_<table>_<cols>`, RLS enabled, policies use `if not exists`, grants present
- [ ] No `aadhaar_number`-like PII projected by default; if PII is needed, encryption + hash pattern applied
- [ ] `src/types/database.ts` interface + `Db.Tables` entry added (run `npm run db:types` after `supabase db reset` to regenerate from live DB)
- [ ] Zod schema added and route parses with `safeParse` → `400 { error }` on failure
- [ ] RBAC: permission key checked via `assertPermission` in the route; RLS roles narrowed to least privilege
- [ ] Cache: prefix chosen (`profile:`/`search:`/`list:`/`stats:`), TTL set, `cacheInvalidate(prefix)` on mutations
- [ ] Seed (if any) is idempotent, `BATCH 500`, guard against double-seed
- [ ] `npx tsc --noEmit` clean, `npm run lint` clean, `npx supabase db reset` passes with the new migration
- [ ] Docs: update README if the table backs a dashboard module

---

## 15. Examples

### Minimal new table (`announcement`)

```sql
create table if not exists announcement (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_announcement_published_at on announcement(published_at) where published_at is not null;
alter table announcement enable row level security;
-- policies + grants as per template
```

### Matview-backed report

Do not create a matview for a table that is rarely aggregated. If you do:

```sql
create materialized view mv_announcement_counts as
select date_trunc('\''day'\'', created_at)::date as day, count(*)::bigint as cnt
from announcement group by 1 with no data;
create unique index idx_mv_announcement_counts_unique on mv_announcement_counts(day);
-- then extend refresh_report_views() to include it, or create refresh_announcement_views()
```

### Redis-cached list endpoint

```ts
// src/app/api/dashboard/announcements/route.ts
import { getCachedOrSet, cacheInvalidate } from "@/lib/cache";
export async function GET(req: Request) {
  const data = await getCachedOrSet("list:announcements:all", 300, () =>
    supabase.from("announcement").select("id,title,published_at").order("published_at", { ascending: false })
  );
  return Response.json(data);
}
// on POST/PATCH/DELETE: await cacheInvalidate("list:announcements");
```

---

## References

- Spec §8: `docs/superpowers/specs/2026-08-19-erp-v4-architecture-design.md`
- Plan Task 11: `docs/superpowers/plans/2026-08-19-erp-v4-dual-dashboard.md`
- Migrations: `supabase/migrations/0001_schema.sql`, `0005_v4_core.sql`–`0010_v4_views_rpc.sql`
- Types: `src/types/database.ts` (run `npm run db:types` after reset)
- Cache: `src/lib/cache/index.ts`, `src/lib/cache/redis.ts`
- RBAC: `src/lib/auth/rbac.ts`, `supabase/migrations/0008_v4_rbac_seed.sql`
- Scaffold: `src/scripts/scaffold-table.ts` (`npm run add-table -- <name>`)

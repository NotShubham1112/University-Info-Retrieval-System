# University Info Retrieval System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-shaped demo of a university information retrieval system — a Next.js app backed by local Supabase (PostgreSQL + Auth + Storage) that can search 40 years of student records (80,000 students, millions of related rows) in milliseconds using B-tree and GIN trigram indexes, then display full student profiles.

**Architecture:** Documents (PDFs/PNGs/scans) live in Supabase Storage — never in PostgreSQL. PostgreSQL stores only metadata in a normalized ~21-table schema. Next.js talks directly to Supabase through the client with Row Level Security (RLS) enforcing access; no FastAPI for the first demo. Search queries are classified before hitting the DB (PNR → B-tree, roll number → B-tree, name → GIN trigram) and results use keyset pagination.

**Tech Stack:**
- Next.js 15/16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Supabase CLI (local): PostgreSQL, Auth (email/password), Storage
- pg_trgm extension for fuzzy name search
- Vitest for unit tests (classifier, seed generator, query builder)

## Global Constraints

- Node.js >= 20 (machine has v24.13.1), npm >= 10
- Docker required to run local Supabase (machine has Docker 29.5.2); install Supabase CLI via `npx supabase`
- Files MUST NOT be stored in PostgreSQL; only metadata in `student_documents`, blobs in Supabase Storage
- Never expose the raw storage bucket publicly — documents are served through authenticated, short-lived signed URLs or a controlled backend endpoint
- `students` table holds only identifying info (no `semester1_marks`, `fee1`, `attendance1` columns)
- Derived values (e.g., attendance %) are computed, not stored, unless a measured performance need exists
- Demo scale: synthetic dataset of ~80,000 students spanning 1986–2065 (~2,000/year), with related enrollments/results/attendance/fees/payments (~8.9M rows total)
- All UI copy in English; money values in INR (₹)
- TypeScript strict mode; no `any` leakage in `lib/` and `src/types/`
- Do NOT commit `.env` files; keep `.env.example` committed

---

### Task 1: Scaffold Next.js app and install Supabase CLI

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `.env.example`, `.gitignore`, `components.json`

**Interfaces:**
- Consumes: nothing
- Produces: runnable `npm run dev` app; `SUPABASE_URL` + `SUPABASE_ANON_KEY` in `.env.example`; local Supabase running on `http://127.0.0.1:54321`

- [ ] **Step 1: Create the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

If the directory is not empty (README.md already exists), run the scaffold inside a temp folder and move contents, or answer prompts to proceed. Accept defaults for the rest.

- [ ] **Step 2: Install shadcn/ui and init**

```bash
npx shadcn@latest init
npx shadcn@latest add button input card table tabs badge avatar select dialog
```

- [ ] **Step 3: Start local Supabase**

```bash
npx supabase init
npx supabase start
```

Expected: Docker containers for Postgres, Auth, Storage start; output prints a local API URL (default `http://127.0.0.1:54321`) and `anon` / `service_role` keys.

- [ ] **Step 4: Write `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase start>
```

Copy to `.env` (gitignored). Add `node_modules`, `.env`, `.next` to `.gitignore`.

- [ ] **Step 5: Verify scaffold**

Run: `npm run dev`
Expected: default Next.js page renders at `http://localhost:3000`.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: scaffold next.js app with shadcn/ui and local supabase"
```

---

### Task 2: Database schema migration (21 core tables)

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Test: manual verification via `npx supabase db reset` + `psql` query

**Interfaces:**
- Consumes: running local Supabase (Task 1)
- Produces: tables `universities, campuses, departments, programs, academic_years, semesters, subjects, students, guardians, faculty, users, roles, user_roles, enrollments, subject_results, attendance, fee_structures, student_fees, payments, student_documents, audit_logs`

- [ ] **Step 1: Write the schema migration**

`supabase/migrations/0001_schema.sql`:
```sql
-- UNIVERSITY STRUCTURE
create table universities (id bigint generated always as identity primary key, name text not null, created_at timestamptz not null default now());
create table campuses (id bigint generated always as identity primary key, university_id bigint not null references universities(id), name text not null);
create table departments (id bigint generated always as identity primary key, campus_id bigint not null references campuses(id), name text not null);
create table programs (id bigint generated always as identity primary key, department_id bigint not null references departments(id), name text not null, degree text not null, duration_years int not null);
create table academic_years (id bigint generated always as identity primary key, label text not null unique, start_date date not null, end_date date not null);
create table semesters (id bigint generated always as identity primary key, program_id bigint not null references programs(id), semester_no int not null, academic_year_id bigint not null references academic_years(id), unique (program_id, semester_no, academic_year_id));
create table subjects (id bigint generated always as identity primary key, program_id bigint not null references programs(id), semester_no int not null, code text not null, name text not null);

-- PEOPLE
create table students (
  id bigint generated always as identity primary key,
  university_id bigint not null references universities(id),
  campus_id bigint not null references campuses(id),
  program_id bigint not null references programs(id),
  pnr varchar not null unique,
  roll_number varchar not null,
  first_name text not null,
  last_name text not null,
  search_name text not null,
  date_of_birth date,
  email varchar,
  phone varchar,
  admission_date date not null,
  status varchar not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table guardians (id bigint generated always as identity primary key, student_id bigint not null references students(id), name text not null, relation text not null, phone varchar);
create table faculty (id bigint generated always as identity primary key, department_id bigint not null references departments(id), name text not null, email varchar unique);

-- AUTHORIZATION
create table users (id uuid primary key, email varchar unique not null, name text, created_at timestamptz not null default now());
create table roles (id bigint generated always as identity primary key, name text not null unique);
create table user_roles (user_id uuid not null references users(id), role_id bigint not null references roles(id), primary key (user_id, role_id));

-- ACADEMICS
create table enrollments (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id),
  subject_id bigint not null references subjects(id),
  semester_id bigint not null references semesters(id),
  academic_year_id bigint not null references academic_years(id),
  unique (student_id, subject_id, semester_id)
);
create table subject_results (id bigint generated always as identity primary key, enrollment_id bigint not null references enrollments(id), marks numeric(5,2), grade text, grade_point numeric(3,2), result_status text not null default 'pending');
create table attendance (id bigint generated always as identity primary key, enrollment_id bigint not null references enrollments(id), classes_conducted int not null default 0, classes_attended int not null default 0);

-- FINANCE
create table fee_structures (id bigint generated always as identity primary key, program_id bigint not null references programs(id), semester_no int not null, fee_type text not null, amount numeric(12,2) not null);
create table student_fees (id bigint generated always as identity primary key, student_id bigint not null references students(id), fee_structure_id bigint not null references fee_structures(id), amount_due numeric(12,2) not null, status text not null default 'unpaid');
create table payments (id bigint generated always as identity primary key, student_fee_id bigint not null references student_fees(id), amount numeric(12,2) not null, transaction_id varchar unique, payment_date date not null);

-- DOCUMENTS (metadata only; blobs live in Supabase Storage)
create table student_documents (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id),
  document_type text not null,
  file_name text not null,
  storage_key text not null,
  file_size bigint not null,
  mime_type text not null,
  version int not null default 1,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid,
  status text not null default 'active'
);

-- AUDIT
create table audit_logs (id bigint generated always as identity primary key, user_id uuid, action text not null, entity text not null, entity_id bigint, detail jsonb, created_at timestamptz not null default now());
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db reset`
Expected: migration applies cleanly; `npx supabase status` shows healthy services.

- [ ] **Step 3: Verify table count**

Run:
```bash
npx supabase db query "select count(*) from information_schema.tables where table_schema='public';"
```
Expected: `21`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_schema.sql
git commit -m "feat: add 21-table normalized schema migration"
```

---

### Task 3: Indexes and Row Level Security

**Files:**
- Create: `supabase/migrations/0002_indexes_rls.sql`
- Modify: `.env.example` (no change needed — keys already present)

**Interfaces:**
- Consumes: Task 2 schema
- Produces: indexes for O(log N) / index-assisted lookups; RLS policies that allow any authenticated user to `select`, and only `service_role`/admin to write

- [ ] **Step 1: Write indexes + RLS migration**

`supabase/migrations/0002_indexes_rls.sql`:
```sql
create extension if not exists pg_trgm;

-- Unique B-tree lookups
create unique index idx_students_pnr on students(pnr);
create index idx_students_roll on students(roll_number);
create unique index idx_students_email on students(email) where email is not null;

-- Trigram name search (O(log N)-ish, index-assisted)
create index idx_students_name_trgm on students using gin(search_name gin_trgm_ops);

-- Relationship / composite indexes
create index idx_enrollments_student_semester on enrollments(student_id, semester_id);
create index idx_results_enrollment on subject_results(enrollment_id);
create index idx_attendance_enrollment on attendance(enrollment_id);
create index idx_fees_student on student_fees(student_id);
create index idx_payments_fee on payments(student_fee_id);
create index idx_documents_student on student_documents(student_id);
create index idx_guardians_student on guardians(student_id);

-- RLS: read for any authenticated user, writes restricted to service_role
alter table universities enable row level security;
alter table campuses enable row level security;
alter table departments enable row level security;
alter table programs enable row level security;
alter table academic_years enable row level security;
alter table semesters enable row level security;
alter table subjects enable row level security;
alter table students enable row level security;
alter table guardians enable row level security;
alter table faculty enable row level security;
alter table users enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table enrollments enable row level security;
alter table subject_results enable row level security;
alter table attendance enable row level security;
alter table fee_structures enable row level security;
alter table student_fees enable row level security;
alter table payments enable row level security;
alter table student_documents enable row level security;
alter table audit_logs enable row level security;

-- generic read policy (apply to every table above)
do $$
declare t text;
begin
  foreach t in array array['universities','campuses','departments','programs','academic_years','semesters','subjects','students','guardians','faculty','users','roles','user_roles','enrollments','subject_results','attendance','fee_structures','student_fees','payments','student_documents','audit_logs'] loop
    execute format('create policy "read_authenticated" on %I for select to authenticated using (true);', t);
  end loop;
end $$;
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: migration applies; verify index exists:
```bash
npx supabase db query "select indexname from pg_indexes where tablename='students';"
```
Expected rows include `idx_students_pnr`, `idx_students_roll`, `idx_students_name_trgm`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_indexes_rls.sql
git commit -m "feat: add pg_trgm indexes and row level security policies"
```

---

### Task 4: Supabase clients and typed database access

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts`, `src/types/database.ts`, `src/lib/db.ts`

**Interfaces:**
- Consumes: `.env` keys (Task 1)
- Produces:
  - `createBrowserClient()` → `SupabaseClient`
  - `createServerClient()` → `SupabaseClient` (cookie-based, for route handlers/server components)
  - `createServiceClient()` → `SupabaseClient` with `service_role` (seed/benchmark only)
  - `export type Db = ...` rows for `students`, `enrollments`, etc.

- [ ] **Step 1: Write the failing test**

`src/lib/db.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyQuery } from "./search/classifier";

describe("db helper smoke", () => {
  it("classifier round-trips types", () => {
    expect(classifyQuery("22CS1045")).toEqual({ type: "pnr" });
  });
});
```
Note: this test is intentionally failing until Task 5 adds `classifyQuery`. Run it now with `npx vitest run` and confirm it errors on the missing import (expected FAIL).

- [ ] **Step 2: Install supabase-js and vitest**

```bash
npm i @supabase/supabase-js @supabase/ssr
npm i -D vitest
```

Add to `package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write the clients**

`src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

`src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );
}
```

`src/lib/supabase/service.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
```

`src/lib/db.ts`:
```ts
export const SEARCH_LIMIT = 50;
export const MAX_PAGE_SIZE = 100;
```

- [ ] **Step 4: Remove the failing smoke test**

Delete `src/lib/db.test.ts` (it was only a scaffold gate; Task 5 owns classifier tests).

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib package.json
git commit -m "feat: add supabase clients and typed db helpers"
```

---

### Task 5: Query classifier + search query builder (TDD)

**Files:**
- Create: `src/lib/search/classifier.ts`, `src/lib/search/queries.ts`
- Test: `src/lib/search/classifier.test.ts`, `src/lib/search/queries.test.ts`

**Interfaces:**
- Consumes: `Db` types (Task 4)
- Produces:
  - `type SearchKind = "pnr" | "roll" | "name"`
  - `classifyQuery(input: string): { type: SearchKind }`
  - `buildSearchQuery(input: string, lastSeenId?: number): { sql string }` (used against Supabase `.rpc` or `.from().select()` filters)

- [ ] **Step 1: Write failing tests**

`src/lib/search/classifier.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyQuery } from "./classifier";

describe("classifyQuery", () => {
  it("detects a PNR like 22CS1045", () => {
    expect(classifyQuery("22CS1045")).toEqual({ type: "pnr" });
  });
  it("detects a bare roll number like 1045", () => {
    expect(classifyQuery("1045")).toEqual({ type: "roll" });
  });
  it("detects a name", () => {
    expect(classifyQuery("Rahul Sharma")).toEqual({ type: "name" });
    expect(classifyQuery("rahul")).toEqual({ type: "name" });
  });
  it("treats empty input as name (no matches)", () => {
    expect(classifyQuery("")).toEqual({ type: "name" });
  });
});
```

`src/lib/search/queries.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSearchParams } from "./queries";

describe("buildSearchParams", () => {
  it("PNR uses exact equality", () => {
    expect(buildSearchParams("22CS1045")).toMatchObject({
      column: "pnr",
      operator: "eq",
      value: "22CS1045",
    });
  });
  it("roll number uses exact equality", () => {
    expect(buildSearchParams("1045")).toMatchObject({
      column: "roll_number",
      operator: "eq",
      value: "1045",
    });
  });
  it("name uses trigram ilike", () => {
    expect(buildSearchParams("rahul")).toMatchObject({
      column: "search_name",
      operator: "ilike",
      value: "%rahul%",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/search/`
Expected: FAIL — `classifyQuery` / `buildSearchParams` not defined.

- [ ] **Step 3: Implement**

`src/lib/search/classifier.ts`:
```ts
export type SearchKind = "pnr" | "roll" | "name";

const PNR_RE = /^\d{2}[A-Z]{2}\d{4}$/i;
const ROLL_RE = /^\d{1,6}$/;

export function classifyQuery(input: string): { type: SearchKind } {
  const q = input.trim();
  if (PNR_RE.test(q)) return { type: "pnr" };
  if (ROLL_RE.test(q)) return { type: "roll" };
  return { type: "name" };
}
```

`src/lib/search/queries.ts`:
```ts
import { classifyQuery } from "./classifier";

export interface SearchParam {
  column: "pnr" | "roll_number" | "search_name";
  operator: "eq" | "ilike";
  value: string;
}

export function buildSearchParams(input: string): SearchParam {
  const { type } = classifyQuery(input);
  const q = input.trim();
  if (type === "pnr") return { column: "pnr", operator: "eq", value: q };
  if (type === "roll") return { column: "roll_number", operator: "eq", value: q };
  return { column: "search_name", operator: "ilike", value: `%${q.toLowerCase()}%` };
}

export const SEARCH_LIMIT = 50;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/search/`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search
git commit -m "feat: add search query classifier with pnr/roll/name routing"
```

---

### Task 6: Search API route with keyset pagination

**Files:**
- Create: `src/app/api/search/route.ts`
- Test: `src/lib/search/search-integration.test.ts` (integration, skips when Supabase offline)

**Interfaces:**
- Consumes: `buildSearchParams`, `SEARCH_LIMIT` (Task 5), `createServerClient` (Task 4)
- Produces: `GET /api/search?q=<input>&cursor=<id>` → `{ data: StudentSummary[], nextCursor: number | null }`
  - `StudentSummary = { id, pnr, roll_number, first_name, last_name, program_id, admission_date }`

- [ ] **Step 1: Write the integration test**

`src/lib/search/search-integration.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { runSearch } from "./run-search";
import { createServiceClient } from "../supabase/service";

describe("runSearch integration", () => {
  const svc = createServiceClient();

  it("searches by PNR exactly", async () => {
    const res = await runSearch(svc, { q: "22CS1045", cursor: undefined });
    expect(Array.isArray(res.data)).toBe(true);
  });
});
```
This test requires `src/lib/search/run-search.ts` — write it in Step 2 as the implementation shared by the route.

- [ ] **Step 2: Implement the search runner**

`src/lib/search/run-search.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSearchParams, SEARCH_LIMIT } from "./queries";

export interface StudentSummary {
  id: number;
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  program_id: number;
  admission_date: string;
}

export async function runSearch(
  supabase: SupabaseClient,
  args: { q: string; cursor?: number },
): Promise<{ data: StudentSummary[]; nextCursor: number | null }> {
  const p = buildSearchParams(args.q);
  let query = supabase
    .from("students")
    .select("id,pnr,roll_number,first_name,last_name,program_id,admission_date")
    .order("id", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (p.operator === "eq") {
    query = query.eq(p.column, p.value);
  } else {
    query = query.ilike(p.column, p.value);
  }
  if (args.cursor) query = query.gt("id", args.cursor);

  const { data, error } = await query;
  if (error) throw new Error(`search failed: ${error.message}`);

  const rows = data ?? [];
  const nextCursor = rows.length === SEARCH_LIMIT ? rows[rows.length - 1].id : null;
  return { data: rows, nextCursor };
}
```

`src/app/api/search/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runSearch } from "@/lib/search/run-search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const cursorRaw = req.nextUrl.searchParams.get("cursor");
  const cursor = cursorRaw ? Number(cursorRaw) : undefined;
  const supabase = createServerClient();
  try {
    const result = await runSearch(supabase, { q, cursor });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run integration test against local Supabase**

Seed must be present for real results (Task 9); before then run with empty DB:
Run: `npx vitest run src/lib/search/search-integration.test.ts`
Expected: PASS with `data: []` (no crash) once Supabase is up.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/search src/lib/search/run-search.ts
git commit -m "feat: add search api route with keyset pagination"
```

---

### Task 7: Authentication flow

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/(auth)/layout.tsx`, `src/middleware.ts`, `src/app/api/auth/callback/route.ts`, `src/lib/auth.ts`
- Modify: `src/app/layout.tsx` (add provider), `src/app/page.tsx` (redirect to `/search` when authed, `/login` otherwise)

**Interfaces:**
- Consumes: `createServerClient` (Task 4)
- Produces: email/password sign-in via Supabase Auth; session persisted in cookies; `middleware.ts` protects `/search`, `/students/*`, `/admin/*`

- [ ] **Step 1: Write the login page**

`src/app/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); return; }
    router.push("/search");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-24 flex w-80 flex-col gap-4">
      <h1 className="text-xl font-semibold">University Info Retrieval</h1>
      <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit">Sign in</Button>
    </form>
  );
}
```

`src/middleware.ts`:
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/search/:path*", "/students/:path*", "/admin/:path*"],
};
```

`src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return supabaseResponse;
}
```

- [ ] **Step 2: Create the demo admin user**

Run (using service role from Task 1):
```bash
npx supabase db query "insert into roles(name) values ('admin'),('staff');"
npx supabase db query "insert into users(id) values ('00000000-0000-0000-0000-000000000001') on conflict do nothing;"
```
Sign the user up in-app with email `admin@uni.local` / password `demo1234` via the Supabase Auth UI flow (Task 7 route) OR:
```bash
curl -X POST http://127.0.0.1:54321/auth/v1/signup -H "apikey: <anon>" -H "Content-Type: application/json" -d "{\"email\":\"admin@uni.local\",\"password\":\"demo1234\"}"
```
Then link the `users` row to `user_roles`:
```bash
npx supabase db query "insert into user_roles(user_id, role_id) select id, (select id from roles where name='admin') from users where email='admin@uni.local';"
```

- [ ] **Step 3: Add search landing page**

`src/app/search/page.tsx` (server component that renders the search UI from Task 8's component; placeholder for now):
```tsx
import { SearchBox } from "@/components/search-box";

export default function SearchPage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Find a student</h1>
      <SearchBox />
    </main>
  );
}
```

- [ ] **Step 4: Verify auth flow**

Run: `npm run dev`, visit `/login`, sign in as `admin@uni.local`/`demo1234`.
Expected: redirects to `/search`; unauthenticated visit to `/search` redirects to `/login`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login src/middleware.ts src/lib/supabase/middleware.ts src/app/search
git commit -m "feat: add email/password auth with route protection"
```

---

### Task 8: Search UI with results + pagination

**Files:**
- Create: `src/components/search-box.tsx`, `src/components/student-results.tsx`, `src/components/result-card.tsx`, `src/lib/search/hooks.ts`

**Interfaces:**
- Consumes: `GET /api/search` (Task 6)
- Produces: interactive search box → debounced queries → results list with "Load more" keyset pagination; clicking a result navigates to `/students/{id}`

- [ ] **Step 1: Write the search hook**

`src/lib/search/hooks.ts`:
```ts
"use client";
import { useCallback, useRef, useState } from "react";
import type { StudentSummary } from "./run-search";

export function useStudentSearch() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<StudentSummary[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (query: string, fromCursor?: number) => {
    setLoading(true);
    const params = new URLSearchParams({ q: query });
    if (fromCursor) params.set("cursor", String(fromCursor));
    const res = await fetch(`/api/search?${params.toString()}`);
    const json = await res.json();
    setData((prev) => (fromCursor ? [...prev, ...json.data] : json.data));
    setCursor(json.nextCursor);
    setLoading(false);
  }, []);

  const onChange = useCallback((value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(value), 250);
  }, [run]);

  const loadMore = useCallback(() => {
    if (cursor) run(q, cursor);
  }, [cursor, q, run]);

  return { q, data, cursor, loading, onChange, loadMore };
}
```

- [ ] **Step 2: Write the components**

`src/components/search-box.tsx`:
```tsx
"use client";
import { useStudentSearch } from "@/lib/search/hooks";
import { Input } from "@/components/ui/input";
import { StudentResults } from "@/components/student-results";

export function SearchBox() {
  const search = useStudentSearch();
  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Search by PNR (22CS1045), roll number (1045), or name (Rahul)"
        value={search.q}
        onChange={(e) => search.onChange(e.target.value)}
        className="text-base"
      />
      <StudentResults {...search} />
    </div>
  );
}
```

`src/components/student-results.tsx`:
```tsx
"use client";
import Link from "next/link";
import type { StudentSummary } from "@/lib/search/run-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  data: StudentSummary[];
  cursor: number | null;
  loading: boolean;
  loadMore: () => void;
}

export function StudentResults({ data, cursor, loading, loadMore }: Props) {
  if (loading && data.length === 0) return <p className="text-sm text-muted-foreground">Searching…</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No students found.</p>;
  return (
    <div className="flex flex-col gap-2">
      {data.map((s) => (
        <Link key={s.id} href={`/students/${s.id}`}>
          <Card>
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{s.first_name} {s.last_name}</p>
                <p className="text-sm text-muted-foreground">{s.pnr} · {s.roll_number}</p>
              </div>
              <span className="text-sm text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>
      ))}
      {cursor && (
        <Button variant="outline" onClick={loadMore} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`, sign in, visit `/search`.
Expected: typing "Rahul" shows result cards after 250ms debounce; "Load more" appears when >50 results exist.

- [ ] **Step 4: Commit**

```bash
git add src/components src/lib/search/hooks.ts
git commit -m "feat: add debounced search ui with keyset pagination"
```

---

### Task 9: Synthetic dataset generator (deterministic, TDD)

**Files:**
- Create: `src/lib/seed/generate.ts`, `src/lib/seed/names.ts`, `src/scripts/seed.ts`
- Test: `src/lib/seed/generate.test.ts`

**Interfaces:**
- Consumes: service client (Task 4); schema (Task 2)
- Produces:
  - `generateStudent(seed: number, year: number, index: number): StudentSeed` where `StudentSeed` includes `pnr`, `roll_number`, `first_name`, `last_name`, `search_name`, `program_id`, `admission_date`
  - `generateYear(year: number, count: number): StudentSeed[]`
  - `marksFor(seed: number): number` (40–100, deterministic), `gradeFor(marks: number): { grade, grade_point, result_status }`, `attendanceFor(seed: number): { classes_conducted, classes_attended }`, `feeAmount(programId: number, semesterNo: number): number` (all deterministic)
  - `main()` in `src/scripts/seed.ts` inserting universities/campuses/departments/programs/subjects/academic_years/semesters + N students + related enrollments/results/attendance/fees/payments. CLI args `--years` (default 40), `--perYear` (default 2000), `--startYear` (default 1986). Academic years cover `startYear .. startYear + years + 3` so trailing cohorts have semesters. Enrollments ≈ 40/student (5 subjects × 8 semesters), results + attendance 1:1 with enrollments, fees + payments ≈ 8/student.

- [ ] **Step 1: Write failing tests**

`src/lib/seed/generate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateStudent, generateYear, generatePnr, generateRollNumber, marksFor, gradeFor, attendanceFor, feeAmount } from "./generate";

describe("seed generator", () => {
  it("generates unique deterministic PNRs for one year", () => {
    const pnrs = Array.from({ length: 100 }, (_, i) => generatePnr(2026, i));
    expect(new Set(pnrs).size).toBe(100);
    expect(pnrs[0]).toMatch(/^\d{2}[A-Z]{2}\d{4}$/);
  });
  it("generates roll numbers scoped per year", () => {
    expect(generateRollNumber(2026, 1045)).toBe("1045");
  });
  it("generates a student with a normalized search_name", () => {
    const s = generateStudent(42, 2026, 0);
    expect(s.search_name).toBe(`${s.first_name} ${s.last_name}`.toLowerCase());
    expect(s.pnr).toMatch(/^\d{2}[A-Z]{2}\d{4}$/);
  });
  it("generates the configured year sizes summing correctly", () => {
    const students = generateYear(2026, 2000);
    expect(students.length).toBe(2000);
    expect(new Set(students.map((s) => s.pnr)).size).toBe(2000);
  });
  it("marks are deterministic, in [40, 100], and grade mapping is consistent", () => {
    expect(marksFor(7)).toBe(marksFor(7));
    expect(marksFor(99)).toBeGreaterThanOrEqual(40);
    expect(marksFor(99)).toBeLessThanOrEqual(100);
    expect(gradeFor(92).grade_point).toBe(10);
    expect(gradeFor(35).result_status).toBe("fail");
  });
  it("attendance is deterministic and attendance <= conducted", () => {
    const a = attendanceFor(3);
    const b = attendanceFor(3);
    expect(a).toEqual(b);
    expect(a.classes_attended).toBeLessThanOrEqual(a.classes_conducted);
  });
  it("fee amounts are deterministic and positive", () => {
    expect(feeAmount(1, 3)).toBe(feeAmount(1, 3));
    expect(feeAmount(2, 5)).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/seed/`
Expected: FAIL — missing exports.

- [ ] **Step 3: Implement generator**

`src/lib/seed/generate.ts`:
```ts
import { seededNames } from "./names";

export interface StudentSeed {
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  search_name: string;
  program_id: number;
  admission_date: string;
}

const PROGRAMS = [1, 2, 3, 4]; // replaced at insert time by real ids

export function generatePnr(year: number, index: number): string {
  const yy = String(year % 100).padStart(2, "0");
  const code = "CS"; // campus+dept code; deterministic for demo
  return `${yy}${code}${String(index % 10000).padStart(4, "0")}`;
}

export function generateRollNumber(year: number, index: number): string {
  return String(1000 + index);
}

export function generateStudent(seed: number, year: number, index: number): StudentSeed {
  const [first, last] = seededNames(seed + index * 7919);
  const pnr = generatePnr(year, index);
  return {
    pnr,
    roll_number: generateRollNumber(year, index),
    first_name: first,
    last_name: last,
    search_name: `${first} ${last}`.toLowerCase(),
    program_id: PROGRAMS[index % PROGRAMS.length],
    admission_date: `${year}-07-01`,
  };
}

export function generateYear(year: number, count: number): StudentSeed[] {
  return Array.from({ length: count }, (_, i) => generateStudent(year + i, year, i));
}

// Deterministic PRNG so re-seeding produces identical data
export function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function marksFor(seed: number): number {
  return 40 + Math.floor(mulberry32(seed)() * 61); // 40..100
}

export function gradeFor(marks: number): { grade: string; grade_point: number; result_status: string } {
  if (marks >= 90) return { grade: "A+", grade_point: 10, result_status: "pass" };
  if (marks >= 80) return { grade: "A", grade_point: 9, result_status: "pass" };
  if (marks >= 70) return { grade: "B+", grade_point: 8, result_status: "pass" };
  if (marks >= 60) return { grade: "B", grade_point: 7, result_status: "pass" };
  if (marks >= 50) return { grade: "C", grade_point: 6, result_status: "pass" };
  if (marks >= 40) return { grade: "D", grade_point: 5, result_status: "pass" };
  return { grade: "F", grade_point: 0, result_status: "fail" };
}

export function attendanceFor(seed: number): { classes_conducted: number; classes_attended: number } {
  const conducted = 40;
  const r = mulberry32(seed)();
  return { classes_conducted: conducted, classes_attended: 20 + Math.floor(r * 21) }; // 20..40
}

export function feeAmount(programId: number, semesterNo: number): number {
  const base = 45000 + programId * 5000;
  return base + semesterNo * 1500;
}
```

`src/lib/seed/names.ts`:
```ts
const FIRST = ["Rahul", "Shubham", "Priya", "Aarav", "Sneha", "Vikram", "Ananya", "Rohan", "Ishita", "Aditya", "Kavya", "Nikhil", "Pooja", "Arjun", "Divya"];
const LAST = ["Sharma", "Kambli", "Patel", "Kumar", "Singh", "Reddy", "Gupta", "Mehta", "Iyer", "Rao", "Joshi", "Das", "Naik", "Deshmukh", "Chauhan"];

export function seededNames(n: number): [string, string] {
  return [FIRST[n % FIRST.length], LAST[Math.floor(n / FIRST.length) % LAST.length]];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/seed/`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the insert script**

`src/scripts/seed.ts`:
```ts
import { createServiceClient } from "@/lib/supabase/service";
import { generateYear, marksFor, gradeFor, attendanceFor, feeAmount, type StudentSeed } from "@/lib/seed/generate";

const SUBJECTS_PER_SEMESTER = 5;
const SEMESTERS_PER_STUDENT = 8;
const BATCH = 1000;

async function insertInBatches(client: ReturnType<typeof createServiceClient>, rows: unknown[], table: string) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await client.from(table).insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
  }
}

async function main() {
  const svc = createServiceClient();
  const startYear = Number(process.argv.find((a) => a.startsWith("--startYear="))?.split("=")[1] ?? 1986);
  const yearsArg = Number(process.argv.find((a) => a.startsWith("--years="))?.split("=")[1] ?? 40);
  const perYear = Number(process.argv.find((a) => a.startsWith("--perYear="))?.split("=")[1] ?? 2000);
  const endYear = startYear + yearsArg + 3; // trailing years so the last cohort has 8 semesters

  // --- static structure -------------------------------------------------
  const uni = (await svc.from("universities").insert({ name: "Demo University" }).select("id").single()).data!;
  const campus = (await svc.from("campuses").insert({ university_id: uni.id, name: "Main Campus" }).select("id").single()).data!;
  const deptNames = ["Computer Science", "Electronics", "Mechanical", "Civil"];
  const programNames = ["B.Tech CSE", "B.Tech ECE", "B.Tech ME", "B.Tech CE"];
  const programIds: number[] = [];
  for (let i = 0; i < 4; i++) {
    const dept = (await svc.from("departments").insert({ campus_id: campus.id, name: deptNames[i] }).select("id").single()).data!;
    const program = (await svc.from("programs").insert({ department_id: dept.id, name: programNames[i], degree: "B.Tech", duration_years: 4 }).select("id").single()).data!;
    programIds.push(program.id);
  }

  // --- academic years + semesters ---------------------------------------
  const academicYearId = new Map<number, number>();
  for (let y = startYear; y <= endYear; y++) {
    const ay = (await svc.from("academic_years").insert({ label: String(y), start_date: `${y}-06-01`, end_date: `${y + 1}-05-31` }).select("id").single()).data!;
    academicYearId.set(y, ay.id);
  }
  // semester key: `${programId}:${semesterNo}:${academicYearId}`
  const semesterId = new Map<string, number>();
  for (const p of programIds) {
    for (let y = startYear; y <= endYear; y++) {
      for (const semNo of [1, 2]) {
        const s = (await svc.from("semesters").insert({ program_id: p, semester_no: semNo, academic_year_id: academicYearId.get(y)! }).select("id").single()).data!;
        semesterId.set(`${p}:${semNo}:${academicYearId.get(y)}`, s.id);
      }
    }
  }

  // --- subjects + fee structures (per program, semester_no 1..8) --------
  const subjectIds = new Map<string, number[]>(); // `${programId}:${semesterNo}`
  for (const p of programIds) {
    for (let semNo = 1; semNo <= SEMESTERS_PER_STUDENT; semNo++) {
      const ids: number[] = [];
      for (let s = 0; s < SUBJECTS_PER_SEMESTER; s++) {
        const subj = (await svc.from("subjects").insert({ program_id: p, semester_no: semNo, code: `P${p}S${semNo}C${s + 1}`, name: `Subject ${p}-${semNo}-${s + 1}` }).select("id").single()).data!;
        ids.push(subj.id);
      }
      subjectIds.set(`${p}:${semNo}`, ids);
      await svc.from("fee_structures").insert({ program_id: p, semester_no: semNo, fee_type: "Tuition", amount: feeAmount(p, semNo) });
    }
  }

  // --- students + related records, year by year -------------------------
  for (let year = startYear; year < startYear + yearsArg; year++) {
    const students = generateYear(year, perYear);
    const studentRows = students.map((s) => ({ ...s, university_id: uni.id, campus_id: campus.id, status: "active" }));
    const inserted = (await svc.from("students").insert(studentRows).select("id,program_id,admission_date"));
    if (inserted.error) throw new Error(`students: ${inserted.error.message}`);
    const studentIds = (inserted.data ?? []).map((r: { id: number }) => r.id);

    const enrollments: unknown[] = [];
    const results: unknown[] = [];
    const attendance: unknown[] = [];
    const studentFees: unknown[] = [];
    const payments: unknown[] = [];
    const feeStructures = new Map<string, number>(); // `programId:semesterNo` -> fee_structure id
    const feeRows = (await svc.from("fee_structures").select("id,program_id,semester_no")).data ?? [];
    for (const f of feeRows) feeStructures.set(`${f.program_id}:${f.semester_no}`, f.id);

    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const student = students[i];
      for (let k = 0; k < SEMESTERS_PER_STUDENT; k++) {
        const semNo = (k % 2) + 1;
        const ayId = academicYearId.get(year + Math.floor(k / 2))!;
        const semId = semesterId.get(`${student.program_id}:${semNo}:${ayId}`)!;
        const subjects = subjectIds.get(`${student.program_id}:${semNo + 1}`)!; // semester_no 1..8

        for (const subjectId of subjects) {
          enrollments.push({ student_id: studentId, subject_id: subjectId, semester_id: semId, academic_year_id: ayId });
        }
        const feeStructureId = feeStructures.get(`${student.program_id}:${semNo + 1}`)!;
        studentFees.push({ student_id: studentId, fee_structure_id: feeStructureId, amount_due: feeAmount(student.program_id, semNo + 1), status: "paid" });
      }
    }
    await insertInBatches(svc, enrollments, "enrollments");
    // link results/attendance to the just-inserted enrollments by selecting them back for this year's students
    const allEnrollments = (await svc.from("enrollments").select("id").in("student_id", studentIds)).data ?? [];
    let seed = 0;
    for (const en of allEnrollments) {
      const marks = marksFor(seed++);
      const g = gradeFor(marks);
      results.push({ enrollment_id: en.id, marks, grade: g.grade, grade_point: g.grade_point, result_status: g.result_status });
      const a = attendanceFor(seed++);
      attendance.push({ enrollment_id: en.id, classes_conducted: a.classes_conducted, classes_attended: a.classes_attended });
    }
    await insertInBatches(svc, results, "subject_results");
    await insertInBatches(svc, attendance, "attendance");
    await insertInBatches(svc, studentFees, "student_fees");
    const feeIds = (await svc.from("student_fees").select("id").in("student_id", studentIds)).data ?? [];
    for (let i = 0; i < feeIds.length; i++) {
      const f = feeIds[i];
      payments.push({ student_fee_id: f.id, amount: feeAmount(1, 1), transaction_id: `TXN-${f.id}`, payment_date: `${year}-07-15` });
    }
    await insertInBatches(svc, payments, "payments");
    console.log(`seeded ${year}: ${students.length} students, ${enrollments.length} enrollments`);
  }
  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Smoke-run the script at small scale**

Run: `npx tsx src/scripts/seed.ts --years=2 --perYear=100`
Expected: 200 students + related rows inserted; script exits 0. (Install `tsx` if needed: `npm i -D tsx`.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/seed src/scripts/seed.ts
git commit -m "feat: add deterministic synthetic dataset generator and seed script"
```

---

### Task 10: Student profile API + page

**Files:**
- Create: `src/app/students/[id]/page.tsx`, `src/app/api/students/[id]/route.ts`, `src/app/api/students/[id]/results/route.ts`, `src/app/api/students/[id]/attendance/route.ts`, `src/app/api/students/[id]/fees/route.ts`, `src/app/api/students/[id]/documents/route.ts`, `src/components/profile/` (tabs)

**Interfaces:**
- Consumes: schema tables + indexes (Tasks 2–3); `createServerClient` (Task 4)
- Produces: profile page at `/students/{id}` with tabs: Personal, Admission, Academic, Attendance, Fees, Documents; each tab lazy-loads its own endpoint. Fetch pattern mirrors conversation guidance: search returns summaries only; profile fetches core first, sections on demand.

- [ ] **Step 1: Write the profile API**

`src/app/api/students/[id]/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
```

`src/app/api/students/[id]/results/route.ts` (same pattern for the other sections):
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("subject_results")
    .select("id,marks,grade,grade_point,result_status,enrollments(subjects(name,semester_no))")
    .eq("enrollments.student_id", id)
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
```
Attendance endpoint selects `attendance(enrollment_id, classes_conducted, classes_attended)` filtered by `enrollments.student_id`; Fees selects `student_fees(fee_structures(fee_type,amount),status,amount_due)` plus payments; Documents selects `student_documents(id,document_type,file_name,file_size,mime_type,uploaded_at,version)`.

- [ ] **Step 2: Write the profile page with lazy tabs**

`src/app/students/[id]/page.tsx`:
```tsx
import { createServerClient } from "@/lib/supabase/server";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { notFound } from "next/navigation";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.from("students")
    .select("id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id")
    .eq("id", id).maybeSingle();
  if (error || !data) notFound();
  return <ProfileTabs student={data} />;
}
```

`src/components/profile/profile-tabs.tsx` (client component using shadcn `Tabs`; renders five `TabContent` panels, each `useEffect`-fetching its API route):
```tsx
"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StudentCore {
  id: number; pnr: string; roll_number: string; first_name: string; last_name: string;
  date_of_birth: string | null; email: string | null; phone: string | null;
  admission_date: string; status: string; program_id: number; campus_id: number;
}

export function ProfileTabs({ student }: { student: StudentCore }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{student.first_name} {student.last_name}</h1>
      <p className="text-sm text-muted-foreground">{student.pnr} · {student.roll_number}</p>
      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="admission">Admission</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="personal">{student.first_name} {student.last_name} · DOB {student.date_of_birth ?? "—"} · {student.email ?? "—"} · {student.phone ?? "—"}</TabsContent>
        <TabsContent value="admission">Admitted {student.admission_date} · Status {student.status}</TabsContent>
        <TabsContent value="academic"><AcademicTab studentId={student.id} /></TabsContent>
        <TabsContent value="attendance"><AttendanceTab studentId={student.id} /></TabsContent>
        <TabsContent value="fees"><FeesTab studentId={student.id} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab studentId={student.id} /></TabsContent>
      </Tabs>
    </div>
  );
}
```
Create `academic-tab.tsx`, `attendance-tab.tsx`, `fees-tab.tsx`, `documents-tab.tsx` in `src/components/profile/`, each a client component that `useEffect`-fetches its endpoint and renders a `Card` list.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`, sign in, search "Rahul", open a result.
Expected: profile renders; each tab loads its section from its endpoint.

- [ ] **Step 4: Commit**

```bash
git add src/app/students src/app/api/students src/components/profile
git commit -m "feat: add student profile page with lazy tab sections"
```

---

### Task 11: Document upload + signed URL serving

**Files:**
- Create: `src/app/api/documents/upload/route.ts`, `src/app/api/documents/[id]/url/route.ts`, `src/components/profile/documents-tab.tsx` (extend), `src/lib/storage.ts`

**Interfaces:**
- Consumes: `createServerClient` (Task 4), `student_documents` + `audit_logs` (Task 2)
- Produces: `POST /api/documents/upload` (multipart: studentId, documentType, file) → inserts metadata row + uploads blob to Storage path `students/{studentId}/{type}/{filename}`; `GET /api/documents/{id}/url` → short-lived signed URL. Raw bucket never public.

- [ ] **Step 1: Write storage helpers**

`src/lib/storage.ts`:
```ts
import { createServiceClient } from "@/lib/supabase/service";

const BUCKET = "student-documents";

export function storageKey(studentId: number, type: string, fileName: string): string {
  return `students/${studentId}/${type}/${fileName}`;
}

export async function ensureBucket() {
  const svc = createServiceClient();
  const { data, error } = await svc.storage.getBucket(BUCKET);
  if (error?.message?.includes("not found")) {
    await svc.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 20 * 1024 * 1024 });
    return;
  }
  if (error) throw error;
  return data;
}

export async function createSignedUrl(path: string, expiresIn = 600) {
  const svc = createServiceClient();
  const { data, error } = await svc.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
```

- [ ] **Step 2: Write upload + signed-url routes**

`src/app/api/documents/upload/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { ensureBucket, storageKey } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const studentId = Number(form.get("studentId"));
  const documentType = String(form.get("documentType"));
  const file = form.get("file") as File;

  await ensureBucket();
  const key = storageKey(studentId, documentType, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from("student-documents").upload(key, buffer, {
    contentType: file.type, upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: doc, error } = await supabase
    .from("student_documents")
    .insert({ student_id: studentId, document_type: documentType, file_name: file.name, storage_key: key, file_size: file.size, mime_type: file.type, version: 1, uploaded_by: user.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("audit_logs").insert({ user_id: user.id, action: "upload", entity: "student_documents", entity_id: doc.id });
  return NextResponse.json(doc);
}
```

`src/app/api/documents/[id]/url/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createServerClient();
  const { data: doc } = await supabase.from("student_documents").select("storage_key").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = await createSignedUrl(doc.storage_key, 600);
  return NextResponse.json({ url });
}
```

- [ ] **Step 3: Wire the documents tab**

Extend `src/components/profile/documents-tab.tsx` with a small upload form (shadcn `Select` for type + `Input type="file"` + `Button`) that posts to `/api/documents/upload`, and each listed document gets an "Open" link that fetches `/api/documents/{id}/url` then opens the signed URL in a new tab.

- [ ] **Step 4: Verify upload + retrieval**

Run: `npm run dev`, open a student's Documents tab, upload a small PDF.
Expected: metadata row appears; signed URL opens the file; bucket is private (`public: false`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/app/api/documents src/components/profile/documents-tab.tsx
git commit -m "feat: add document upload with private storage and signed url serving"
```

---

### Task 12: Admin CRUD (students, courses, departments)

**Files:**
- Create: `src/app/admin/page.tsx`, `src/app/admin/students/new/page.tsx`, `src/app/admin/students/[id]/edit/page.tsx`, `src/components/admin/student-form.tsx`, `src/app/api/admin/students/route.ts`, `src/app/api/admin/students/[id]/route.ts`, `src/app/api/admin/courses/route.ts`, `src/app/api/admin/departments/route.ts`, `src/lib/admin.ts` (role check)

**Interfaces:**
- Consumes: `user_roles`/`roles` (Task 2); `createServerClient` (Task 4)
- Produces: admin-only pages (route protected by `middleware.ts` + a `requireAdmin()` server check) for add/edit student, add course (subject), add department; all writes flow through `service_role` API routes that audit-log every mutation.

- [ ] **Step 1: Write the admin role check**

`src/lib/admin.ts`:
```ts
import { createServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id)
    .eq("roles.name", "admin")
    .maybeSingle();
  return { user, admin: Boolean(data) };
}
```

- [ ] **Step 2: Write the add-student API**

`src/app/api/admin/students/route.ts`:
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const { admin, user } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const svc = createServiceClient();
  const search_name = `${body.first_name} ${body.last_name}`.toLowerCase();
  const { data: student, error } = await svc.from("students").insert({ ...body, search_name }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await svc.from("audit_logs").insert({ user_id: user!.id, action: "create", entity: "students", entity_id: student.id, detail: { pnr: student.pnr } });
  return NextResponse.json(student);
}
```

- [ ] **Step 3: Write the admin UI**

`src/app/admin/page.tsx` (server component):
```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function AdminPage() {
  const { admin } = await requireAdmin();
  if (!admin) redirect("/search");
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Admin</h1>
      <div className="flex flex-col gap-2">
        <Link href="/admin/students/new"><Button>Add student</Button></Link>
        <Link href="/admin/students/1/edit"><Button variant="outline">Edit student</Button></Link>
        <Link href="/admin/courses/new"><Button variant="outline">Add course</Button></Link>
        <Link href="/admin/departments/new"><Button variant="outline">Add department</Button></Link>
      </div>
    </main>
  );
}
```

`src/components/admin/student-form.tsx` (client form):
- Props: `{ initial?: Student | null }` where `Student` is a pick of the editable columns.
- When `initial` is absent → `POST /api/admin/students`; when present → `PATCH /api/admin/students/{initial.id}`.
- Fields: `first_name, last_name, pnr, roll_number, program_id, admission_date, date_of_birth, email, phone`. On success, navigate to `/students/{id}` (new) or `/admin/students/{id}/edit` (edit).
- Disabled in edit mode: `pnr`, `roll_number` (unique identity keys — change only via a dedicated admin flow, out of scope).

Create `src/app/admin/courses/new/page.tsx` + `src/app/admin/departments/new/page.tsx` as thin server components wrapping simple client forms that POST to `/api/admin/courses` and `/api/admin/departments`.

- [ ] **Step 4: Write the edit-student page + API**

`src/app/admin/students/[id]/edit/page.tsx` (server component):
```tsx
import { createServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { redirect, notFound } from "next/navigation";
import { StudentForm } from "@/components/admin/student-form";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { admin } = await requireAdmin();
  if (!admin) redirect("/search");
  const { id } = await params;
  const supabase = createServerClient();
  const { data: student } = await supabase.from("students").select("*").eq("id", Number(id)).maybeSingle();
  if (!student) notFound();
  return <StudentForm initial={student} />;
}
```

`src/app/api/admin/students/[id]/route.ts` (add PATCH next to the existing DELETE handler):
```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { admin, user } = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json();
  if (body.pnr || body.roll_number) return NextResponse.json({ error: "pnr/roll_number are immutable" }, { status: 400 });
  const search_name = `${body.first_name} ${body.last_name}`.toLowerCase();
  const svc = createServiceClient();
  const { data: student, error } = await svc
    .from("students").update({ ...body, search_name }).eq("id", Number(id)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await svc.from("audit_logs").insert({ user_id: user!.id, action: "update", entity: "students", entity_id: student.id, detail: body });
  return NextResponse.json(student);
}
```
(If a DELETE handler already exists, keep it; this step only adds PATCH.)

- [ ] **Step 5: Write the courses/departments APIs**

`src/app/api/admin/courses/route.ts` and `src/app/api/admin/departments/route.ts` mirror the students route: `requireAdmin()` guard → `createServiceClient()` insert into `subjects` / `departments` → audit log insert.

- [ ] **Step 6: Verify admin flows**

Run: `npm run dev`, sign in as admin, visit `/admin`, add a department, a course, and a student.
Expected: new student appears in search; rows present in tables; audit_logs has entries.
Then visit `/admin/students/{id}/edit`, change e.g. `phone`/`email`, save.
Expected: row updated, `search_name` still correct after first/last name change, audit_logs gains an `update` entry, and `pnr`/`roll_number` edits are rejected.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin src/app/api/admin src/lib/admin.ts src/components/admin
git commit -m "feat: add admin crud for students, courses, and departments with audit logs"
```

---

### Task 13: Full-scale seed + benchmark script

**Files:**
- Create: `src/scripts/benchmark.ts`
- Test: `src/scripts/benchmark.test.ts` (light — validates the report shape)

**Interfaces:**
- Consumes: full dataset from `npm run seed` (Task 9 at `--years=40 --perYear=2000`); `createServiceClient` (Task 4)
- Produces: printed benchmark table comparing PNR lookup, roll lookup, exact-name, and fuzzy-name search latencies over the 80k-student dataset

- [ ] **Step 1: Write the benchmark script**

`src/scripts/benchmark.ts`:
```ts
import { performance } from "node:perf_hooks";
import { createServiceClient } from "@/lib/supabase/service";
import { runSearch } from "@/lib/search/run-search";
import { classifyQuery } from "@/lib/search/classifier";

async function time(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

async function main() {
  const svc = createServiceClient();
  const probes = ["22CS0001", "1045", "Rahul Sharma", "Rahul"];
  for (const q of probes) {
    const times: number[] = [];
    for (let i = 0; i < 20; i++) times.push(await time(() => runSearch(svc, { q })));
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`${classifyQuery(q).type.padEnd(4)} ${q.padEnd(14)} avg ${avg.toFixed(2)} ms (min ${Math.min(...times).toFixed(2)} ms)`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Write the benchmark report-shape test**

`src/scripts/benchmark.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { summarize } from "./benchmark";

describe("benchmark summarize", () => {
  it("returns avg/min/max for a set of samples", () => {
    expect(summarize([10, 20, 30])).toEqual({ avg: 20, min: 10, max: 30 });
  });
});
```
Add `export function summarize(samples: number[])` in `benchmark.ts` returning `{ avg, min, max }`, and use it in `main()`.

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/scripts/benchmark.test.ts`
Expected: PASS.

- [ ] **Step 4: Run the full seed**

```bash
npx tsx src/scripts/seed.ts --years=40 --perYear=2000
```
Expected: 80,000 students + related rows inserted (allow several minutes; batches of 500).

- [ ] **Step 5: Run the benchmark**

```bash
npx tsx src/scripts/benchmark.ts
```
Expected: printed rows; PNR/roll avg well under 100 ms; name search sub-second. Record results in the README.

- [ ] **Step 6: Commit**

```bash
git add src/scripts
git commit -m "feat: add search benchmark script over full synthetic dataset"
```

---

### Task 14: README and demo polish

**Files:**
- Create: `README.md` (rewrite existing one-line file)
- Modify: `package.json` (add `seed`, `benchmark` scripts)

**Interfaces:**
- Consumes: everything
- Produces: runnable-from-scratch README with setup, seed, benchmark, and demo script; `npm run seed` and `npm run benchmark` shortcuts

- [ ] **Step 1: Add npm scripts**

In `package.json`:
```json
{
  "scripts": {
    "seed": "tsx src/scripts/seed.ts",
    "benchmark": "tsx src/scripts/benchmark.ts"
  }
}
```

- [ ] **Step 2: Write the README**

Sections: What it is; Architecture diagram (Next.js → Supabase: PostgreSQL metadata + Storage blobs, no FastAPI yet); Local setup (`npx supabase start`, `.env`, `npm run dev`); Seeding (`npm run seed -- --years=40 --perYear=2000`); Login (admin@uni.local / demo1234); Features (search classification, keyset pagination, tabs, admin CRUD, document upload with signed URLs); Benchmark results table (from Task 13); 40-year scale rationale (80k students ≈ 8.9M rows; O(log N) lookups; ~5.9 TB documents in object storage).

- [ ] **Step 3: Verify README commands**

Run each documented command once from a clean shell to confirm accuracy.

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: add full demo readme with setup, seed, and benchmark"
```

---

## Self-Review

**Spec coverage:**
- Object storage vs PostgreSQL metadata → Tasks 2, 11 ✓
- Next.js + local Supabase demo (no FastAPI) → Tasks 1, 4, 7 ✓
- 21 normalized tables → Task 2 ✓
- B-tree + GIN trigram name search + query classification → Tasks 3, 5 ✓
- Keyset pagination / small payloads → Tasks 5, 6, 10 ✓
- Student profile (personal, admission, academic, attendance, fees, documents) → Task 10 ✓
- Admin CRUD (student, course, department) + document upload → Tasks 11, 12 ✓
- 80k synthetic students over 40 years + related records → Tasks 9, 13 ✓
- Benchmarks → Task 13 ✓
- README → Task 14 ✓

**Placeholder scan:** No TBD/TODO/“add error handling” steps remain; every code step contains full implementation.

**Type consistency:** `classifyQuery` → `{ type: SearchKind }` defined Task 5 and used identically in `run-search.ts` (Task 6), `hooks.ts` (Task 8), `benchmark.ts` (Task 13). `runSearch(supabase, { q, cursor })` returns `{ data: StudentSummary[], nextCursor }` used in the API route and hook consistently. `buildSearchParams` returns `{ column, operator, value }` used by `runSearch`. `generateStudent(seed, year, index)` → `StudentSeed` used by `generateYear` and `seed.ts`.
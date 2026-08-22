#!/usr/bin/env tsx
/**
 * scaffold-table.ts — `npm run add-table -- <name>`
 *
 * Generates:
 *  - supabase/migrations/NNNN_<name>.sql  (full template per §8.1 ordering)
 *  - patch src/types/database.ts          (interface stub + Db.Tables entry)
 *  - optional src/scripts/seed-<name>.ts  (--seed)
 *
 * Numbering: reads highest NNNN prefix in supabase/migrations and increments.
 * Template ordering per spec §8.1:
 *   1. create table (id bigint generated always as identity primary key, created_at/updated_at)
 *   2. indexes (idx_<table>_<columns>)
 *   3. alter table enable row level security
 *   4. RLS policies (read_authenticated + role-specific)
 *   5. grants
 *   6. optional seed stub
 *
 * Usage:
 *   npm run add-table -- my_table
 *   npm run add-table -- my_table --seed
 */

import * as fs from "node:fs";
import * as path from "node:path";

function toPascalCase(snake: string): string {
  return snake
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function parseArgs(): { table: string | null; withSeed: boolean; help: boolean } {
  const raw = process.argv.slice(2);
  let table: string | null = null;
  let withSeed = false;
  let help = false;
  for (const a of raw) {
    if (a === "--help" || a === "-h") help = true;
    else if (a === "--seed" || a === "--with-seed") withSeed = true;
    else if (a.startsWith("--")) {
      console.warn(`Unknown flag ${a} — ignored`);
    } else if (!table) {
      table = a;
    }
  }
  return { table, withSeed, help };
}

function printUsage(): void {
  console.log(`
Usage: npm run add-table -- <table_name> [--seed]

  <table_name>  snake_case, singular (e.g. audit_event, dummy_feature)
                kebab-case is normalized to snake_case
  --seed        also generate src/scripts/seed-<name>.ts stub
  --help        show this message

What it does:
  1. Creates supabase/migrations/NNNN_<name>.sql (numbered after highest existing NNNN)
  2. Patches src/types/database.ts with interface <Pascal> + Db.Tables entry
  3. Optionally creates src/scripts/seed-<name>.ts

Template follows docs/schema-conventions.md §8.1 ordering:
  create table → indexes → enable RLS → policies → grants → optional seed
`);
}

function resolveRepoRoot(): string {
  // When run via `tsx --env-file=.env src/scripts/scaffold-table.ts`, cwd is repo root.
  // Fallback to two levels up from this file if cwd does not contain supabase/migrations.
  const cwdMigrations = path.join(process.cwd(), "supabase", "migrations");
  if (fs.existsSync(cwdMigrations)) return process.cwd();
  // __dirname for this script is src/scripts
  const fallback = path.resolve(__dirname, "../..");
  if (fs.existsSync(path.join(fallback, "supabase", "migrations"))) return fallback;
  return process.cwd();
}

function nextMigrationNumber(migrationsDir: string): { n: number; padded: string } {
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return { n: 1, padded: "0001" };
  }
  const files = fs.readdirSync(migrationsDir);
  let max = 0;
  for (const f of files) {
    const m = f.match(/^(\d{4})_/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return { n: next, padded: String(next).padStart(4, "0") };
}

function normalizeTableName(raw: string): string {
  // normalize kebab to snake, lower
  let name = raw.trim().toLowerCase().replace(/-/g, "_");
  // strip leading/trailing underscores
  name = name.replace(/^_+|_+$/g, "");
  return name;
}

function validateTableName(name: string): string | null {
  if (!name) return "table name is required (e.g. npm run add-table -- my_table)";
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return `invalid table name "${name}": must be snake_case, start with a letter, only [a-z0-9_]`;
  }
  if (name.includes("__")) return `invalid table name "${name}": no consecutive underscores`;
  if (name.length > 50) return `invalid table name "${name}": too long (max 50)`;
  // reserved check
  const reserved = new Set(["select", "table", "index", "view", "user", "role"]);
  if (reserved.has(name)) return `invalid table name "${name}": reserved keyword`;
  return null;
}

function migrationTemplate(table: string): string {
  const idx = `idx_${table}_created_at`;
  return `-- ${table} — scaffolded via \`npm run add-table -- ${table}\`
-- Conventions: docs/schema-conventions.md §8.1 ordering
-- 1) create table  2) indexes  3) enable RLS  4) policies  5) grants  6) optional seed
-- Edit domain columns, indexes, and policies inline before committing.

-- 1) create table — id + timestamps required; add domain columns below
create table if not exists ${table} (
  id bigint generated always as identity primary key,
  -- TODO: add domain columns (snake_case, not null where required, FKs with on delete as appropriate)
  -- example: title text not null,
  -- example: course_id bigint references courses(id) on delete cascade,
  -- example: status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) indexes — naming idx_<table>_<columns>; add composite/covering indexes for real query paths
create index if not exists ${idx} on ${table}(created_at);
-- TODO: add indexes for FKs / filter / sort paths
-- create index if not exists idx_${table}_course on ${table}(course_id);
-- create unique index if not exists idx_${table}_unique_key on ${table}(key) where key is not null;

-- 3) RLS — enable (defense-in-depth; API routes enforce permissions explicitly via src/lib/auth/rbac.ts)
alter table ${table} enable row level security;

-- 4) policies — read_authenticated base + least-privilege write
--    Write roles should be narrowed per docs/schema-conventions.md (e.g. super_admin/admin/teacher/accountant/viewer)
do $$
begin
  if not exists (select 1 from pg_policies where tablename = '${table}' and policyname = 'read_authenticated') then
    create policy read_authenticated on ${table} for select to authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = '${table}' and policyname = 'write_admin') then
    create policy write_admin on ${table} for all to authenticated
      using (current_user_role() in ('super_admin','admin'))
      with check (current_user_role() in ('super_admin','admin'));
  end if;
end $$;
-- TODO: narrow write_admin roles to least privilege per table, or split into insert/update/delete policies
-- e.g. using (current_user_role() in ('super_admin','admin','teacher')) for teacher-owned tables

-- 5) grants — least privilege; service_role bypasses RLS, authenticated via policies
grant select on ${table} to authenticated;
grant all on ${table} to service_role;
-- sequence for the identity column
grant usage, select on sequence ${table}_id_seq to service_role;

-- 6) optional seed (idempotent) — uncomment and adapt
-- insert into ${table} (id, created_at) values (1, now()) on conflict (id) do nothing;
`;
}

function patchDatabaseTypes(repoRoot: string, table: string, pascal: string): { patched: boolean; message: string } {
  const dbPath = path.join(repoRoot, "src", "types", "database.ts");
  if (!fs.existsSync(dbPath)) {
    return { patched: false, message: `src/types/database.ts not found at ${dbPath} — skipping type stub` };
  }
  let content = fs.readFileSync(dbPath, "utf8");

  const interfaceExists = new RegExp(`export\\s+interface\\s+${pascal}\\b`).test(content);
  const tableEntryExists = new RegExp(`\\b${table}:\\s*\\{\\s*Row:\\s*${pascal}\\b`).test(content);

  if (interfaceExists && tableEntryExists) {
    return { patched: false, message: `Types already contain ${pascal} / ${table} — skipping patch` };
  }

  // 1) insert interface before `export interface Db {`
  if (!interfaceExists) {
    const interfaceStub = `export interface ${pascal} {\n  id: number;\n  created_at: string;\n  updated_at: string;\n}\n\n`;
    const dbAnchor = "export interface Db {";
    const idx = content.indexOf(dbAnchor);
    if (idx === -1) {
      // fallback: append before last occurrence of "export interface UserRow"
      const fallbackAnchor = "export interface UserRow";
      const fIdx = content.indexOf(fallbackAnchor);
      if (fIdx !== -1) {
        content = content.slice(0, fIdx) + interfaceStub + content.slice(fIdx);
      } else {
        content = content + "\n" + interfaceStub;
      }
    } else {
      content = content.slice(0, idx) + interfaceStub + content.slice(idx);
    }
  }

  // 2) insert Db.Tables entry — find Tables close before Views
  if (!tableEntryExists) {
    const viewsAnchor = "    Views: {";
    const viewsIdx = content.indexOf(viewsAnchor);
    if (viewsIdx === -1) {
      return { patched: false, message: "Could not locate Views anchor in Db type — interface added but Tables entry skipped (add manually)" };
    }
    // find the last `    };` before Views — that's the Tables closing
    const beforeViews = content.slice(0, viewsIdx);
    const lastCloseIdx = beforeViews.lastIndexOf("    };");
    if (lastCloseIdx === -1) {
      return { patched: false, message: "Could not locate Tables closing `    };` — Tables entry skipped" };
    }
    const entry = `      ${table}: { Row: ${pascal}; Insert: Omit<${pascal}, "id" | "created_at" | "updated_at"> & { id?: number; created_at?: string; updated_at?: string }; Update: Partial<${pascal}> };\n`;
    content = content.slice(0, lastCloseIdx) + entry + content.slice(lastCloseIdx);
  }

  fs.writeFileSync(dbPath, content, "utf8");
  return { patched: true, message: `Patched src/types/database.ts: added ${pascal} + Db.Tables.${table}` };
}

function seedStubContent(table: string): string {
  return `// seed-${table}.ts — optional seed for table \`${table}\`
// Usage: npx tsx --env-file=.env src/scripts/seed-${table}.ts
// Idempotent: uses onConflict / on conflict do nothing; safe to re-run.
// Keep BATCH 500 and guard as in src/scripts/seed.ts.

import { createServiceClient } from "@/lib/supabase/service";

const BATCH = 500;

async function main() {
  const svc = createServiceClient();

  // Example: ensure table is empty or guard against double-seed
  // const { count } = await svc.from("${table}").select("id", { count: "exact", head: true });
  // if ((count ?? 0) > 0) { console.log("${table} already seeded — skipping"); return; }

  const rows: Record<string, unknown>[] = [
    // TODO: replace with real seed rows for ${table}
    // { created_at: new Date().toISOString() },
  ];

  if (rows.length === 0) {
    console.log("No seed rows for ${table} — edit src/scripts/seed-${table}.ts first");
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await svc.from("${table}").insert(slice);
    if (error) throw new Error(\`${table} batch \${i}: \${error.message}\`);
  }
  console.log(\`Seeded \${rows.length} rows into ${table}\`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
`;
}

function main(): void {
  const { table: rawTable, withSeed, help } = parseArgs();
  if (help || !rawTable) {
    printUsage();
    process.exit(help ? 0 : 1);
  }

  const table = normalizeTableName(rawTable);
  if (table !== rawTable.toLowerCase().replace(/-/g, "_")) {
    console.log(`Normalized "${rawTable}" → "${table}"`);
  }

  const validationError = validateTableName(table);
  if (validationError) {
    console.error(`Error: ${validationError}`);
    printUsage();
    process.exit(1);
  }

  const pascal = toPascalCase(table);
  const repoRoot = resolveRepoRoot();
  const migrationsDir = path.join(repoRoot, "supabase", "migrations");
  const { padded } = nextMigrationNumber(migrationsDir);

  const migrationFileName = `${padded}_${table}.sql`;
  const migrationPath = path.join(migrationsDir, migrationFileName);

  if (fs.existsSync(migrationPath)) {
    console.error(`Error: migration already exists: ${migrationPath}`);
    process.exit(1);
  }

  // Also guard against existing table name with different number
  const existing = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith(`_${table}.sql`))
    : [];
  if (existing.length > 0) {
    console.error(`Error: a migration for table "${table}" already exists: ${existing.join(", ")}`);
    process.exit(1);
  }

  fs.mkdirSync(migrationsDir, { recursive: true });
  const sql = migrationTemplate(table);
  fs.writeFileSync(migrationPath, sql, "utf8");
  console.log(`✔ Migration created: supabase/migrations/${migrationFileName}`);

  const patchResult = patchDatabaseTypes(repoRoot, table, pascal);
  console.log(patchResult.patched ? `✔ ${patchResult.message}` : `ℹ ${patchResult.message}`);

  if (withSeed) {
    const seedDir = path.join(repoRoot, "src", "scripts");
    fs.mkdirSync(seedDir, { recursive: true });
    const seedPath = path.join(seedDir, `seed-${table}.ts`);
    if (fs.existsSync(seedPath)) {
      console.log(`ℹ Seed stub already exists: src/scripts/seed-${table}.ts — skipping`);
    } else {
      fs.writeFileSync(seedPath, seedStubContent(table), "utf8");
      console.log(`✔ Seed stub created: src/scripts/seed-${table}.ts`);
    }
  } else {
    console.log(`ℹ Seed stub not created (pass --seed to generate src/scripts/seed-${table}.ts)`);
  }

  console.log(`
Next steps:
  1. Edit supabase/migrations/${migrationFileName} — add domain columns, indexes, and narrow RLS roles.
  2. Extend the ${pascal} interface in src/types/database.ts with real columns.
  3. Run: npx tsc --noEmit && npm run lint
  4. Apply: npx supabase db reset   (or npx supabase migration up)
  5. If adding writes: add zod schema in src/lib/validation/schemas.ts, permission key in supabase/migrations/*_rbac*, and cache prefix in src/lib/cache/index.ts if Redis-cached.

Docs: docs/schema-conventions.md
`);
}

main();

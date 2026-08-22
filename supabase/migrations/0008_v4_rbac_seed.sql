-- 0008_v4_rbac_seed.sql — RBAC: permissions, role_permissions + seed matrix

create table if not exists permissions (
  id bigint generated always as identity primary key,
  key text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_permissions (
  id bigint generated always as identity primary key,
  role_name text not null check (role_name in ('super_admin','admin','teacher','accountant','viewer')),
  permission_id bigint not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role_name, permission_id)
);

-- seed permissions keys (as per plan)
insert into permissions (key, description) values
  ('student:write',      'Create/update student records'),
  ('student:delete',     'Delete student records'),
  ('fees:read',          'Read fee data'),
  ('fees:approve',       'Approve fee payments / receipts'),
  ('docs:verify',        'Verify documents'),
  ('timetable:write',    'Create/update timetables'),
  ('exam:publish',       'Publish exam results'),
  ('teacher:write',      'Create/update teacher records'),
  ('course:write',       'Create/update course records'),
  ('attendance:write',   'Mark attendance'),
  ('notification:send',  'Send notifications')
on conflict (key) do nothing;

-- grant matrix (data, not code)
-- super_admin = all permissions
-- admin = all except docs:verify optional; plan says admin gets student:delete -> include it, but not docs:verify
-- teacher = attendance:write, exam:publish, timetable:write
-- accountant = fees:read, fees:approve
-- viewer = no write keys

-- helper to upsert role_permissions
with perm as (select id, key from permissions)
insert into role_permissions (role_name, permission_id)
select 'super_admin', id from perm
on conflict (role_name, permission_id) do nothing;

with perm as (select id from permissions where key in ('student:write','student:delete','fees:read','fees:approve','timetable:write','exam:publish','teacher:write','course:write','attendance:write','notification:send'))
insert into role_permissions (role_name, permission_id) select 'admin', id from perm
on conflict do nothing;

with perm as (select id from permissions where key in ('attendance:write','exam:publish','timetable:write'))
insert into role_permissions (role_name, permission_id) select 'teacher', id from perm
on conflict do nothing;

with perm as (select id from permissions where key in ('fees:read','fees:approve'))
insert into role_permissions (role_name, permission_id) select 'accountant', id from perm
on conflict do nothing;

-- viewer gets no write permissions; intentionally zero rows for viewer

-- ensure idempotency: no duplicate inserts on re-run (handled via on conflict)

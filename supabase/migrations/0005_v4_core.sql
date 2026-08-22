-- 0005_v4_core.sql — v4 core + reference data
-- Dependency order: reservation_category -> courses (from programs) -> departments adjustments -> teachers (from faculty) -> rooms -> intake_plan -> category_seat_eligibility -> students modifications
-- Idempotent guards where practical; designed to run once via supabase db reset.

-- 1) reservation_category (14 categories)
create table if not exists reservation_category (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  parent_code text references reservation_category(code) on delete set null,
  category_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- seed 14 categories (OPEN, OBC, SC, ST, EWS, NT, VINT, SBC, SFBC, MINORITY, TFWS, GEWS, CAP, I_CAP)
insert into reservation_category (code, name, parent_code, category_type) values
  ('OPEN',     'Open / General',                null, 'general'),
  ('OBC',      'Other Backward Class',          null, 'reserved'),
  ('SC',       'Scheduled Caste',               null, 'reserved'),
  ('ST',       'Scheduled Tribe',               null, 'reserved'),
  ('EWS',      'Economically Weaker Section',   null, 'reserved'),
  ('NT',       'Nomadic Tribe',                null, 'reserved'),
  ('VINT',     'Vimukta Jati / NT',             'NT', 'reserved'),
  ('SBC',      'Special Backward Class',        null, 'reserved'),
  ('SFBC',     'Socially & Educationally Backward Class', null, 'reserved'),
  ('MINORITY', 'Minority',                      null, 'special'),
  ('TFWS',     'Tuition Fee Waiver Scheme',     null, 'quota'),
  ('GEWS',     'General EWS',                   null, 'quota'),
  ('CAP',      'Centralised Admission Process', null, 'quota'),
  ('I_CAP',    'Institutional CAP',             'CAP', 'quota')
on conflict (code) do nothing;

-- 2) departments adjustments: add timestamps if missing (existing departments: id, campus_id, name)
alter table departments add column if not exists created_at timestamptz not null default now();
alter table departments add column if not exists updated_at timestamptz not null default now();

-- 3) courses — replaces programs via rename to preserve FKs (semesters, subjects, fee_structures reference programs)
do $$
begin
  -- if courses does not exist but programs does, rename
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='programs')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='courses') then
    alter table programs rename to courses;
  end if;
end $$;

create table if not exists courses (
  id bigint generated always as identity primary key,
  department_id bigint not null references departments(id),
  branch_or_course text not null,
  course_type text not null,
  duration_years int not null,
  credits int not null default 160,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- if rename path was taken, adjust columns
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='courses' and column_name='name') then
    alter table courses rename column name to branch_or_course;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='courses' and column_name='degree') then
    alter table courses rename column degree to course_type;
  end if;
end $$;

alter table courses add column if not exists credits int not null default 160;
alter table courses add column if not exists description text;
alter table courses add column if not exists created_at timestamptz not null default now();
alter table courses add column if not exists updated_at timestamptz not null default now();
alter table courses add column if not exists branch_or_course text;
alter table courses add column if not exists course_type text;
-- ensure not-null after backfill (if any existing rows have null, fill)
update courses set branch_or_course = coalesce(branch_or_course, 'Unknown') where branch_or_course is null;
update courses set course_type = coalesce(course_type, 'B.Tech') where course_type is null;
alter table courses alter column branch_or_course set not null;
alter table courses alter column course_type set not null;

-- 4) teachers — replaces faculty via rename
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='faculty')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='teachers') then
    alter table faculty rename to teachers;
  end if;
end $$;

create table if not exists teachers (
  id bigint generated always as identity primary key,
  department_id bigint not null references departments(id),
  name text not null default '',
  employee_id text not null unique,
  designation text,
  email text not null unique,
  phone text,
  joining_date date,
  salary numeric(12,2),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- adjust if rename path taken (faculty had department_id, name, email)
alter table teachers add column if not exists employee_id text;
alter table teachers add column if not exists designation text;
alter table teachers add column if not exists phone text;
alter table teachers add column if not exists joining_date date;
alter table teachers add column if not exists salary numeric(12,2);
alter table teachers add column if not exists status text not null default 'active';
alter table teachers add column if not exists created_at timestamptz not null default now();
alter table teachers add column if not exists updated_at timestamptz not null default now();
alter table teachers add column if not exists name text not null default '';
-- backfill employee_id for existing rows (faculty rows)
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='teachers' and column_name='employee_id') then
    update teachers set employee_id = 'EMP-' || lpad(id::text, 6, '0') where employee_id is null;
  end if;
end $$;
-- ensure employee_id unique and not null (create unique index if not exists)
do $$
begin
  if not exists (select 1 from pg_indexes where tablename='teachers' and indexname='idx_teachers_employee_id') then
    create unique index idx_teachers_employee_id on teachers(employee_id);
  end if;
  if not exists (select 1 from pg_indexes where tablename='teachers' and indexname='idx_teachers_email_unique') then
    -- teachers.email already unique via table constraint if exists; keep index for safety
    create unique index idx_teachers_email_unique on teachers(email) where email is not null;
  end if;
end $$;

-- 5) rooms
create table if not exists rooms (
  id bigint generated always as identity primary key,
  name text not null,
  building text,
  capacity int not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6) intake_plan
create table if not exists intake_plan (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  batch_year int not null,
  intake_stream text not null,
  total_seats int not null,
  general_open_seats int not null default 0,
  tfws_seats int not null default 0,
  ews_seats int not null default 0,
  reserved_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, batch_year, intake_stream)
);

-- 7) category_seat_eligibility
create table if not exists category_seat_eligibility (
  id bigint generated always as identity primary key,
  category_id bigint not null references reservation_category(id) on delete cascade,
  seat_type text not null,
  admission_mode text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, seat_type, admission_mode)
);

-- seed eligibility (open -> general, reserved categories -> reserved/special seats)
insert into category_seat_eligibility (category_id, seat_type, admission_mode)
select rc.id, s.seat_type, s.admission_mode
from reservation_category rc
cross join (values
  ('general','CAP'),
  ('reserved','CAP'),
  ('tfws','CAP'),
  ('ews','CAP'),
  ('institute','Institute')
) as s(seat_type, admission_mode)
where rc.code in ('OPEN','OBC','SC','ST','EWS','NT','VINT','SBC','SFBC','MINORITY','TFWS','GEWS','CAP','I_CAP')
on conflict (category_id, seat_type, admission_mode) do nothing;

-- 8) students modifications
alter table students add column if not exists category_id bigint references reservation_category(id);
alter table students add column if not exists abc_id text;
alter table students add column if not exists gender text;
alter table students add column if not exists aadhaar_number text;
alter table students add column if not exists aadhaar_hash text;
alter table students add column if not exists address text;
alter table students add column if not exists city text;
alter table students add column if not exists state text;
alter table students add column if not exists country text not null default 'India';
alter table students add column if not exists blood_group text;
alter table students add column if not exists photo_path text;
alter table students add column if not exists guardian_name text;
alter table students add column if not exists guardian_contact_number text;

-- backfill guardian_name/contact from guardians table if exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='guardians') then
    -- take first guardian per student
    update students s
    set guardian_name = g.name,
        guardian_contact_number = g.phone
    from (select distinct on (student_id) student_id, name, phone from guardians order by student_id, id) g
    where g.student_id = s.id and s.guardian_name is null;
  end if;
end $$;

-- default category_id to OPEN for existing rows
do $$
declare open_id bigint;
begin
  select id into open_id from reservation_category where code='OPEN' limit 1;
  if open_id is not null then
    update students set category_id = open_id where category_id is null;
  end if;
end $$;

-- aadhaar_hash unique index (deterministic SHA-256 hex, nullable but unique when present)
create unique index if not exists idx_students_aadhaar_hash on students(aadhaar_hash) where aadhaar_hash is not null;
create index if not exists idx_students_category on students(category_id);
create index if not exists idx_students_abc on students(abc_id) where abc_id is not null;

-- students FK was program_id -> now courses; if programs was renamed, FK already points to courses
-- ensure column still references courses (re-add FK if needed)
do $$
begin
  -- programs FK may still be named; keep as is since rename preserves FK target oid
  -- add course_id alias if code still uses program_id, keep program_id column as legacy alias to courses
  -- for v4, program_id is the courses FK; ensure index exists
  if not exists (select 1 from pg_indexes where tablename='students' and indexname='idx_students_program') then
    create index if not exists idx_students_program on students(program_id);
  end if;
end $$;

-- drop guardians table (inlined into students)
drop table if exists guardians cascade;

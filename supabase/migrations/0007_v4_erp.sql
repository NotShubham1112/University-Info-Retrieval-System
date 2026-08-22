-- 0007_v4_erp.sql — ERP modules: fee_category_rates, fee_payments, documents (from student_documents), scholarships, achievements, assignments, timetables, notifications, student_status_history, drop audit_logs

-- 1) fee_category_rates — replaces fee_structures
create table if not exists fee_category_rates (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  year_of_study int not null,
  academic_year text not null,
  fee_type text not null default 'Tuition',
  amount numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, year_of_study, academic_year, fee_type)
);
-- backfill from fee_structures if exists (fee_structures: program_id, semester_no, fee_type, amount)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='fee_structures') then
    insert into fee_category_rates (course_id, year_of_study, academic_year, fee_type, amount)
    select
      fs.program_id as course_id,
      ((fs.semester_no - 1) / 2) + 1 as year_of_study,
      '2024-25' as academic_year,
      fs.fee_type,
      fs.amount
    from fee_structures fs
    on conflict do nothing;
  end if;
end $$;

-- 2) scholarships + scholarship_applications (must exist before fee_payments FK)
create table if not exists scholarships (
  id bigint generated always as identity primary key,
  name text not null,
  provider text,
  amount numeric(12,2),
  eligibility jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scholarship_applications (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  scholarship_id bigint not null references scholarships(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','disbursed')),
  applied_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scholarship_apps_student on scholarship_applications(student_id);

-- 3) fee_payments — merges student_fees + payments
create table if not exists fee_payments (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  fee_category_rate_id bigint references fee_category_rates(id) on delete set null,
  scholarship_application_id bigint references scholarship_applications(id) on delete set null,
  amount_due numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','paid','partial','overdue','refunded')),
  transaction_id text unique,
  payment_date date,
  payment_mode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_fee_payments_student on fee_payments(student_id);
create index if not exists idx_fee_payments_student_date on fee_payments(student_id, payment_date);
create index if not exists idx_fee_payments_status on fee_payments(status);

-- backfill fee_payments from student_fees + payments if they exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='student_fees')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='payments') then
    insert into fee_payments (student_id, fee_category_rate_id, amount_due, amount_paid, status, transaction_id, payment_date, payment_mode)
    select
      sf.student_id,
      -- try to map fee_structure_id to fee_category_rates (by course/fee_type/amount) else keep null
      null::bigint as fee_category_rate_id,
      sf.amount_due,
      coalesce(p.amount, 0) as amount_paid,
      case when sf.status = 'paid' then 'paid' when sf.status = 'unpaid' then 'unpaid' else 'partial' end as status,
      p.transaction_id,
      p.payment_date,
      'online' as payment_mode
    from student_fees sf
    left join lateral (select * from payments where student_fee_id = sf.id order by payment_date desc limit 1) p on true
    on conflict do nothing;
  end if;
end $$;

-- after backfill, drop old finance tables (student_fees depends on fee_structures, payments depends on student_fees)
drop table if exists payments cascade;
drop table if exists student_fees cascade;
drop table if exists fee_structures cascade;

-- 4) documents — rename student_documents -> documents + verified columns
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='student_documents')
     and not exists (select 1 from information_schema.tables where table_schema='public' and table_name='documents') then
    alter table student_documents rename to documents;
  end if;
end $$;

create table if not exists documents (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_key text not null,
  file_size bigint not null,
  mime_type text not null,
  version int not null default 1,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid,
  status text not null default 'active',
  verified_status text not null default 'pending' check (verified_status in ('pending','verified','rejected')),
  verified_by uuid,
  verified_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table documents add column if not exists verified_status text not null default 'pending';
alter table documents add column if not exists verified_by uuid;
alter table documents add column if not exists verified_date timestamptz;
alter table documents add column if not exists created_at timestamptz not null default now();
alter table documents add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_documents_student on documents(student_id);

-- 5) achievements: extra_curricular, certifications, internships
create table if not exists extra_curricular (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  activity_name text not null,
  role text,
  achievement text,
  academic_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_extra_curricular_student on extra_curricular(student_id);

create table if not exists certifications (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  title text not null,
  issuer text,
  issue_date date,
  credential_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_certifications_student on certifications(student_id);

create table if not exists internships (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  company text not null,
  role text,
  start_date date,
  end_date date,
  status text not null default 'ongoing' check (status in ('ongoing','completed','terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_internships_student on internships(student_id);

-- 6) assignments + assignment_submissions
create table if not exists assignments (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  subject_id bigint references subjects(id) on delete set null,
  teacher_id bigint references teachers(id) on delete set null,
  title text not null,
  description text,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_assignments_course on assignments(course_id);

create table if not exists assignment_submissions (
  id bigint generated always as identity primary key,
  assignment_id bigint not null references assignments(id) on delete cascade,
  student_id bigint not null references students(id) on delete cascade,
  file_path text,
  storage_key text,
  submitted_at timestamptz not null default now(),
  grade text,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index if not exists idx_assignment_submissions_student on assignment_submissions(student_id);

-- 7) timetables
create table if not exists timetables (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  semester_no int not null,
  day_of_week int not null check (day_of_week between 1 and 7),
  period_no int not null,
  subject_id bigint references subjects(id) on delete set null,
  teacher_id bigint references teachers(id) on delete set null,
  room_id bigint references rooms(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, semester_no, day_of_week, period_no)
);
create index if not exists idx_timetables_teacher_day on timetables(teacher_id, day_of_week);
create index if not exists idx_timetables_room_day on timetables(room_id, day_of_week);
create index if not exists idx_timetables_course_sem on timetables(course_id, semester_no);

-- 8) notifications + notification_recipients
create table if not exists notifications (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  type text not null default 'general' check (type in ('general','academic','fee','exam','admin')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  channel text not null default 'in_app' check (channel in ('in_app','email','sms')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_recipients (
  id bigint generated always as identity primary key,
  notification_id bigint not null references notifications(id) on delete cascade,
  recipient_role text,
  student_id bigint references students(id) on delete cascade,
  status text not null default 'unread' check (status in ('unread','read','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (recipient_role is not null or student_id is not null)
);
create index if not exists idx_notif_recipients_role on notification_recipients(recipient_role);
create index if not exists idx_notif_recipients_student on notification_recipients(student_id);
create index if not exists idx_notif_recipients_notification on notification_recipients(notification_id);

-- 9) student_status_history
create table if not exists student_status_history (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_status_history_student on student_status_history(student_id);

-- 10) drop audit_logs (replaced by student_status_history + scoped trail)
drop table if exists audit_logs cascade;

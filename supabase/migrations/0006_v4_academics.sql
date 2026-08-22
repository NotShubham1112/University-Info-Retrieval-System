-- 0006_v4_academics.sql — academics: exams, admissions, subject_marks, semester_records, academic_progress, backlogs

-- 1) exams (must exist before subject_marks / exam_subjects)
create table if not exists exams (
  id bigint generated always as identity primary key,
  course_id bigint not null references courses(id) on delete cascade,
  semester_no int not null,
  exam_type text not null check (exam_type in ('midterm','final','internal','external','supplementary')),
  date date,
  status text not null default 'draft' check (status in ('draft','scheduled','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_exams_course_sem on exams(course_id, semester_no);

-- 2) exam_subjects
create table if not exists exam_subjects (
  id bigint generated always as identity primary key,
  exam_id bigint not null references exams(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  max_marks int not null default 100,
  pass_marks int not null default 40,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, subject_id)
);
create index if not exists idx_exam_subjects_exam on exam_subjects(exam_id);
create index if not exists idx_exam_subjects_subject on exam_subjects(subject_id);

-- 3) admissions — one row per student admission (distinct from per-subject enrollments)
create table if not exists admissions (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  course_id bigint not null references courses(id),
  academic_year_id bigint references academic_years(id),
  category_id bigint references reservation_category(id),
  admission_mode text not null default 'CAP' check (admission_mode in ('CAP','Institute','Management','TFWS','EWS','CAP-MINORITY')),
  seat_type text not null default 'general' check (seat_type in ('general','reserved','tfws','ews','institute','minority')),
  intake_stream text not null default 'CAP' check (intake_stream in ('CAP','Institute','TFWS','EWS','Minority')),
  roll_number varchar not null,
  expected_grad_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id),
  unique (roll_number)
);
create index if not exists idx_admissions_student on admissions(student_id);
create index if not exists idx_admissions_course on admissions(course_id);
create index if not exists idx_admissions_intake on admissions(intake_stream, expected_grad_year);

-- backfill admissions from existing students + enrollments (if enrollments exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='enrollments')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='admissions') then
    insert into admissions (student_id, course_id, academic_year_id, category_id, admission_mode, seat_type, intake_stream, roll_number, expected_grad_year)
    select
      s.id as student_id,
      s.program_id as course_id,
      (select min(academic_year_id) from enrollments e where e.student_id = s.id) as academic_year_id,
      s.category_id as category_id,
      'CAP' as admission_mode,
      'general' as seat_type,
      'CAP' as intake_stream,
      s.roll_number as roll_number,
      extract(year from s.admission_date)::int + 4 as expected_grad_year
    from students s
    on conflict (student_id) do nothing;
  end if;
end $$;

-- 4) subject_marks — replaces subject_results (internal/external split, attempt_number, exam_id)
create table if not exists subject_marks (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  exam_id bigint references exams(id) on delete set null,
  internal_marks numeric(5,2),
  external_marks numeric(5,2),
  marks numeric(5,2),
  grade text,
  grade_point numeric(4,2),
  result_status text not null default 'pending' check (result_status in ('pending','pass','fail','absent')),
  attempt_number int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subject_marks_student on subject_marks(student_id);
create index if not exists idx_subject_marks_subject on subject_marks(subject_id);
create index if not exists idx_subject_marks_exam on subject_marks(exam_id);
create index if not exists idx_subject_marks_student_attempt on subject_marks(student_id, attempt_number);

-- backfill subject_marks from subject_results + enrollments if both exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='subject_results')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='enrollments') then
    insert into subject_marks (student_id, subject_id, exam_id, internal_marks, external_marks, marks, grade, grade_point, result_status, attempt_number)
    select
      e.student_id,
      e.subject_id,
      null as exam_id,
      null as internal_marks,
      sr.marks as external_marks,
      sr.marks as marks,
      sr.grade,
      sr.grade_point,
      case when sr.result_status = 'pass' then 'pass' when sr.result_status = 'fail' then 'fail' else 'pending' end as result_status,
      1 as attempt_number
    from subject_results sr
    join enrollments e on e.id = sr.enrollment_id
    on conflict do nothing;
  end if;
end $$;

-- 5) semester_records
create table if not exists semester_records (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  semester_no int not null,
  sgpa numeric(4,2),
  result_status text not null default 'pending' check (result_status in ('pending','pass','fail','ATKT')),
  declared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, semester_no)
);
create index if not exists idx_semester_records_student_sem on semester_records(student_id, semester_no);

-- 6) academic_progress
create table if not exists academic_progress (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade unique,
  current_semester int not null default 1,
  backlog_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_academic_progress_student on academic_progress(student_id);

-- 7) backlogs
create table if not exists backlogs (
  id bigint generated always as identity primary key,
  student_id bigint not null references students(id) on delete cascade,
  subject_id bigint not null references subjects(id) on delete cascade,
  attempt int not null default 1,
  cleared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, subject_id, attempt)
);
create index if not exists idx_backlogs_student_cleared on backlogs(student_id, cleared);

-- drop legacy tables after backfill (enrollments, subject_results)
-- order matters: subject_results references enrollments -> drop subject_results first
drop table if exists subject_results cascade;
drop table if exists enrollments cascade;

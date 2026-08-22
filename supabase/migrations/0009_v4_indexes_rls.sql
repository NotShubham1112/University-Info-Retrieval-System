-- 0009_v4_indexes_rls.sql — composite/covering indexes per spec §4.1, RLS enable + base policies, helper, grants

-- Helper: current_user_role() — SECURITY DEFINER reading JWT claim; defense-in-depth (API routes are primary gate)
create or replace function current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'user_metadata' ->> 'role'),
    'viewer'
  );
$$;
grant execute on function current_user_role() to authenticated, service_role;

-- Grants: usage + table privileges (service_role bypasses RLS, authenticated via policies)
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
-- for future tables created after this migration, ensure grants via default privileges (must be run as owner; best-effort)
do $$
begin
  -- default grants for tables/sequences created by postgres owner in public schema
  -- these statements are safe even if not superuser on local; on hosted they run as owner
  begin
    execute 'alter default privileges in schema public grant select on tables to authenticated';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'alter default privileges in schema public grant all on tables to service_role';
  exception when insufficient_privilege then null;
  end;
  begin
    execute 'alter default privileges in schema public grant all on sequences to service_role';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Indexes per spec §4.1 (composite/covering for real query paths)
-- students (campus_id, program_id) — program_id is courses FK after rename
create index if not exists idx_students_campus_program on students(campus_id, program_id);
-- students.category already idx_students_category from 0005
-- pg_trgm idx_students_name_trgm already from 0002
create index if not exists idx_students_category2 on students(category_id);
create index if not exists idx_admissions_student on admissions(student_id);
create index if not exists idx_admissions_intake_batch on admissions(intake_stream, expected_grad_year);
create index if not exists idx_subject_marks_student_attempt on subject_marks(student_id, attempt_number);
create index if not exists idx_subject_marks_subject on subject_marks(subject_id);
create index if not exists idx_subject_marks_exam on subject_marks(exam_id);
create index if not exists idx_semester_records_student_sem on semester_records(student_id, semester_no);
create index if not exists idx_fee_payments_student_date on fee_payments(student_id, payment_date);
create index if not exists idx_fee_payments_status on fee_payments(status);
create index if not exists idx_backlogs_student_cleared on backlogs(student_id, cleared);
create index if not exists idx_documents_student on documents(student_id);
create index if not exists idx_status_history_student on student_status_history(student_id);
create index if not exists idx_intake_plan_course_batch on intake_plan(course_id, batch_year);
create index if not exists idx_timetables_teacher_day on timetables(teacher_id, day_of_week);
create index if not exists idx_timetables_room_day on timetables(room_id, day_of_week);
create index if not exists idx_teachers_department on teachers(department_id);
-- teachers.email unique already
create index if not exists idx_exams_course_sem on exams(course_id, semester_no);
create index if not exists idx_notif_recipients_role on notification_recipients(recipient_role);
-- attendance (if still present after 0006 — enrollments may have been dropped with cascade)
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='attendance') then
    if not exists (select 1 from pg_indexes where tablename='attendance' and indexname='idx_attendance_enrollment_legacy') then
      create index idx_attendance_enrollment_legacy on attendance(enrollment_id);
    end if;
  end if;
end $$;

-- RLS: enable on every new/modified table
do $$
declare t text;
begin
  foreach t in array array[
    'reservation_category','courses','teachers','rooms','intake_plan','category_seat_eligibility',
    'students',
    'exams','exam_subjects','admissions','subject_marks','semester_records','academic_progress','backlogs',
    'fee_category_rates','scholarships','scholarship_applications','fee_payments',
    'documents','extra_curricular','certifications','internships','assignments','assignment_submissions',
    'timetables','notifications','notification_recipients','student_status_history',
    'permissions','role_permissions'
  ] loop
    execute format('alter table %I enable row level security;', t);
  end loop;
end $$;

-- Base read_authenticated policies for every table (defense-in-depth; API service_role bypasses)
do $$
declare t text;
begin
  foreach t in array array[
    'reservation_category','courses','teachers','rooms','intake_plan','category_seat_eligibility',
    'students','exams','exam_subjects','admissions','subject_marks','semester_records','academic_progress','backlogs',
    'fee_category_rates','scholarships','scholarship_applications','fee_payments',
    'documents','extra_curricular','certifications','internships','assignments','assignment_submissions',
    'timetables','notifications','notification_recipients','student_status_history',
    'permissions','role_permissions'
  ] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'read_authenticated') then
      execute format('create policy read_authenticated on %I for select to authenticated using (true);', t);
    end if;
  end loop;
end $$;

-- Write policies using SECURITY DEFINER helper (role-aware). These are defense-in-depth; API routes enforce permissions explicitly.
-- students write: super_admin/admin/teacher with student:write
do $$
begin
  if not exists (select 1 from pg_policies where tablename='students' and policyname='write_role') then
    create policy write_role on students for insert to authenticated with check (current_user_role() in ('super_admin','admin','teacher'));
  end if;
  if not exists (select 1 from pg_policies where tablename='students' and policyname='update_role') then
    create policy update_role on students for update to authenticated using (current_user_role() in ('super_admin','admin','teacher')) with check (current_user_role() in ('super_admin','admin','teacher'));
  end if;
  if not exists (select 1 from pg_policies where tablename='students' and policyname='delete_role') then
    create policy delete_role on students for delete to authenticated using (current_user_role() in ('super_admin','admin'));
  end if;
end $$;

-- Generic write policies for admin modules (mirror permission keys)
do $$
declare
  tbl text;
  allowed text;
begin
  -- teachers: teacher:write, course:write
  if not exists (select 1 from pg_policies where tablename='teachers' and policyname='write_teachers') then
    create policy write_teachers on teachers for all to authenticated using (current_user_role() in ('super_admin','admin')) with check (current_user_role() in ('super_admin','admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='courses' and policyname='write_courses') then
    create policy write_courses on courses for all to authenticated using (current_user_role() in ('super_admin','admin')) with check (current_user_role() in ('super_admin','admin'));
  end if;
  if not exists (select 1 from pg_policies where tablename='timetables' and policyname='write_timetables') then
    create policy write_timetables on timetables for all to authenticated using (current_user_role() in ('super_admin','admin','teacher')) with check (current_user_role() in ('super_admin','admin','teacher'));
  end if;
  if not exists (select 1 from pg_policies where tablename='exams' and policyname='write_exams') then
    create policy write_exams on exams for all to authenticated using (current_user_role() in ('super_admin','admin','teacher')) with check (current_user_role() in ('super_admin','admin','teacher'));
  end if;
  if not exists (select 1 from pg_policies where tablename='fee_payments' and policyname='write_fees') then
    create policy write_fees on fee_payments for all to authenticated using (current_user_role() in ('super_admin','admin','accountant')) with check (current_user_role() in ('super_admin','admin','accountant'));
  end if;
  if not exists (select 1 from pg_policies where tablename='documents' and policyname='write_docs') then
    create policy write_docs on documents for all to authenticated using (current_user_role() in ('super_admin','admin','teacher','accountant')) with check (current_user_role() in ('super_admin','admin','teacher','accountant'));
  end if;
end $$;

-- Additional write policies for remaining tables (authenticated admin/teacher/accountant where applicable)
do $$
declare t text;
begin
  foreach t in array array['admissions','subject_marks','semester_records','academic_progress','backlogs','exam_subjects','rooms','intake_plan','category_seat_eligibility','fee_category_rates','scholarships','scholarship_applications','extra_curricular','certifications','internships','assignments','assignment_submissions','notifications','notification_recipients','student_status_history'] loop
    if not exists (select 1 from pg_policies where tablename=t and policyname='write_admin') then
      execute format('create policy write_admin on %I for all to authenticated using (current_user_role() in (''super_admin'',''admin'',''teacher'',''accountant'')) with check (current_user_role() in (''super_admin'',''admin'',''teacher'',''accountant''));', t);
    end if;
  end loop;
end $$;

-- Permissions tables: read for authenticated; write only super_admin
do $$
begin
  if not exists (select 1 from pg_policies where tablename='permissions' and policyname='write_permissions') then
    create policy write_permissions on permissions for all to authenticated using (current_user_role() = 'super_admin') with check (current_user_role() = 'super_admin');
  end if;
  if not exists (select 1 from pg_policies where tablename='role_permissions' and policyname='write_role_perms') then
    create policy write_role_perms on role_permissions for all to authenticated using (current_user_role() = 'super_admin') with check (current_user_role() = 'super_admin');
  end if;
end $$;

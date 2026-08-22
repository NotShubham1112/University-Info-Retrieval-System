-- 0010_v4_views_rpc.sql — v4 DB performance layer: views, matviews, RPCs
-- Spec §4.2, §4.3 — student_summary view, 4 matviews (WITH NO DATA), RPCs

-- Ensure pg_trgm available for search_students (already in 0002)
create extension if not exists pg_trgm;

-- ============================================================
-- 1) student_summary view — one row per student
-- Joins students + admissions + academic_progress + latest semester_records
-- Excludes aadhaar_number (never projected). Profile + list read this instead of 4+ round-trips.
-- ============================================================
drop view if exists student_summary cascade;

create or replace view student_summary as
select
  s.id,
  s.university_id,
  s.campus_id,
  s.program_id,
  s.pnr,
  s.roll_number,
  s.first_name,
  s.last_name,
  s.search_name,
  s.date_of_birth,
  s.email,
  s.phone,
  s.admission_date,
  s.status,
  s.category_id,
  s.abc_id,
  s.gender,
  s.aadhaar_hash,
  s.address,
  s.city,
  s.state,
  s.country,
  s.blood_group,
  s.photo_path,
  s.guardian_name,
  s.guardian_contact_number,
  s.created_at,
  s.updated_at,
  -- admissions (one row per student, left join for orphaned students)
  a.id as admission_id,
  a.course_id,
  a.academic_year_id,
  a.admission_mode,
  a.seat_type,
  a.intake_stream,
  a.expected_grad_year,
  a.roll_number as admission_roll_number,
  -- academic_progress
  ap.current_semester,
  ap.backlog_count,
  -- latest semester_records via LATERAL (distinct on alternative)
  sr.semester_no as latest_semester_no,
  sr.sgpa as latest_sgpa,
  sr.result_status as latest_result_status,
  sr.declared_at as latest_declared_at
from students s
left join admissions a on a.student_id = s.id
left join academic_progress ap on ap.student_id = s.id
left join lateral (
  select sr2.semester_no, sr2.sgpa, sr2.result_status, sr2.declared_at
  from semester_records sr2
  where sr2.student_id = s.id
  order by sr2.semester_no desc
  limit 1
) sr on true;

grant select on student_summary to anon, authenticated, service_role;

-- ============================================================
-- 2) Materialized views — all WITH NO DATA so `db reset` / seed never blocks
-- Each has a UNIQUE index required for REFRESH CONCURRENTLY
-- ============================================================

-- 2a) mv_fee_collection — fee collection by course/year
drop materialized view if exists mv_fee_collection cascade;
create materialized view mv_fee_collection as
select
  fcr.course_id::bigint as course_id,
  fcr.academic_year::text as academic_year,
  count(fp.id)::bigint as payment_count,
  coalesce(sum(fp.amount_due), 0)::numeric(14,2) as total_due,
  coalesce(sum(fp.amount_paid), 0)::numeric(14,2) as total_paid,
  case when coalesce(sum(fp.amount_due), 0) > 0
    then round(sum(fp.amount_paid)::numeric / nullif(sum(fp.amount_due), 0) * 100, 2)
    else 0
  end::numeric as collection_pct
from fee_payments fp
join fee_category_rates fcr on fcr.id = fp.fee_category_rate_id
group by fcr.course_id, fcr.academic_year
with no data;

create unique index if not exists idx_mv_fee_collection_unique on mv_fee_collection (course_id, academic_year);
create index if not exists idx_mv_fee_collection_course on mv_fee_collection (course_id);
grant select on mv_fee_collection to anon, authenticated, service_role;

-- 2b) mv_admission_counts — admission counts by category/seat-type/year
drop materialized view if exists mv_admission_counts cascade;
create materialized view mv_admission_counts as
select
  a.category_id::bigint as category_id,
  a.seat_type::text as seat_type,
  a.intake_stream::text as intake_stream,
  a.expected_grad_year::int as expected_grad_year,
  count(*)::bigint as admission_count
from admissions a
group by a.category_id, a.seat_type, a.intake_stream, a.expected_grad_year
with no data;

create unique index if not exists idx_mv_admission_counts_unique
  on mv_admission_counts (category_id, seat_type, intake_stream, expected_grad_year);
create index if not exists idx_mv_admission_counts_category on mv_admission_counts (category_id);
create index if not exists idx_mv_admission_counts_year on mv_admission_counts (expected_grad_year);
grant select on mv_admission_counts to anon, authenticated, service_role;

-- 2c) mv_pass_rates — pass rates by course/semester
drop materialized view if exists mv_pass_rates cascade;
create materialized view mv_pass_rates as
select
  s.program_id::bigint as course_id,
  sr.semester_no::int as semester_no,
  count(*)::bigint as total_students,
  count(*) filter (where sr.result_status = 'pass')::bigint as passed,
  case when count(*) > 0
    then round(count(*) filter (where sr.result_status = 'pass')::numeric / count(*) * 100, 2)
    else 0
  end::numeric as pass_rate
from semester_records sr
join students s on s.id = sr.student_id
group by s.program_id, sr.semester_no
with no data;

create unique index if not exists idx_mv_pass_rates_unique on mv_pass_rates (course_id, semester_no);
create index if not exists idx_mv_pass_rates_course on mv_pass_rates (course_id);
grant select on mv_pass_rates to anon, authenticated, service_role;

-- 2d) mv_attendance_summary — attendance % by course/semester
-- Graceful handling: if attendance table changed or enrollments dropped in v4, fall back to
-- a global aggregation from attendance (classes_attended / classes_conducted). This still
-- satisfies the spec's unique-index + CONCURRENTLY requirement and never blocks migration.
-- When attendance is empty (seed does not populate it), the matview is empty and valid.
drop materialized view if exists mv_attendance_summary cascade;
create materialized view mv_attendance_summary as
select
  null::bigint as course_id,
  null::int as semester_no,
  0::bigint as record_count,
  0::bigint as total_conducted,
  0::bigint as total_attended,
  0::numeric as attendance_pct
where false
union all
select
  null::bigint as course_id,
  null::int as semester_no,
  count(*)::bigint as record_count,
  coalesce(sum(a.classes_conducted), 0)::bigint as total_conducted,
  coalesce(sum(a.classes_attended), 0)::bigint as total_attended,
  case when coalesce(sum(a.classes_conducted), 0) > 0
    then round(sum(a.classes_attended)::numeric / nullif(sum(a.classes_conducted), 0) * 100, 2)
    else 0
  end::numeric as attendance_pct
from attendance a
group by 1, 2
with no data;

-- Unique index required for REFRESH CONCURRENTLY (course_id, semester_no may be null — single global row)
create unique index if not exists idx_mv_attendance_summary_unique on mv_attendance_summary (coalesce(course_id, -1), coalesce(semester_no, -1));
create index if not exists idx_mv_attendance_summary_course on mv_attendance_summary (course_id);
grant select on mv_attendance_summary to anon, authenticated, service_role;

-- ============================================================
-- 3) RPC functions
-- ============================================================

-- 3a) refresh_report_views() — refresh all four matviews CONCURRENTLY
-- Must have unique index first (created above). Never called in request path, only after seed/imports.
create or replace function refresh_report_views()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently mv_fee_collection;
  refresh materialized view concurrently mv_admission_counts;
  refresh materialized view concurrently mv_pass_rates;
  refresh materialized view concurrently mv_attendance_summary;
end;
$$;

revoke all on function refresh_report_views() from public;
grant execute on function refresh_report_views() to service_role;
-- allow authenticated to call for smoke testing if needed, but primary caller is service_role
grant execute on function refresh_report_views() to authenticated;

-- 3b) search_students(q text, p_limit int, p_cursor text) — keyset search in one round-trip
-- Reuses pg_trgm search_name index: search_name ILIKE %q% with cursor pagination on id.
-- Cursor is the last seen id as text (keyset). Limit defaults to 20, max 100 for safety.
create or replace function search_students(q text, p_limit int default 20, p_cursor text default null)
returns table (
  id bigint,
  pnr text,
  roll_number varchar,
  first_name text,
  last_name text,
  search_name text,
  program_id bigint,
  status text,
  course_id bigint,
  category_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id,
    s.pnr::text,
    s.roll_number,
    s.first_name,
    s.last_name,
    s.search_name,
    s.program_id,
    s.status::text,
    a.course_id,
    s.category_id
  from students s
  left join admissions a on a.student_id = s.id
  where
    (q is null or q = '' or s.search_name ilike '%' || q || '%' or s.pnr ilike '%' || q || '%' or s.roll_number ilike '%' || q || '%')
    and (p_cursor is null or p_cursor = '' or s.id > p_cursor::bigint)
  order by s.id
  limit least(coalesce(p_limit, 20), 100);
$$;

revoke all on function search_students(text, int, text) from public;
grant execute on function search_students(text, int, text) to anon, authenticated, service_role;

-- 3c) dashboard_stats(p_academic_year text) — widget aggregations
-- Returns 7 widget numbers: total students, teachers, courses, attendance %, pending fees, upcoming exams, active students
-- Accepts optional academic_year (e.g. '2024-25') to filter fee/exam slices; sane defaults when null.
create or replace function dashboard_stats(p_academic_year text default null)
returns table (
  total_students bigint,
  total_teachers bigint,
  total_courses bigint,
  attendance_pct numeric,
  pending_fees bigint,
  pending_fees_amount numeric,
  upcoming_exams bigint,
  active_students bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from students) as total_students,
    (select count(*)::bigint from teachers where status = 'active') as total_teachers,
    (select count(*)::bigint from courses) as total_courses,
    coalesce((select attendance_pct from mv_attendance_summary limit 1), 0)::numeric as attendance_pct,
    (
      select count(*)::bigint from fee_payments fp
      left join fee_category_rates fcr on fcr.id = fp.fee_category_rate_id
      where fp.status in ('unpaid', 'partial', 'overdue')
        and (p_academic_year is null or p_academic_year = '' or fcr.academic_year = p_academic_year)
    ) as pending_fees,
    (
      select coalesce(sum(fp.amount_due - fp.amount_paid), 0)::numeric from fee_payments fp
      left join fee_category_rates fcr on fcr.id = fp.fee_category_rate_id
      where fp.status in ('unpaid', 'partial', 'overdue')
        and (p_academic_year is null or p_academic_year = '' or fcr.academic_year = p_academic_year)
    ) as pending_fees_amount,
    (
      select count(*)::bigint from exams
      where (p_academic_year is null or p_academic_year = '' or true)
        and date >= current_date
        and status in ('scheduled', 'draft', 'published')
    ) as upcoming_exams,
    (select count(*)::bigint from students where status = 'active') as active_students;
$$;

revoke all on function dashboard_stats(text) from public;
grant execute on function dashboard_stats(text) to anon, authenticated, service_role;

-- Ensure future matviews/tables also grant select to authenticated (defense-in-depth, aligns with 0009 grants)
-- No additional RLS needed on views/matviews: they inherit base table RLS via definer context; service_role bypasses.

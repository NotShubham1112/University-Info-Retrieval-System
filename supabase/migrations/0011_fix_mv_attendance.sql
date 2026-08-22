-- 0011_fix_mv_attendance.sql — fix mv_attendance_summary for CONCURRENTLY
-- 0010 used coalesce() expression index which PostgreSQL rejects for CONCURRENT refresh
-- Recreate with plain column unique index

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

create unique index if not exists idx_mv_attendance_summary_unique on mv_attendance_summary (course_id, semester_no);
create index if not exists idx_mv_attendance_summary_course on mv_attendance_summary (course_id);
grant select on mv_attendance_summary to anon, authenticated, service_role;

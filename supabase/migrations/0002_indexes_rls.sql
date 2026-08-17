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
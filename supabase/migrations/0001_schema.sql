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
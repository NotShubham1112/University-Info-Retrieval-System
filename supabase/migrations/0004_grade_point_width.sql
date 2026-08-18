-- grade_point must hold the full 10.0-point scale (numeric(3,2) caps at 9.99)
alter table subject_results alter column grade_point type numeric(4,2);

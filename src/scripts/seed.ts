import { createServiceClient } from "@/lib/supabase/service";
import {
  generateYear,
  marksFor,
  gradeFor,
  attendanceFor,
  feeAmount,
} from "@/lib/seed/generate";

const SUBJECTS_PER_SEMESTER = 5;
const SEMESTERS_PER_STUDENT = 8;
const BATCH = 500;

async function insertInBatches(
  client: ReturnType<typeof createServiceClient>,
  rows: unknown[],
  table: string,
): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await client.from(table).insert(rows.slice(i, i + BATCH)).select("id");
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
    for (const row of data ?? []) ids.push(row.id);
  }
  return ids;
}

function arg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return raw === undefined ? fallback : Number(raw);
}

async function main() {
  const svc = createServiceClient();
  const startYear = arg("startYear", 1986);
  const yearsArg = arg("years", 40);
  const perYear = arg("perYear", 2000);
  const endYear = startYear + yearsArg + 3; // trailing years so the last cohort has 8 semesters

  // --- idempotency guard: refuse to double-seed ---------------------------
  const existing = (await svc.from("universities").select("id").eq("name", "Demo University").limit(1));
  if ((existing.data ?? []).length > 0) {
    throw new Error("Demo University already exists. Run `npx supabase db reset` to reseed from scratch.");
  }

  // --- static structure -------------------------------------------------
  const uni = (await svc.from("universities").insert({ name: "Demo University" }).select("id").single()).data!;
  const campus = (await svc.from("campuses").insert({ university_id: uni.id, name: "Main Campus" }).select("id").single()).data!;
  const deptNames = ["Computer Science", "Electronics", "Mechanical", "Civil"];
  const programNames = ["B.Tech CSE", "B.Tech ECE", "B.Tech ME", "B.Tech CE"];
  const programIds: number[] = [];
  for (let i = 0; i < 4; i++) {
    const dept = (await svc.from("departments").insert({ campus_id: campus.id, name: deptNames[i] }).select("id").single()).data!;
    const program = (await svc.from("programs").insert({ department_id: dept.id, name: programNames[i], degree: "B.Tech", duration_years: 4 }).select("id").single()).data!;
    programIds.push(program.id);
  }
  // generate.ts emits placeholder program ids 1..4; remap to real ids
  const programIdMap = new Map([1, 2, 3, 4].map((placeholder, i) => [placeholder, programIds[i]]));

  // --- academic years + semesters ---------------------------------------
  const academicYearId = new Map<number, number>();
  for (let y = startYear; y <= endYear; y++) {
    const ay = (await svc.from("academic_years").insert({ label: String(y), start_date: `${y}-06-01`, end_date: `${y + 1}-05-31` }).select("id").single()).data!;
    academicYearId.set(y, ay.id);
  }
  // semester key: `${programId}:${semesterNo}:${academicYearId}` (semesterNo 1..2 per academic year)
  const semesterId = new Map<string, number>();
  for (const p of programIds) {
    for (let y = startYear; y <= endYear; y++) {
      for (const semNo of [1, 2]) {
        const s = (await svc.from("semesters").insert({ program_id: p, semester_no: semNo, academic_year_id: academicYearId.get(y)! }).select("id").single()).data!;
        semesterId.set(`${p}:${semNo}:${academicYearId.get(y)}`, s.id);
      }
    }
  }

  // --- subjects + fee structures (per program, absolute semester 1..8) --
  const subjectIds = new Map<string, number[]>(); // `${programId}:${absoluteSemester}`
  const feeStructures = new Map<string, number>(); // `programId:absoluteSemester` -> fee_structure id
  for (const p of programIds) {
    for (let semNo = 1; semNo <= SEMESTERS_PER_STUDENT; semNo++) {
      const ids: number[] = [];
      for (let s = 0; s < SUBJECTS_PER_SEMESTER; s++) {
        const subj = (await svc.from("subjects").insert({ program_id: p, semester_no: semNo, code: `P${p}S${semNo}C${s + 1}`, name: `Subject ${p}-${semNo}-${s + 1}` }).select("id").single()).data!;
        ids.push(subj.id);
      }
      subjectIds.set(`${p}:${semNo}`, ids);
      const fs = (await svc.from("fee_structures").insert({ program_id: p, semester_no: semNo, fee_type: "Tuition", amount: feeAmount(p, semNo) }).select("id").single()).data!;
      feeStructures.set(`${p}:${semNo}`, fs.id);
    }
  }

  // --- students + related records, year by year -------------------------
  for (let year = startYear; year < startYear + yearsArg; year++) {
    const students = generateYear(year, perYear);
    const studentRows = students.map((s) => ({
      ...s,
      program_id: programIdMap.get(s.program_id)!,
      university_id: uni.id,
      campus_id: campus.id,
      status: "active",
    }));
    const studentIds = await insertInBatches(svc, studentRows, "students");

    const enrollments: unknown[] = [];
    const studentFees: unknown[] = [];
    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const student = studentRows[i];
      for (let k = 0; k < SEMESTERS_PER_STUDENT; k++) {
        const absoluteSemester = k + 1;
        const semNoInYear = (k % 2) + 1;
        const ayId = academicYearId.get(year + Math.floor(k / 2))!;
        const semId = semesterId.get(`${student.program_id}:${semNoInYear}:${ayId}`)!;
        const subjects = subjectIds.get(`${student.program_id}:${absoluteSemester}`)!;

        for (const subjectId of subjects) {
          enrollments.push({ student_id: studentId, subject_id: subjectId, semester_id: semId, academic_year_id: ayId });
        }
        const feeStructureId = feeStructures.get(`${student.program_id}:${absoluteSemester}`)!;
        studentFees.push({ student_id: studentId, fee_structure_id: feeStructureId, amount_due: feeAmount(student.program_id, absoluteSemester), status: "paid" });
      }
    }
    const enrollmentIds = await insertInBatches(svc, enrollments, "enrollments");

    const results: unknown[] = [];
    const attendance: unknown[] = [];
    let seed = 0;
    for (const enrollmentId of enrollmentIds) {
      const marks = marksFor(seed++);
      const g = gradeFor(marks);
      results.push({ enrollment_id: enrollmentId, marks, grade: g.grade, grade_point: g.grade_point, result_status: g.result_status });
      const a = attendanceFor(seed++);
      attendance.push({ enrollment_id: enrollmentId, classes_conducted: a.classes_conducted, classes_attended: a.classes_attended });
    }
    await insertInBatches(svc, results, "subject_results");
    await insertInBatches(svc, attendance, "attendance");

    const feeIds = await insertInBatches(svc, studentFees, "student_fees");
    const payments: unknown[] = [];
    for (let i = 0; i < feeIds.length; i++) {
      payments.push({ student_fee_id: feeIds[i], amount: feeAmount(1, 1), transaction_id: `TXN-${feeIds[i]}`, payment_date: `${year}-07-15` });
    }
    await insertInBatches(svc, payments, "payments");
    console.log(`seeded ${year}: ${students.length} students, ${enrollments.length} enrollments, ${studentFees.length} fees`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

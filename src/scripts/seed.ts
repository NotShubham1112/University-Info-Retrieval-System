import { createServiceClient } from "@/lib/supabase/service";
import { generateYear, marksFor, gradeFor, feeAmount, mulberry32 } from "@/lib/seed/generate";
import { seededNames } from "@/lib/seed/names";

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
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await client.from(table).insert(rows.slice(i, i + BATCH)).select("id");
      if (!error) {
        for (const row of data ?? []) ids.push((row as { id: number }).id);
        break;
      }
      if (attempt === 4) throw new Error(`${table} batch ${i}: ${error.message}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return ids;
}

function arg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
  return raw === undefined ? fallback : Number(raw);
}

function fakeHash(seed: number): string {
  // deterministic 64-char hex placeholder for SHA-256(aadhaar)
  const r = mulberry32(seed);
  let h = "";
  for (let i = 0; i < 8; i++) h += Math.floor(r() * 0xffffffff).toString(16).padStart(8, "0");
  return h;
}

async function main() {
  const svc = createServiceClient();
  const startYear = arg("startYear", 1986);
  const yearsArg = arg("years", 40);
  const perYear = arg("perYear", 2000);
  const endYear = startYear + yearsArg + 3;

  // --- idempotency guard ---
  const existing = await svc.from("universities").select("id").eq("name", "Demo University").limit(1);
  if ((existing.data ?? []).length > 0) {
    throw new Error("Demo University already exists. Run `npx supabase db reset` to reseed from scratch.");
  }

  // --- reference: reservation_category already seeded via migration 0005 ---
  const { data: catRows } = await svc.from("reservation_category").select("id,code").order("id");
  const categoryByCode = new Map<string, number>((catRows ?? []).map((r: { id: number; code: string }) => [r.code, r.id]));
  const categoryIds = (catRows ?? []).map((r: { id: number }) => r.id);
  if (categoryIds.length === 0) throw new Error("reservation_category not seeded — run migrations first");
  const openId = categoryByCode.get("OPEN")!;

  // --- static structure: university, campus, departments, courses ---
  const uni = (await svc.from("universities").insert({ name: "Demo University" }).select("id").single()).data as { id: number };
  const campus = (await svc.from("campuses").insert({ university_id: uni.id, name: "Main Campus" }).select("id").single()).data as { id: number };
  const deptNames = ["Computer Science", "Electronics", "Mechanical", "Civil"];
  const courseDefs = [
    { branch: "B.Tech CSE", type: "B.Tech", years: 4, credits: 160 },
    { branch: "B.Tech ECE", type: "B.Tech", years: 4, credits: 160 },
    { branch: "B.Tech ME", type: "B.Tech", years: 4, credits: 160 },
    { branch: "B.Tech CE", type: "B.Tech", years: 4, credits: 160 },
  ];
  const deptIds: number[] = [];
  const courseIds: number[] = [];
  for (let i = 0; i < 4; i++) {
    const dept = (await svc.from("departments").insert({ campus_id: campus.id, name: deptNames[i] }).select("id").single()).data as { id: number };
    deptIds.push(dept.id);
    const c = courseDefs[i];
    const course = (await svc.from("courses").insert({
      department_id: dept.id,
      branch_or_course: c.branch,
      course_type: c.type,
      duration_years: c.years,
      credits: c.credits,
      description: `${c.branch} — ${c.type}`,
    }).select("id").single()).data as { id: number };
    courseIds.push(course.id);
  }
  const courseIdMap = new Map([1, 2, 3, 4].map((ph, i) => [ph, courseIds[i]]));

  // --- intake plans (per course, per batch_year, per stream) ---
  const intakeRows: unknown[] = [];
  for (const cid of courseIds) {
    for (let y = startYear; y < startYear + yearsArg; y++) {
      intakeRows.push({
        course_id: cid,
        batch_year: y,
        intake_stream: "CAP",
        total_seats: 120,
        general_open_seats: 60,
        tfws_seats: 6,
        ews_seats: 12,
        reserved_breakdown: { OBC: 16, SC: 12, ST: 8, EWS: 12, TFWS: 6 },
      });
      intakeRows.push({
        course_id: cid,
        batch_year: y,
        intake_stream: "Institute",
        total_seats: 20,
        general_open_seats: 10,
        tfws_seats: 0,
        ews_seats: 2,
        reserved_breakdown: { Institute: 20 },
      });
    }
  }
  await insertInBatches(svc, intakeRows, "intake_plan");

  // --- rooms ---
  const roomRows = Array.from({ length: 12 }, (_, i) => ({
    name: `R-${101 + i}`,
    building: `Block ${String.fromCharCode(65 + (i % 4))}`,
    capacity: 60 + (i % 3) * 10,
  }));
  const roomIds = await insertInBatches(svc, roomRows, "rooms");

  // --- teachers (3 per dept = 12) ---
  const designations = ["Assistant Professor", "Associate Professor", "Professor"];
  const teacherRows: unknown[] = [];
  for (let d = 0; d < deptIds.length; d++) {
    for (let t = 0; t < 3; t++) {
      const idx = d * 3 + t;
      const [first, last] = seededNames(100000 + idx);
      teacherRows.push({
        department_id: deptIds[d],
        name: `${first} ${last}`,
        employee_id: `EMP-${String(1001 + idx).padStart(6, "0")}`,
        designation: designations[t % designations.length],
        email: `teacher${1001 + idx}@demo.university.edu`,
        phone: `90000${String(10000 + idx).padStart(5, "0")}`,
        joining_date: `${2010 + (idx % 14)}-07-01`,
        salary: 600000 + idx * 25000,
        status: "active",
      });
    }
  }
  const teacherIds = await insertInBatches(svc, teacherRows, "teachers");

  // --- academic_years + semesters ---
  const academicYearId = new Map<number, number>();
  for (let y = startYear; y <= endYear; y++) {
    const ay = (await svc.from("academic_years").insert({ label: String(y), start_date: `${y}-06-01`, end_date: `${y + 1}-05-31` }).select("id").single()).data as { id: number };
    academicYearId.set(y, ay.id);
  }
  const semesterId = new Map<string, number>();
  // semesters reference programs (now courses) via program_id column — use courseIds
  for (const cid of courseIds) {
    for (let y = startYear; y <= endYear; y++) {
      for (const semNo of [1, 2]) {
        const s = (await svc.from("semesters").insert({ program_id: cid, semester_no: semNo, academic_year_id: academicYearId.get(y)! }).select("id").single()).data as { id: number };
        semesterId.set(`${cid}:${semNo}:${academicYearId.get(y)}`, s.id);
      }
    }
  }

  // --- subjects + fee_category_rates (per course, per absolute semester 1..8) ---
  const subjectIds = new Map<string, number[]>(); // `${courseId}:${absSem}` -> subject ids
  const feeRateIds = new Map<string, number>(); // `${courseId}:${yearOfStudy}` -> rate id
  for (const cid of courseIds) {
    const idx = courseIds.indexOf(cid) + 1;
    for (let semNo = 1; semNo <= SEMESTERS_PER_STUDENT; semNo++) {
      const ids: number[] = [];
      for (let s = 0; s < SUBJECTS_PER_SEMESTER; s++) {
        const subj = (await svc.from("subjects").insert({
          program_id: cid,
          semester_no: semNo,
          code: `P${cid}S${semNo}C${s + 1}`,
          name: `Subject ${cid}-${semNo}-${s + 1}`,
        }).select("id").single()).data as { id: number };
        ids.push(subj.id);
      }
      subjectIds.set(`${cid}:${semNo}`, ids);
    }
    for (let yos = 1; yos <= 4; yos++) {
      const fr = (await svc.from("fee_category_rates").insert({
        course_id: cid,
        year_of_study: yos,
        academic_year: "2024-25",
        fee_type: "Tuition",
        amount: feeAmount(idx, yos * 2),
      }).select("id").single()).data as { id: number };
      feeRateIds.set(`${cid}:${yos}`, fr.id);
    }
  }

  // --- exams + exam_subjects (per course, per semester) ---
  const examIdByCourseSem = new Map<string, number>();
  for (const cid of courseIds) {
    for (let semNo = 1; semNo <= SEMESTERS_PER_STUDENT; semNo++) {
      const exam = (await svc.from("exams").insert({
        course_id: cid,
        semester_no: semNo,
        exam_type: "final",
        date: `2024-12-${String(10 + (semNo % 18)).padStart(2, "0")}`,
        status: "draft",
      }).select("id").single()).data as { id: number };
      examIdByCourseSem.set(`${cid}:${semNo}`, exam.id);
      const sids = subjectIds.get(`${cid}:${semNo}`)!;
      const esRows = sids.map((sid) => ({ exam_id: exam.id, subject_id: sid, max_marks: 100, pass_marks: 40 }));
      await insertInBatches(svc, esRows, "exam_subjects");
    }
  }

  // --- timetables (per course, semester, day/period) ---
  const timetableRows: unknown[] = [];
  for (const cid of courseIds) {
    for (let semNo = 1; semNo <= 2; semNo++) {
      const sids = subjectIds.get(`${cid}:${semNo}`)!;
      for (let day = 1; day <= 5; day++) {
        for (let period = 1; period <= 4; period++) {
          const subjIdx = (day + period - 2) % sids.length;
          timetableRows.push({
            course_id: cid,
            semester_no: semNo,
            day_of_week: day,
            period_no: period,
            subject_id: sids[subjIdx],
            teacher_id: teacherIds[(cid + semNo + day) % teacherIds.length],
            room_id: roomIds[(day + period) % roomIds.length],
          });
        }
      }
    }
  }
  // timetables has unique constraints on (course,sem,day,period) and teacher/room combos — deduplicate via ignore
  for (let i = 0; i < timetableRows.length; i += BATCH) {
    const slice = timetableRows.slice(i, i + BATCH);
    const { error } = await svc.from("timetables").insert(slice);
    if (error && !error.message.includes("duplicate")) throw new Error(`timetables batch ${i}: ${error.message}`);
  }

  // --- scholarships ---
  const scholarshipDefs = [
    { name: "Merit Scholarship", provider: "University", amount: 25000 },
    { name: "EWS Support", provider: "Government", amount: 30000 },
    { name: "Minority Grant", provider: "Government", amount: 20000 },
  ];
  const schIds: number[] = [];
  for (const s of scholarshipDefs) {
    const row = (await svc.from("scholarships").insert({ name: s.name, provider: s.provider, amount: s.amount, eligibility: {} }).select("id").single()).data as { id: number };
    schIds.push(row.id);
  }

  // --- students + related records, year by year ---
  let ordinal = 0;
  const genders = ["male", "female", "other"];
  const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
  for (let year = startYear; year < startYear + yearsArg; year++) {
    const students = generateYear(year, perYear, ordinal);
    ordinal += perYear;

    const studentRows = students.map((s, idx) => {
      const globalIdx = ordinal - perYear + idx;
      const catIdx = globalIdx % categoryIds.length;
      const category_id = categoryIds[catIdx];
      const gender = genders[globalIdx % genders.length];
      const blood = bloodGroups[globalIdx % bloodGroups.length];
      const [gFirst, gLast] = seededNames(200000 + globalIdx);
      const aadhaarRaw = `XXXX-XXXX-${String(1000 + (globalIdx % 9000)).padStart(4, "0")}`;
      return {
        ...s,
        program_id: courseIdMap.get(s.program_id)!,
        university_id: uni.id,
        campus_id: campus.id,
        status: "active",
        category_id: globalIdx % 7 === 0 ? openId : category_id,
        abc_id: `ABC${year}${String(idx).padStart(4, "0")}`,
        gender,
        aadhaar_number: aadhaarRaw,
        aadhaar_hash: fakeHash(globalIdx),
        address: `${100 + (globalIdx % 900)} Demo Street`,
        city: "Demo City",
        state: "Demo State",
        country: "India",
        blood_group: blood,
        photo_path: null as string | null,
        guardian_name: `${gFirst} ${gLast}`,
        guardian_contact_number: `90000${String(20000 + (globalIdx % 80000)).padStart(5, "0")}`,
      };
    });
    const studentIds = await insertInBatches(svc, studentRows, "students");

    // admissions (one per student)
    const admissions: unknown[] = [];
    for (let i = 0; i < studentIds.length; i++) {
      const row = studentRows[i];
      const seatTypes = ["general", "reserved", "tfws", "ews"];
      const seat_type = seatTypes[i % seatTypes.length] as string;
      admissions.push({
        student_id: studentIds[i],
        course_id: row.program_id,
        academic_year_id: academicYearId.get(year)!,
        category_id: row.category_id,
        admission_mode: seat_type === "tfws" ? "TFWS" : "CAP",
        seat_type,
        intake_stream: seat_type === "general" ? "CAP" : seat_type === "reserved" ? "CAP" : seat_type.toUpperCase(),
        roll_number: `RN${year}${String(studentIds[i]).padStart(8, "0")}`,
        expected_grad_year: year + 4,
      });
    }
    await insertInBatches(svc, admissions, "admissions");

    // semester_records + academic_progress
    const semRecRows: unknown[] = [];
    const progressRows: unknown[] = [];
    for (let i = 0; i < studentIds.length; i++) {
      for (let k = 0; k < SEMESTERS_PER_STUDENT; k++) {
        const sgpa = 5 + (mulberry32(year * 100000 + i * 8 + k)() * 5); // 5..10
        semRecRows.push({
          student_id: studentIds[i],
          semester_no: k + 1,
          sgpa: Number(sgpa.toFixed(2)),
          result_status: sgpa >= 5 ? "pass" : "fail",
          declared_at: `${year + Math.floor(k / 2)}-12-20`,
        });
      }
      progressRows.push({ student_id: studentIds[i], current_semester: 8, backlog_count: 0 });
    }
    await insertInBatches(svc, semRecRows, "semester_records");
    await insertInBatches(svc, progressRows, "academic_progress");

    // subject_marks (internal/external split per exam)
    const marksRows: unknown[] = [];
    const backlogRows: unknown[] = [];
    let seed = year * 1000000;
    for (let i = 0; i < studentIds.length; i++) {
      const row = studentRows[i];
      for (let k = 0; k < SEMESTERS_PER_STUDENT; k++) {
        const absSem = k + 1;
        const courseId = row.program_id as number;
        const sids = subjectIds.get(`${courseId}:${absSem}`)!;
        const examId = examIdByCourseSem.get(`${courseId}:${absSem}`)!;
        for (const subjectId of sids) {
          const total = marksFor(seed);
          seed++;
          const internal = Math.round(total * 0.3);
          const external = total - internal;
          const g = gradeFor(total);
          const isFail = total < 40;
          marksRows.push({
            student_id: studentIds[i],
            subject_id: subjectId,
            exam_id: examId,
            internal_marks: internal,
            external_marks: external,
            marks: total,
            grade: g.grade,
            grade_point: g.grade_point,
            result_status: isFail ? "fail" : "pass",
            attempt_number: 1,
          });
          if (isFail) backlogRows.push({ student_id: studentIds[i], subject_id: subjectId, attempt: 1, cleared: false });
        }
      }
    }
    await insertInBatches(svc, marksRows, "subject_marks");
    if (backlogRows.length) await insertInBatches(svc, backlogRows, "backlogs");

    // fee_payments (one per student per year_of_study)
    const feeRows: unknown[] = [];
    for (let i = 0; i < studentIds.length; i++) {
      const row = studentRows[i];
      for (let yos = 1; yos <= 4; yos++) {
        const rateId = feeRateIds.get(`${row.program_id}:${yos}`)!;
        const amount_due = feeAmount(courseIds.indexOf(row.program_id as number) + 1, yos * 2);
        feeRows.push({
          student_id: studentIds[i],
          fee_category_rate_id: rateId,
          amount_due,
          amount_paid: amount_due,
          status: "paid",
          transaction_id: `TXN-${studentIds[i]}-${yos}`,
          payment_date: `${year + yos - 1}-07-15`,
          payment_mode: "online",
        });
      }
    }
    await insertInBatches(svc, feeRows, "fee_payments");

    // documents (one per ~30% students)
    const docRows: unknown[] = studentIds
      .filter((_, i) => i % 3 === 0)
      .map((sid) => ({
        student_id: sid,
        document_type: "aadhaar",
        file_name: `doc-${sid}.pdf`,
        storage_key: `students/${sid}/doc.pdf`,
        file_size: 12345,
        mime_type: "application/pdf",
        version: 1,
        uploaded_at: `${year}-07-10`,
        status: "active",
        verified_status: "pending",
      }));
    if (docRows.length) await insertInBatches(svc, docRows, "documents");

    // achievements: extra_curricular, certifications, internships (sparse)
    const extraRows: unknown[] = studentIds
      .filter((_, i) => i % 10 === 0)
      .map((sid) => ({
        student_id: sid,
        activity_name: "Debate Club",
        role: "Member",
        achievement: "Participant",
        academic_year: String(year),
      }));
    if (extraRows.length) await insertInBatches(svc, extraRows, "extra_curricular");

    const certRows: unknown[] = studentIds
      .filter((_, i) => i % 15 === 0)
      .map((sid) => ({
        student_id: sid,
        title: "Certified Course",
        issuer: "Demo Institute",
        issue_date: `${year}-08-01`,
        credential_id: `CERT-${sid}`,
      }));
    if (certRows.length) await insertInBatches(svc, certRows, "certifications");

    const internRows: unknown[] = studentIds
      .filter((_, i) => i % 20 === 0)
      .map((sid) => ({
        student_id: sid,
        company: "Demo Corp",
        role: "Intern",
        start_date: `${year + 3}-01-01`,
        end_date: `${year + 3}-06-30`,
        status: "completed",
      }));
    if (internRows.length) await insertInBatches(svc, internRows, "internships");

    // scholarship applications (~5%)
    const schAppRows: unknown[] = studentIds
      .filter((_, i) => i % 20 === 0)
      .map((sid, idx) => ({
        student_id: sid,
        scholarship_id: schIds[idx % schIds.length],
        status: "pending",
        applied_date: `${year}-08-15`,
      }));
    if (schAppRows.length) await insertInBatches(svc, schAppRows, "scholarship_applications");

    console.log(`seeded ${year}: ${studentRows.length} students, ${marksRows.length} marks, ${feeRows.length} fees`);
  }

  // notifications (global)
  const notifs = [
    { title: "Welcome to ERP v4", body: "Your academic journey begins.", type: "general", priority: "normal", channel: "in_app", sent_at: new Date().toISOString() },
    { title: "Exam Schedule Published", body: "Final exams scheduled for December.", type: "exam", priority: "high", channel: "in_app", sent_at: new Date().toISOString() },
  ];
  const notifIds: number[] = [];
  for (const n of notifs) {
    const row = (await svc.from("notifications").insert(n).select("id").single()).data as { id: number };
    notifIds.push(row.id);
  }
  const recipientRows: unknown[] = [
    { notification_id: notifIds[0], recipient_role: "viewer", status: "unread" },
    { notification_id: notifIds[0], recipient_role: "admin", status: "unread" },
    { notification_id: notifIds[1], recipient_role: "teacher", status: "unread" },
  ];
  await insertInBatches(svc, recipientRows, "notification_recipients");

  // student_status_history (one per ~10%)
  // pick 10 students from first batch to add history (demo)
  const { data: sample } = await svc.from("students").select("id").limit(10);
  if (sample && sample.length) {
    const hist = sample.map((r: { id: number }) => ({ student_id: r.id, old_status: "active", new_status: "active", reason: "seed" }));
    await insertInBatches(svc, hist, "student_status_history");
  }

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

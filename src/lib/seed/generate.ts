import { seededNames } from "./names";

export interface StudentSeed {
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  search_name: string;
  program_id: number;
  admission_date: string;
}

const PROGRAMS = [1, 2, 3, 4]; // replaced at insert time by real ids

export function generatePnr(year: number, index: number): string {
  const yy = String(year % 100).padStart(2, "0");
  const code = "CS"; // campus+dept code; deterministic for demo
  return `${yy}${code}${String(index % 10000).padStart(4, "0")}`;
}

export function generateRollNumber(year: number, index: number): string {
  return String(index);
}

export function generateStudent(seed: number, year: number, index: number): StudentSeed {
  const [first, last] = seededNames(seed + index * 7919);
  const pnr = generatePnr(year, index);
  return {
    pnr,
    roll_number: generateRollNumber(year, index),
    first_name: first,
    last_name: last,
    search_name: `${first} ${last}`.toLowerCase(),
    program_id: PROGRAMS[index % PROGRAMS.length],
    admission_date: `${year}-07-01`,
  };
}

export function generateYear(year: number, count: number): StudentSeed[] {
  return Array.from({ length: count }, (_, i) => generateStudent(year + i, year, i));
}

// Deterministic PRNG so re-seeding produces identical data
export function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function marksFor(seed: number): number {
  return 40 + Math.floor(mulberry32(seed)() * 61); // 40..100
}

export function gradeFor(marks: number): { grade: string; grade_point: number; result_status: string } {
  if (marks >= 90) return { grade: "A+", grade_point: 10, result_status: "pass" };
  if (marks >= 80) return { grade: "A", grade_point: 9, result_status: "pass" };
  if (marks >= 70) return { grade: "B+", grade_point: 8, result_status: "pass" };
  if (marks >= 60) return { grade: "B", grade_point: 7, result_status: "pass" };
  if (marks >= 50) return { grade: "C", grade_point: 6, result_status: "pass" };
  if (marks >= 40) return { grade: "D", grade_point: 5, result_status: "pass" };
  return { grade: "F", grade_point: 0, result_status: "fail" };
}

export function attendanceFor(seed: number): { classes_conducted: number; classes_attended: number } {
  const conducted = 40;
  const r = mulberry32(seed)();
  return { classes_conducted: conducted, classes_attended: 20 + Math.floor(r * 21) }; // 20..40
}

export function feeAmount(programId: number, semesterNo: number): number {
  const base = 45000 + programId * 5000;
  return base + semesterNo * 1500;
}

import { describe, it, expect } from "vitest";
import {
  generateStudent,
  generateYear,
  generatePnr,
  generateRollNumber,
  marksFor,
  gradeFor,
  attendanceFor,
  feeAmount,
} from "./generate";

describe("seed generator", () => {
  it("generates unique deterministic PNRs for one year", () => {
    const pnrs = Array.from({ length: 100 }, (_, i) => generatePnr(2026, i));
    expect(new Set(pnrs).size).toBe(100);
    expect(pnrs[0]).toMatch(/^\d{2}[A-Z]{2}\d{4}$/);
  });
  it("generates roll numbers scoped per year", () => {
    expect(generateRollNumber(2026, 1045)).toBe("1045");
  });
  it("generates a student with a normalized search_name", () => {
    const s = generateStudent(42, 2026, 0);
    expect(s.search_name).toBe(`${s.first_name} ${s.last_name}`.toLowerCase());
    expect(s.pnr).toMatch(/^\d{2}[A-Z]{2}\d{4}$/);
  });
  it("generates the configured year sizes summing correctly", () => {
    const students = generateYear(2026, 2000);
    expect(students.length).toBe(2000);
    expect(new Set(students.map((s) => s.pnr)).size).toBe(2000);
  });
  it("marks are deterministic, in [40, 100], and grade mapping is consistent", () => {
    expect(marksFor(7)).toBe(marksFor(7));
    expect(marksFor(99)).toBeGreaterThanOrEqual(40);
    expect(marksFor(99)).toBeLessThanOrEqual(100);
    expect(gradeFor(92).grade_point).toBe(10);
    expect(gradeFor(35).result_status).toBe("fail");
  });
  it("attendance is deterministic and attendance <= conducted", () => {
    const a = attendanceFor(3);
    const b = attendanceFor(3);
    expect(a).toEqual(b);
    expect(a.classes_attended).toBeLessThanOrEqual(a.classes_conducted);
  });
  it("fee amounts are deterministic and positive", () => {
    expect(feeAmount(1, 3)).toBe(feeAmount(1, 3));
    expect(feeAmount(2, 5)).toBeGreaterThan(0);
  });
});

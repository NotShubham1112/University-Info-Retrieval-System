import { describe, it, expect } from "vitest";
import { feePaymentCreateSchema, feePaymentUpdateSchema } from "@/lib/validation/schemas";
import { feeCategoryRateCreateSchema, feeListQuerySchema } from "@/lib/validation/fee";
import { timetableCreateSchema } from "@/lib/validation/schemas";
import { timetableListQuerySchema } from "@/lib/validation/timetable";
import { examCreateSchema, marksEntrySchema } from "@/lib/validation/schemas";
import { notificationCreateSchema } from "@/lib/validation/schemas";

describe("fee validation", () => {
  it("feeCategoryRateCreateSchema accepts valid", () => {
    const r = feeCategoryRateCreateSchema.safeParse({
      course_id: 1,
      year_of_study: 2,
      academic_year: "2024-25",
      fee_type: "Tuition",
      amount: 50000,
    });
    expect(r.success).toBe(true);
  });

  it("feeCategoryRateCreateSchema rejects missing course_id", () => {
    const r = feeCategoryRateCreateSchema.safeParse({
      course_id: 0,
      year_of_study: 1,
      academic_year: "2024-25",
      amount: 100,
    });
    expect(r.success).toBe(false);
  });

  it("feePaymentCreateSchema accepts valid with scholarship link", () => {
    const r = feePaymentCreateSchema.safeParse({
      student_id: 1,
      fee_category_rate_id: 2,
      amount_due: 50000,
      amount_paid: 25000,
      status: "partial",
      scholarship_application_id: 3,
    });
    expect(r.success).toBe(true);
  });

  it("feePaymentCreateSchema rejects negative amount", () => {
    const r = feePaymentCreateSchema.safeParse({
      student_id: 1,
      fee_category_rate_id: 1,
      amount_due: -10,
      amount_paid: 0,
    });
    expect(r.success).toBe(false);
  });

  it("feePaymentUpdateSchema allows partial", () => {
    const r = feePaymentUpdateSchema.safeParse({ amount_paid: 1000 });
    expect(r.success).toBe(true);
  });

  it("feeListQuerySchema defaults", () => {
    const r = feeListQuerySchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(20);
  });
});

describe("timetable validation", () => {
  it("timetableCreateSchema accepts valid slot", () => {
    const r = timetableCreateSchema.safeParse({
      course_id: 1,
      semester_no: 2,
      day_of_week: 1,
      period_no: 3,
      subject_id: 5,
      teacher_id: 7,
      room_id: 2,
    });
    expect(r.success).toBe(true);
  });

  it("timetableCreateSchema rejects out-of-range day_of_week", () => {
    const r = timetableCreateSchema.safeParse({
      course_id: 1,
      semester_no: 1,
      day_of_week: 9,
      period_no: 1,
      subject_id: 1,
      teacher_id: 1,
    });
    expect(r.success).toBe(false);
  });

  it("timetableCreateSchema rejects missing required ids", () => {
    const r = timetableCreateSchema.safeParse({
      course_id: 1,
      semester_no: 1,
      day_of_week: 1,
      period_no: 1,
      subject_id: null,
      teacher_id: 1,
    } as unknown as Record<string, unknown>);
    // subject_id is required positive int, null should fail
    expect(r.success).toBe(false);
  });

  it("timetableListQuerySchema accepts filters", () => {
    const r = timetableListQuerySchema.safeParse({ course_id: 1, day_of_week: 3, limit: 10 });
    expect(r.success).toBe(true);
  });
});

describe("exam + marks validation", () => {
  it("examCreateSchema accepts final draft", () => {
    const r = examCreateSchema.safeParse({ course_id: 1, semester_no: 3, exam_type: "final", status: "draft" });
    expect(r.success).toBe(true);
  });

  it("examCreateSchema rejects semester_no out of range", () => {
    const r = examCreateSchema.safeParse({ course_id: 1, semester_no: 20, exam_type: "final" });
    expect(r.success).toBe(false);
  });

  it("marksEntrySchema accepts internal/external split", () => {
    const r = marksEntrySchema.safeParse({ student_id: 10, subject_id: 20, internal_marks: 30, external_marks: 45 });
    expect(r.success).toBe(true);
  });

  it("marksEntrySchema rejects negative marks", () => {
    const r = marksEntrySchema.safeParse({ student_id: 1, subject_id: 1, internal_marks: -5 });
    expect(r.success).toBe(false);
  });
});

describe("notification validation", () => {
  it("notificationCreateSchema accepts minimal", () => {
    const r = notificationCreateSchema.safeParse({ title: "Hello", body: "World" });
    expect(r.success).toBe(true);
  });

  it("notificationCreateSchema rejects empty title", () => {
    const r = notificationCreateSchema.safeParse({ title: "", body: "x" });
    expect(r.success).toBe(false);
  });

  it("notificationCreateSchema accepts recipient_role + student_ids", () => {
    const r = notificationCreateSchema.safeParse({
      title: "Exam",
      body: "Exam scheduled",
      type: "academic",
      priority: "high",
      channel: "in_app",
      recipient_role: "viewer",
      student_ids: [1, 2, 3],
    });
    expect(r.success).toBe(true);
  });
});

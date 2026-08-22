import { describe, it, expect } from "vitest";
import { studentCreateSchema, bulkStudentRowSchema, studentUpdateSchema } from "@/lib/validation/schemas";
import { parseCsvText, parseCsvRow } from "@/lib/validation/student";

describe("studentCreateSchema", () => {
  it("accepts valid minimal payload", () => {
    const res = studentCreateSchema.safeParse({
      first_name: "Rahul",
      last_name: "Sharma",
      email: "rahul@example.com",
    });
    expect(res.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const res = studentCreateSchema.safeParse({ first_name: "", last_name: "", email: "not-email" });
    expect(res.success).toBe(false);
  });

  it("accepts aadhaar when 12 digits", () => {
    const res = studentCreateSchema.safeParse({
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      aadhaar_number: "123456789012",
    });
    expect(res.success).toBe(true);
  });

  it("rejects invalid aadhaar", () => {
    const res = studentCreateSchema.safeParse({
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      aadhaar_number: "1234",
    });
    expect(res.success).toBe(false);
  });

  it("accepts admission nested payload", () => {
    const res = studentCreateSchema.safeParse({
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      admission: { course_id: 1, seat_type: "general_open" },
    });
    expect(res.success).toBe(true);
  });

  it("studentUpdateSchema allows partial", () => {
    const res = studentUpdateSchema.safeParse({ first_name: "New" });
    expect(res.success).toBe(true);
  });

  it("bulkStudentRowSchema extends create with row", () => {
    const res = bulkStudentRowSchema.safeParse({
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      row: 2,
    });
    expect(res.success).toBe(true);
  });
});

describe("parseCsvText", () => {
  it("parses headers and rows", () => {
    const csv = "first_name,last_name,email\nRahul,Sharma,rahul@example.com\nPriya,Singh,priya@example.com";
    const { headers, rows } = parseCsvText(csv);
    expect(headers).toEqual(["first_name", "last_name", "email"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]["first_name"]).toBe("Rahul");
  });

  it("handles quoted commas", () => {
    const csv = `first_name,address\nRahul,"123, Main St"`;
    const { rows } = parseCsvText(csv);
    expect(rows[0]["address"]).toBe("123, Main St");
  });

  it("returns empty for empty csv", () => {
    const { headers, rows } = parseCsvText("");
    expect(headers).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });
});

describe("parseCsvRow validation", () => {
  it("valid row passes", () => {
    const raw = { first_name: "Rahul", last_name: "Sharma", email: "r@example.com", course_id: "1" };
    const result = parseCsvRow(raw, 2);
    // parseCsvRow returns safeParse result augmented with row
    expect((result as unknown as { success: boolean }).success).toBe(true);
  });

  it("invalid row fails with per-row error", () => {
    const raw = { first_name: "", last_name: "Sharma", email: "bad-email" };
    const result = parseCsvRow(raw, 5);
    expect((result as unknown as { success: boolean }).success).toBe(false);
  });
});

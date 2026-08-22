import { describe, it, expect } from "vitest";
import { z } from "zod";
import { parseQuery, parseBody, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { paginationSchema, studentCreateSchema, searchQuerySchema } from "@/lib/validation/schemas";

describe("handlers helpers", () => {
  it("parseQuery succeeds with valid pagination", () => {
    const params = new URLSearchParams({ limit: "10", cursor: "123", q: "ram" });
    const r = parseQuery(searchQuerySchema, params);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.limit).toBe(10);
      expect(r.data.cursor).toBe("123");
    }
  });

  it("parseQuery rejects invalid limit and returns 400 response", () => {
    const params = new URLSearchParams({ limit: "9999" });
    const r = parseQuery(paginationSchema, params);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.response.status).toBe(400);
    }
  });

  it("parseBody succeeds and fails with 400 shape", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const goodReq = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ name: "Aisha" }),
    });
    const good = await parseBody(schema, goodReq);
    expect(good.success).toBe(true);

    const badReq = new Request("http://test", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const bad = await parseBody(schema, badReq);
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.response.status).toBe(400);
  });

  it("studentCreateSchema accepts valid and rejects bad aadhaar", () => {
    const good = studentCreateSchema.safeParse({
      first_name: "Aisha",
      last_name: "Khan",
      email: "aisha@example.com",
      status: "active",
    });
    expect(good.success).toBe(true);

    const badAadhaar = studentCreateSchema.safeParse({
      first_name: "Aisha",
      last_name: "Khan",
      email: "aisha@example.com",
      aadhaar_number: "123",
    });
    expect(badAadhaar.success).toBe(false);
  });

  it("cacheControlValue and fail/ok set correct headers", () => {
    expect(cacheControlValue(60)).toBe("public, max-age=60, stale-while-revalidate=120");
    const errRes = fail(400, "bad");
    expect(errRes.headers.get("Cache-Control")).toBe("no-store");
    const okRes = ok({ a: 1 }, { cacheControl: cacheControlValue(10) });
    expect(okRes.headers.get("Cache-Control")).toBe("public, max-age=10, stale-while-revalidate=20");
  });
});

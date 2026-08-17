import { describe, it, expect } from "vitest";
import { runSearch } from "./run-search";
import { createServiceClient } from "../supabase/service";

describe("runSearch integration", () => {
  const svc = createServiceClient();

  it("searches by PNR exactly", async () => {
    const res = await runSearch(svc, { q: "22CS1045", cursor: undefined });
    expect(Array.isArray(res.data)).toBe(true);
  });
});
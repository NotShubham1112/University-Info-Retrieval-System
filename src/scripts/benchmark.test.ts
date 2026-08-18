import { describe, it, expect } from "vitest";
import { summarize } from "./benchmark";

describe("benchmark summarize", () => {
  it("returns avg/min/max for a set of samples", () => {
    expect(summarize([10, 20, 30])).toEqual({ avg: 20, min: 10, max: 30 });
  });
  it("rounds averages to two decimals", () => {
    expect(summarize([1, 2, 2]).avg).toBe(1.67);
  });
});

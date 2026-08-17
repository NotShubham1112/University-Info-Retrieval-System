import { describe, it, expect } from "vitest";
import { buildSearchParams } from "./queries";

describe("buildSearchParams", () => {
  it("PNR uses exact equality", () => {
    expect(buildSearchParams("22CS1045")).toMatchObject({
      column: "pnr",
      operator: "eq",
      value: "22CS1045",
    });
  });
  it("roll number uses exact equality", () => {
    expect(buildSearchParams("1045")).toMatchObject({
      column: "roll_number",
      operator: "eq",
      value: "1045",
    });
  });
  it("name uses trigram ilike", () => {
    expect(buildSearchParams("rahul")).toMatchObject({
      column: "search_name",
      operator: "ilike",
      value: "%rahul%",
    });
  });
});
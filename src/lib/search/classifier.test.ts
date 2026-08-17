import { describe, it, expect } from "vitest";
import { classifyQuery } from "./classifier";

describe("classifyQuery", () => {
  it("detects a PNR like 22CS1045", () => {
    expect(classifyQuery("22CS1045")).toEqual({ type: "pnr" });
  });
  it("detects a bare roll number like 1045", () => {
    expect(classifyQuery("1045")).toEqual({ type: "roll" });
  });
  it("detects a name", () => {
    expect(classifyQuery("Rahul Sharma")).toEqual({ type: "name" });
    expect(classifyQuery("rahul")).toEqual({ type: "name" });
  });
  it("treats empty input as name (no matches)", () => {
    expect(classifyQuery("")).toEqual({ type: "name" });
  });
});
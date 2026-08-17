import { classifyQuery } from "./classifier";

export interface SearchParam {
  column: "pnr" | "roll_number" | "search_name";
  operator: "eq" | "ilike";
  value: string;
}

export function buildSearchParams(input: string): SearchParam {
  const { type } = classifyQuery(input);
  const q = input.trim();
  if (type === "pnr") return { column: "pnr", operator: "eq", value: q };
  if (type === "roll") return { column: "roll_number", operator: "eq", value: q };
  return { column: "search_name", operator: "ilike", value: `%${q.toLowerCase()}%` };
}

export const SEARCH_LIMIT = 50;
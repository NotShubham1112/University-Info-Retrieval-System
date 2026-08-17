export type SearchKind = "pnr" | "roll" | "name";

const PNR_RE = /^\d{2}[A-Z]{2}\d{4}$/i;
const ROLL_RE = /^\d{1,6}$/;

export function classifyQuery(input: string): { type: SearchKind } {
  const q = input.trim();
  if (PNR_RE.test(q)) return { type: "pnr" };
  if (ROLL_RE.test(q)) return { type: "roll" };
  return { type: "name" };
}
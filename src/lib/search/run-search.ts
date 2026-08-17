import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSearchParams, SEARCH_LIMIT } from "./queries";

export interface StudentSummary {
  id: number;
  pnr: string;
  roll_number: string;
  first_name: string;
  last_name: string;
  program_id: number;
  admission_date: string;
}

export async function runSearch(
  supabase: SupabaseClient,
  args: { q: string; cursor?: number },
): Promise<{ data: StudentSummary[]; nextCursor: number | null }> {
  const p = buildSearchParams(args.q);
  let query = supabase
    .from("students")
    .select("id,pnr,roll_number,first_name,last_name,program_id,admission_date")
    .order("id", { ascending: true })
    .limit(SEARCH_LIMIT);

  if (p.operator === "eq") {
    query = query.eq(p.column, p.value);
  } else {
    query = query.ilike(p.column, p.value);
  }
  if (args.cursor) query = query.gt("id", args.cursor);

  const { data, error } = await query;
  if (error) throw new Error(`search failed: ${error.message}`);

  const rows = data ?? [];
  const nextCursor = rows.length === SEARCH_LIMIT ? rows[rows.length - 1].id : null;
  return { data: rows, nextCursor };
}
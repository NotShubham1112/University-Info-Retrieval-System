import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { runSearch } from "@/lib/search/run-search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const cursorRaw = req.nextUrl.searchParams.get("cursor");
  const cursor = cursorRaw ? Number(cursorRaw) : undefined;
  const supabase = await createServerClient();
  try {
    const result = await runSearch(supabase, { q, cursor });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
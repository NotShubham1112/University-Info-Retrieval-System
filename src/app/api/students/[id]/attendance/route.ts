import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("enrollments")
    .select("attendance(id,classes_conducted,classes_attended)")
    .eq("student_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).flatMap((e) => e.attendance ?? []));
}
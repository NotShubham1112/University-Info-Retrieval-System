import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";

const MUTABLE_COLUMNS = [
  "first_name",
  "last_name",
  "date_of_birth",
  "email",
  "phone",
  "admission_date",
  "status",
  "program_id",
  "campus_id",
] as const;

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { admin, user } = await requireAdmin();
  if (!admin || !user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;

  if (body.pnr !== undefined || body.roll_number !== undefined) {
    return NextResponse.json(
      { error: "pnr and roll number cannot be changed" },
      { status: 400 },
    );
  }

  const svc = createServiceClient();
  const { data: existing, error: fetchError } = await svc
    .from("students")
    .select("id,first_name,last_name")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  for (const column of MUTABLE_COLUMNS) {
    if (body[column] !== undefined) updates[column] = body[column];
  }

  if (
    updates.first_name !== undefined ||
    updates.last_name !== undefined
  ) {
    const first_name =
      typeof updates.first_name === "string" && updates.first_name.trim() !== ""
        ? updates.first_name.trim()
        : existing.first_name;
    const last_name =
      typeof updates.last_name === "string" && updates.last_name.trim() !== ""
        ? updates.last_name.trim()
        : existing.last_name;
    updates.search_name = `${first_name} ${last_name}`.toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { data: student, error } = await svc
    .from("students")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await svc.from("audit_logs").insert({
    user_id: user.id,
    action: "update",
    entity: "students",
    entity_id: student.id,
    detail: updates,
  });

  return NextResponse.json(student);
}

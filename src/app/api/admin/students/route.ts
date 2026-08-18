import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin";

function text(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function integer(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export async function POST(req: NextRequest) {
  const { admin, user } = await requireAdmin();
  if (!admin || !user) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  const first_name = text(body, "first_name");
  const last_name = text(body, "last_name");
  const pnr = text(body, "pnr");
  const roll_number = text(body, "roll_number");
  const admission_date = text(body, "admission_date");
  const email = text(body, "email");
  const phone = text(body, "phone");
  const date_of_birth = text(body, "date_of_birth");
  const program_id = integer(body, "program_id");
  const university_id = integer(body, "university_id");
  const campus_id = integer(body, "campus_id");

  if (!first_name || !last_name || !pnr || !roll_number || !admission_date) {
    return NextResponse.json(
      { error: "first name, last name, pnr, roll number and admission date are required" },
      { status: 400 },
    );
  }
  if (!program_id || !university_id || !campus_id) {
    return NextResponse.json(
      { error: "program, university and campus are required" },
      { status: 400 },
    );
  }

  const search_name = `${first_name} ${last_name}`.toLowerCase();
  const svc = createServiceClient();
  const { data: student, error } = await svc
    .from("students")
    .insert({
      university_id,
      campus_id,
      program_id,
      pnr,
      roll_number,
      first_name,
      last_name,
      search_name,
      admission_date,
      ...(date_of_birth ? { date_of_birth } : {}),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await svc.from("audit_logs").insert({
    user_id: user.id,
    action: "create",
    entity: "students",
    entity_id: student.id,
    detail: { pnr: student.pnr, roll_number: student.roll_number },
  });

  return NextResponse.json(student);
}

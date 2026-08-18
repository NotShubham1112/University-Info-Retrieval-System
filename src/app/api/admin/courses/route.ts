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

  const program_id = integer(body, "program_id");
  const semester_no = integer(body, "semester_no");
  const code = text(body, "code");
  const name = text(body, "name");

  if (!program_id || !semester_no || !code || !name) {
    return NextResponse.json(
      { error: "program, semester number, code and name are required" },
      { status: 400 },
    );
  }

  const svc = createServiceClient();
  const { data: subject, error } = await svc
    .from("subjects")
    .insert({ program_id, semester_no, code, name })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await svc.from("audit_logs").insert({
    user_id: user.id,
    action: "create",
    entity: "subjects",
    entity_id: subject.id,
    detail: { code: subject.code, name: subject.name },
  });

  return NextResponse.json(subject);
}

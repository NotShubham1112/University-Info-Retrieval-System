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

  const campus_id = integer(body, "campus_id");
  const name = text(body, "name");

  if (!campus_id || !name) {
    return NextResponse.json(
      { error: "campus and name are required" },
      { status: 400 },
    );
  }

  const svc = createServiceClient();
  const { data: department, error } = await svc
    .from("departments")
    .insert({ campus_id, name })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await svc.from("audit_logs").insert({
    user_id: user.id,
    action: "create",
    entity: "departments",
    entity_id: department.id,
    detail: { name: department.name },
  });

  return NextResponse.json(department);
}

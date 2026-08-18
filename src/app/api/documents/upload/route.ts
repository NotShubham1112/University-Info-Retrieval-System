import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { BUCKET, ensureBucket, storageKey } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const studentIdRaw = form.get("studentId");
  const documentTypeRaw = form.get("documentType");
  const file = form.get("file");

  const studentId = typeof studentIdRaw === "string" ? Number(studentIdRaw) : Number.NaN;
  const documentType = typeof documentTypeRaw === "string" ? documentTypeRaw.trim() : "";

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return NextResponse.json({ error: "invalid student id" }, { status: 400 });
  }
  if (!documentType) {
    return NextResponse.json({ error: "document type is required" }, { status: 400 });
  }
  if (!(file instanceof File) || !file.name) {
    return NextResponse.json({ error: "a file is required" }, { status: 400 });
  }

  const svc = createServiceClient();
  try {
    await ensureBucket();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "storage is unavailable" },
      { status: 500 },
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const key = storageKey(studentId, documentType, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage.from(BUCKET).upload(key, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: doc, error } = await svc
    .from("student_documents")
    .insert({
      student_id: studentId,
      document_type: documentType,
      file_name: file.name,
      storage_key: key,
      file_size: file.size,
      mime_type: mimeType,
      version: 1,
      uploaded_by: user.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from("audit_logs").insert({
    user_id: user.id,
    action: "upload",
    entity: "student_documents",
    entity_id: doc.id,
  });

  return NextResponse.json(doc);
}

import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fail, ok } from "@/lib/api/handlers";
import { assertPermissionOrFail } from "@/lib/admin";
import { cacheInvalidate } from "@/lib/cache/index";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");
  const svc = createServiceClient();
  const { data, error } = await svc.from("documents").select("*").eq("student_id", id).order("uploaded_at", { ascending: false });
  if (error) return fail(500, error.message, "INTERNAL_ERROR");
  return ok({ data: data ?? [] });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  const denied = assertPermissionOrFail(user, "student:write");
  if (denied) return denied;

  // Support both JSON (metadata only, no file) and multipart/form-data
  let document_type = "other";
  let file_name = "";
  let mime_type = "application/octet-stream";
  let file_size = 0;
  let storage_key = "";
  let buffer: Uint8Array | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    document_type = String(form.get("document_type") ?? "other");
    const file = form.get("file") as File | null;
    if (file && typeof file.arrayBuffer === "function") {
      file_name = file.name || String(form.get("file_name") ?? `doc-${Date.now()}.pdf`);
      mime_type = file.type || "application/octet-stream";
      file_size = file.size;
      const ab = await file.arrayBuffer();
      buffer = new Uint8Array(ab);
      storage_key = `students/${id}/${Date.now()}-${file_name}`;
    } else {
      file_name = String(form.get("file_name") ?? file_name);
      storage_key = String(form.get("storage_key") ?? storage_key);
      mime_type = String(form.get("mime_type") ?? mime_type);
      file_size = Number(form.get("file_size") ?? 0);
      if (!storage_key) storage_key = `students/${id}/${file_name || `doc-${Date.now()}${mime_type.includes("pdf") ? ".pdf" : ""}`}`;
    }
  } else {
    let json: Record<string, unknown> = {};
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      return fail(400, "Invalid JSON body");
    }
    document_type = String(json["document_type"] ?? "other");
    file_name = String(json["file_name"] ?? `doc-${Date.now()}.pdf`);
    mime_type = String(json["mime_type"] ?? "application/octet-stream");
    file_size = Number(json["file_size"] ?? 0);
    storage_key = String(json["storage_key"] ?? `students/${id}/${file_name}`);
  }

  if (!file_name) return fail(400, "file_name is required");
  if (!storage_key) storage_key = `students/${id}/${file_name}`;

  const svc = createServiceClient();

  // Attempt Storage upload if we have a buffer
  if (buffer) {
    try {
      const { error: upErr } = await svc.storage.from("documents").upload(storage_key, buffer, {
        contentType: mime_type,
        upsert: true,
      });
      if (upErr) {
        // Non-fatal: log but continue with DB insert (storage bucket may not exist in dev)
        console.warn("storage upload failed:", upErr.message);
      }
    } catch (e) {
      console.warn("storage upload exception:", (e as Error).message);
    }
  }

  const row: Record<string, unknown> = {
    student_id: Number(id),
    document_type,
    file_name,
    storage_key,
    file_size: file_size || (buffer ? buffer.byteLength : 0) || 0,
    mime_type,
    version: 1,
    uploaded_at: new Date().toISOString(),
    uploaded_by: user.id ?? null,
    status: "active",
    verified_status: "pending",
  };

  // Handle version bump if same file_name already exists for this student
  try {
    const { data: existing } = await svc.from("documents").select("version").eq("student_id", id).eq("file_name", file_name).maybeSingle();
    if (existing) {
      row["version"] = (existing as { version: number }).version + 1;
    }
  } catch {}

  const { data, error } = await svc.from("documents").insert(row as never).select("*").single();
  if (error) return fail(500, error.message, "INTERNAL_ERROR");

  await cacheInvalidate("profile:");
  await cacheInvalidate("list:");

  const res = ok(data);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!id) return fail(400, "Missing id");

  const auth = await createServerClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return fail(401, "Unauthorized", "UNAUTHORIZED");
  // Verification requires docs:verify
  const denied = assertPermissionOrFail(user, "docs:verify");
  if (denied) return denied;

  let json: Record<string, unknown> = {};
  try {
    json = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const documentId = json["document_id"] ?? json["id"];
  const verified_status = String(json["verified_status"] ?? "");
  if (!documentId) return fail(400, "document_id is required");
  if (!["pending", "verified", "rejected"].includes(verified_status)) {
    return fail(400, "verified_status must be pending|verified|rejected");
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("documents")
    .update({
      verified_status,
      verified_by: user.id ?? null,
      verified_date: new Date().toISOString(),
    } as never)
    .eq("id", Number(documentId))
    .eq("student_id", Number(id))
    .select("*")
    .maybeSingle();

  if (error) return fail(500, error.message, "INTERNAL_ERROR");
  if (!data) return fail(404, "Document not found", "NOT_FOUND");

  const res = ok(data);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

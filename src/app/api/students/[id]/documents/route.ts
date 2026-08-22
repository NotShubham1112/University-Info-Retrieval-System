import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getCachedOrSet, CACHE_TTL } from "@/lib/cache/index";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const cacheKey = `profile:documents:${sid}`;

  try {
    const data = await getCachedOrSet(cacheKey, CACHE_TTL.profile, async () => {
      const supabase = await createServerClient();
      // v4: `documents` (renamed from `student_documents`), keep compat aliases
      const { data, error } = await supabase
        .from("documents")
        .select("id,document_type,file_name,storage_key,file_size,mime_type,uploaded_at,version,verified_status")
        .eq("student_id", sid)
        .order("uploaded_at", { ascending: false })
        .limit(50);
      if (error) {
        // fallback to legacy table name if view not yet deployed
        const isMissing = /does not exist|relation.*documents/i.test(error.message);
        if (isMissing) {
          const { data: legacy, error: legErr } = await supabase
            .from("student_documents" as any)
            .select("id,document_type,file_name,file_size,mime_type,uploaded_at,version")
            .eq("student_id", sid)
            .limit(50);
          if (legErr) throw legErr;
          return legacy ?? [];
        }
        throw error;
      }
      // normalize: expose file_name/storage_key compat, keep verified_status
      return (data ?? []).map((r: any) => ({
        id: r.id,
        document_type: r.document_type,
        file_name: r.file_name,
        file_size: r.file_size,
        mime_type: r.mime_type,
        uploaded_at: r.uploaded_at,
        version: r.version,
        verified_status: r.verified_status ?? null,
        storage_key: r.storage_key ?? null,
      }));
    });

    const res = NextResponse.json(data);
    res.headers.set("Cache-Control", `public, max-age=${CACHE_TTL.profile}, stale-while-revalidate=30`);
    return res;
  } catch (e: any) {
    console.warn("[documents] fallback empty:", e?.message);
    return NextResponse.json([]);
  }
}

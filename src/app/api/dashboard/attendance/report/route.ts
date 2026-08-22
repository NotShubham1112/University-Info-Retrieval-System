import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseQuery, fail, ok, cacheControlValue } from "@/lib/api/handlers";
import { attendanceReportQuerySchema } from "@/lib/validation/attendance";
import { getCachedOrSet, CACHE_TTL, buildCacheKey } from "@/lib/cache/index";

export async function GET(req: NextRequest) {
  const parsed = parseQuery(attendanceReportQuerySchema, req.nextUrl.searchParams);
  if (!parsed.success) return parsed.response;
  const { course_id, subject_id, date, month, from, to, group_by } = parsed.data as {
    course_id?: number | null; subject_id?: number | null; date?: string | null; month?: string | null; from?: string | null; to?: string | null; group_by?: string;
  };

  const cacheKey = buildCacheKey("GET", "/api/dashboard/attendance/report", {
    course_id: course_id ?? "", subject_id: subject_id ?? "", date: date ?? "", month: month ?? "", from: from ?? "", to: to ?? "", group_by: group_by ?? "",
  });
  const prefixedKey = `list:attendance:report:${cacheKey}`;

  try {
    const result = await getCachedOrSet(prefixedKey, CACHE_TTL.list, async () => {
      const svc = createServiceClient() as unknown as {
        from: (t: string) => unknown;
        rpc: (fn: string) => Promise<{ error?: { message: string } | null }>;
      };

      // Try matview first
      let matviewRows: Array<Record<string, unknown>> | null = null;
      let stale = false;
      try {
        const res = await (svc.from("mv_attendance_summary") as unknown as { select: (c: string) => { limit: (n: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } }).select("*").limit(10);
        const data = (res as { data: unknown[] | null; error: { message: string } | null }).data;
        const error = (res as { error: { message: string } | null }).error;
        if (!error && data && (data as unknown[]).length > 0) {
          matviewRows = data as unknown as Array<Record<string, unknown>>;
        } else {
          stale = true;
        }
      } catch {
        stale = true;
      }

      // Live aggregation from attendance_records
      let liveRows: Array<Record<string, unknown>> = [];
      let summary: Record<string, unknown> = { total: 0, present: 0, attendance_pct: 0 };
      try {
        let q: unknown = (svc.from("attendance_records") as unknown as { select: (c: string) => unknown }).select("*");
        if (course_id) q = (q as { eq: (c: string, v: unknown) => unknown }).eq("course_id", course_id);
        if (subject_id) q = (q as { eq: (c: string, v: unknown) => unknown }).eq("subject_id", subject_id);
        if (date) q = (q as { eq: (c: string, v: unknown) => unknown }).eq("date", date);
        else if (month) {
          const start = `${month}-01`;
          const endDate = new Date(`${month}-01`);
          endDate.setMonth(endDate.getMonth() + 1);
          const end = endDate.toISOString().slice(0, 10);
          q = (q as { gte: (c: string, v: unknown) => unknown }).gte("date", start);
          q = (q as { lt: (c: string, v: unknown) => unknown }).lt("date", end);
        } else {
          if (from) q = (q as { gte: (c: string, v: unknown) => unknown }).gte("date", from);
          if (to) q = (q as { lte: (c: string, v: unknown) => unknown }).lte("date", to);
        }
        q = (q as { limit: (n: number) => unknown }).limit(2000);
        const { data, error } = await (q as unknown as Promise<{ data: Array<{ date: string; course_id: number | null; subject_id: number | null; status: string }> | null; error: { message: string } | null }>);
        if (error) throw error;
        const rows = (data ?? []) as Array<{ date: string; course_id: number | null; subject_id: number | null; status: string }>;
        const groups = new Map<string, { date?: string | null; course_id?: number | null; subject_id?: number | null; total: number; present: number; absent: number; late: number; leave: number }>();
        for (const r of rows) {
          let key: string;
          if (group_by === "monthly") key = r.date.slice(0, 7);
          else if (group_by === "course") key = String(r.course_id ?? "unknown");
          else if (group_by === "subject") key = String(r.subject_id ?? "unknown");
          else key = r.date;
          let g = groups.get(key);
          if (!g) {
            g = { total: 0, present: 0, absent: 0, late: 0, leave: 0 };
            if (group_by === "daily" || group_by === "monthly") (g as { date: string | null }).date = group_by === "monthly" ? r.date.slice(0, 7) : r.date;
            if (group_by === "course") (g as { course_id: number | null }).course_id = r.course_id;
            if (group_by === "subject") (g as { subject_id: number | null }).subject_id = r.subject_id;
            groups.set(key, g);
          }
          g.total += 1;
          if (r.status === "present") g.present += 1;
          else if (r.status === "absent") g.absent += 1;
          else if (r.status === "late") g.late += 1;
          else if (r.status === "leave") g.leave += 1;
        }
        const mapped = Array.from(groups.entries()).map(([k, g]) => ({
          date: (g as { date?: string | null }).date ?? (group_by === "daily" ? k : null),
          course_id: (g as { course_id?: number | null }).course_id ?? (group_by === "course" ? (Number(k) || null) : (course_id ?? null)),
          subject_id: (g as { subject_id?: number | null }).subject_id ?? (group_by === "subject" ? (Number(k) || null) : (subject_id ?? null)),
          total: g.total,
          present: g.present,
          absent: g.absent,
          late: g.late,
          leave: g.leave,
          attendance_pct: g.total > 0 ? Math.round((g.present / g.total) * 10000) / 100 : 0,
        }));
        liveRows = mapped as unknown as Array<Record<string, unknown>>;
        const total = mapped.reduce((a, b) => a + b.total, 0);
        const present = mapped.reduce((a, b) => a + b.present, 0);
        summary = { total, present, attendance_pct: total > 0 ? Math.round((present / total) * 10000) / 100 : 0 };

        if (stale && total === 0) {
          try { await svc.rpc("refresh_report_views"); stale = false; } catch {}
        }
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? String(err);
        if (msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation")) {
          if (matviewRows && matviewRows.length > 0) {
            const mv = matviewRows[0] as Record<string, unknown>;
            return {
              rows: [{ date: date ?? null, course_id: mv["course_id"] ?? null, total: Number(mv["record_count"] ?? 0), present: Number(mv["total_attended"] ?? 0), absent: 0, late: 0, leave: 0, attendance_pct: Number(mv["attendance_pct"] ?? 0) }],
              summary: { total: Number(mv["record_count"] ?? 0), present: Number(mv["total_attended"] ?? 0), attendance_pct: Number(mv["attendance_pct"] ?? 0) },
              stale: true,
              _note: "attendance_records table not present; serving matview mv_attendance_summary",
            };
          }
          return { rows: [], summary: { total: 0, present: 0, attendance_pct: 0 }, stale: true, _note: "attendance_records table not present" };
        }
        throw err;
      }

      if (liveRows.length === 0 && matviewRows && matviewRows.length > 0) {
        const mv = matviewRows[0] as Record<string, unknown>;
        return {
          rows: [{ date: date ?? null, course_id: mv["course_id"] ?? null, total: Number(mv["record_count"] ?? 0), present: Number(mv["total_attended"] ?? 0), absent: 0, late: 0, leave: 0, attendance_pct: Number(mv["attendance_pct"] ?? 0) }],
          summary,
          stale,
        };
      }

      return { rows: liveRows, summary, stale };
    });

    const res = ok(result);
    res.headers.set("Cache-Control", cacheControlValue(CACHE_TTL.list));
    return res;
  } catch (e) {
    return fail(500, (e as Error).message, "INTERNAL_ERROR");
  }
}

/**
 * Concurrency load test — Task 10 benchmark gate (spec §11).
 *
 * 50 concurrent × 2K requests mixed read profile against the real local HTTP API.
 * Mixed profile: search 30%, profile 40%, dashboard stats 20%, list 10%.
 * Reports p50/p95/p99, throughput, error rate, per-endpoint breakdown.
 * Gates: p50 < 100ms, p95 < 250ms, 0 errors, dashboard < 2s, Redis hot < 5ms.
 * Exits non-zero on gate failure. Handles no-server gracefully (exit 1, no crash).
 *
 * Usage:
 *   npx tsx --env-file=.env src/scripts/load-test.ts
 *   npx tsx --env-file=.env src/scripts/load-test.ts --concurrency=50 --requests=2000
 *   npx tsx --env-file=.env src/scripts/load-test.ts --base=http://127.0.0.1:3000
 *   npx tsx --env-file=.env src/scripts/load-test.ts --help
 */
import { performance } from "node:perf_hooks";

type EndpointLabel = "search" | "profile" | "stats" | "list";

interface Sample {
  label: EndpointLabel;
  url: string;
  latencyMs: number;
  status: number | null;
  ok: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
function parseArgs(): {
  concurrency: number;
  requests: number;
  base: string;
  help: boolean;
  timeoutMs: number;
} {
  const raw = process.argv.slice(2);
  let concurrency = 50;
  let requests = 2000;
  let base = process.env.LOAD_TEST_BASE ?? "http://127.0.0.1:3000";
  let timeoutMs = 8000;
  let help = false;
  for (const a of raw) {
    if (a === "--help" || a === "-h") help = true;
    else if (a.startsWith("--concurrency=")) concurrency = Number(a.split("=")[1]);
    else if (a.startsWith("--requests=")) requests = Number(a.split("=")[1]);
    else if (a.startsWith("--base=")) base = a.split("=")[1].replace(/\/$/, "");
    else if (a.startsWith("--timeout=")) timeoutMs = Number(a.split("=")[1]);
    else if (a === "--concurrency" || a === "--requests" || a === "--base") {
      // support --flag value form (next arg)
      const idx = raw.indexOf(a);
      const next = raw[idx + 1];
      if (next && !next.startsWith("--")) {
        if (a === "--concurrency") concurrency = Number(next);
        if (a === "--requests") requests = Number(next);
        if (a === "--base") base = next.replace(/\/$/, "");
      }
    }
  }
  // sanitize
  if (!Number.isFinite(concurrency) || concurrency < 1) concurrency = 50;
  if (!Number.isFinite(requests) || requests < 1) requests = 2000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) timeoutMs = 8000;
  concurrency = Math.floor(concurrency);
  requests = Math.floor(requests);
  if (requests < concurrency) requests = concurrency;
  return { concurrency, requests, base, help, timeoutMs };
}

function helpText(): string {
  return `
load-test — ERP v4 concurrency benchmark gate (Task 10, spec §11)

Targets: p50 < 100ms, p95 < 250ms, 0 errors, dashboard < 2s, Redis hot < 5ms
Requires the Next.js dev/prod server running at the base URL (default http://127.0.0.1:3000).

Usage:
  npx tsx --env-file=.env src/scripts/load-test.ts [options]

Options:
  --concurrency=N   concurrent workers (default 50)
  --requests=N      total requests across all workers (default 2000)
  --base=URL        base URL of the running app (default http://127.0.0.1:3000 or LOAD_TEST_BASE env)
  --timeout=MS      per-request timeout in ms (default 8000)
  --help, -h        show this help

Profile (weighted per request):
  search  30%  GET /api/search?q=...
  profile 40%  GET /api/students/:id
  stats   20%  GET /api/dashboard/students?limit=10  (proxy for dashboard_stats RPC)
  list    10%  GET /api/dashboard/teachers?limit=10  (representative list endpoint)

Also runs:
  - Cache-hot check: same search query twice, second hit < 5ms
  - Dashboard page load: GET /dashboard/admin < 2s (or / if redirect)

Exit codes:
  0 all gates pass
  1 gate failure, server unreachable, or error

Examples:
  npx tsx --env-file=.env src/scripts/load-test.ts --concurrency=10 --requests=100
  npx tsx --env-file=.env src/scripts/load-test.ts --base=http://127.0.0.1:3000
`.trim();
}

// ---------------------------------------------------------------------------
// Stats helpers
// ---------------------------------------------------------------------------
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function summarizeStats(values: number[]): {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
} {
  if (values.length === 0) return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / values.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function fmtMs(n: number): string {
  return `${n.toFixed(2)}ms`;
}

// ---------------------------------------------------------------------------
// Endpoint pickers (weighted)
// ---------------------------------------------------------------------------
const SEARCH_QUERIES = ["ram", "sharma", "priya", "singh", "22CS0001", "1045", "Rahul", ""];
const PROFILE_IDS = [1, 2, 3, 10, 50, 100, 500, 1000]; // representative ids (first seeded rows are 1..N)

function pickLabel(r: number): EndpointLabel {
  // r in [0,1)
  if (r < 0.3) return "search";
  if (r < 0.7) return "profile"; // 30+40
  if (r < 0.9) return "stats"; // 20
  return "list"; // 10
}

function buildUrl(base: string, label: EndpointLabel): { label: EndpointLabel; url: string } {
  switch (label) {
    case "search": {
      const q = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
      const limit = 10 + Math.floor(Math.random() * 10);
      return { label, url: `${base}/api/search?q=${encodeURIComponent(q)}&limit=${limit}` };
    }
    case "profile": {
      const id = PROFILE_IDS[Math.floor(Math.random() * PROFILE_IDS.length)];
      // /api/students/[id] is the public profile view (no auth needed, cached profile: 60s)
      return { label, url: `${base}/api/students/${id}` };
    }
    case "stats": {
      // dashboard stats proxy — list route with reference TTL 60s, backed by student_summary
      // (no dedicated /api/dashboard/stats HTTP route; RPC is server-rendered, so we use a list)
      const limit = 10;
      return { label, url: `${base}/api/dashboard/students?limit=${limit}` };
    }
    case "list": {
      // representative list endpoint (teacher list, 300s TTL)
      const limit = 10;
      const variants = [
        `${base}/api/dashboard/teachers?limit=${limit}`,
        `${base}/api/dashboard/courses?limit=${limit}`,
      ];
      return { label, url: variants[Math.floor(Math.random() * variants.length)] };
    }
  }
}

// ---------------------------------------------------------------------------
// Single fetch with timeout + timing
// ---------------------------------------------------------------------------
async function timedFetch(url: string, timeoutMs: number): Promise<{ latencyMs: number; status: number | null; ok: boolean; error?: string }> {
  const t0 = performance.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
    const latencyMs = performance.now() - t0;
    // Drain body to avoid socket leak (but ignore content)
    try {
      await res.text();
    } catch {}
    return { latencyMs, status: res.status, ok: res.ok };
  } catch (e) {
    const latencyMs = performance.now() - t0;
    const msg = (e as Error).message ?? String(e);
    const isAbort = msg.includes("abort") || (e as Error).name === "AbortError";
    return { latencyMs, status: null, ok: false, error: isAbort ? `timeout after ${timeoutMs}ms` : msg };
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Cache-hot probe: same search query twice, second < 5ms
// ---------------------------------------------------------------------------
async function probeCacheHot(base: string, timeoutMs: number): Promise<{ firstMs: number; secondMs: number; pass: boolean; note: string }> {
  const url = `${base}/api/search?q=${encodeURIComponent("ram")}&limit=10`;
  const first = await timedFetch(url, timeoutMs);
  // tiny pause to let LRU settle
  await new Promise((r) => setTimeout(r, 25));
  const second = await timedFetch(url, timeoutMs);
  // Redis hot < 5ms gate is strict; LRU hot path is sub-ms. Allow 10ms as "warm" in degraded/no-Redis mode?
  // Spec says <5ms for Redis-served hot queries — we assert <5ms but note when LRU-only is expected.
  const pass = second.ok && second.latencyMs < 5;
  const note = !second.ok
    ? `second request failed (status ${second.status ?? "no response"}: ${second.error ?? ""})`
    : pass
      ? "hot cache hit < 5ms"
      : `second hit ${second.latencyMs.toFixed(2)}ms exceeds 5ms (may be cache miss, cold Redis, or no server — warm query was ${first.latencyMs.toFixed(2)}ms)`;
  return { firstMs: first.latencyMs, secondMs: second.latencyMs, pass, note };
}

// ---------------------------------------------------------------------------
// Dashboard page load probe: <2s
// ---------------------------------------------------------------------------
async function probeDashboard(base: string, timeoutMs: number): Promise<{ latencyMs: number; status: number | null; pass: boolean; url: string; note: string }> {
  // Try /dashboard/admin first (may redirect to /login for anon → still measures response)
  const candidates = [`${base}/dashboard/admin`, `${base}/`];
  for (const url of candidates) {
    const r = await timedFetch(url, 12_000);
    const pass = r.latencyMs < 2000;
    const note = pass ? "dashboard < 2s" : `dashboard ${r.latencyMs.toFixed(2)}ms exceeds 2000ms (status ${r.status ?? "?"}, err ${r.error ?? "-"})`;
    // Return first candidate that responded at all (even redirect is ok for latency gate)
    if (r.status !== null || r.error === undefined) {
      return { latencyMs: r.latencyMs, status: r.status, pass, url, note };
    }
  }
  const r = await timedFetch(candidates[0], timeoutMs);
  return {
    latencyMs: r.latencyMs,
    status: r.status,
    pass: r.latencyMs < 2000 && r.ok,
    url: candidates[0],
    note: `dashboard probe fallback`,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { concurrency, requests, base, help, timeoutMs } = parseArgs();
  if (help) {
    console.log(helpText());
    process.exit(0);
  }

  const perWorker = Math.ceil(requests / concurrency);
  const totalPlanned = concurrency * perWorker; // may be slightly > requested (last worker truncated)
  const totalRequests = Math.min(totalPlanned, requests);

  console.log("────────────────────────────────────────────────────────");
  console.log("  ERP v4 load test — Task 10 concurrency gate");
  console.log("────────────────────────────────────────────────────────");
  console.log(`  base:           ${base}`);
  console.log(`  concurrency:    ${concurrency} workers`);
  console.log(`  requests:       ${totalRequests} (requested ${requests}, per-worker ${perWorker})`);
  console.log(`  timeout:        ${timeoutMs}ms per request`);
  console.log(`  profile:        search 30% · profile 40% · stats 20% · list 10%`);
  console.log("────────────────────────────────────────────────────────");

  // Quick connectivity check — fail fast with clear message instead of cryptic ECONNREFUSED spread
  const probe = await timedFetch(`${base}/api/search?q=ram&limit=5`, Math.min(timeoutMs, 4000));
  if (probe.status === null && probe.error) {
    void probe.error; // consumed in message below
    console.log("");
    console.log("  ✗ Server not reachable.");
    console.log(`  Could not connect to ${base} (${probe.error}).`);
    console.log("");
    console.log("  Start the app first:");
    console.log("    npm run dev   # then re-run this load test in another terminal");
    console.log("    # or: npm run build && npm start");
    console.log("");
    console.log("  Gate: FAIL (no server)");
    console.log("────────────────────────────────────────────────────────");
    process.exit(1);
  }

  // Warmup: prime caches with one of each type so first batch isn't artificially cold? Keep it minimal.
  // We do a small warmup but include its samples separately? Exclude warmup from gate stats.
  // Simple: do not count warmup.

  const all: Sample[] = [];
  const tWall0 = performance.now();

  // Worker pool via Promise.all: each worker does perWorker requests sequentially (avoids bursting sockets)
  const workers: Promise<void>[] = [];
  let dispatched = 0;

  for (let w = 0; w < concurrency; w++) {
    const countForThisWorker = Math.min(perWorker, totalRequests - dispatched);
    if (countForThisWorker <= 0) break;
    dispatched += countForThisWorker;

    workers.push(
      (async () => {
        for (let i = 0; i < countForThisWorker; i++) {
          const label = pickLabel(Math.random());
          const { url } = buildUrl(base, label);
          const r = await timedFetch(url, timeoutMs);
          all.push({ label, url, latencyMs: r.latencyMs, status: r.status, ok: r.ok, error: r.error });
        }
      })(),
    );
  }

  await Promise.all(workers);
  const wallMs = performance.now() - tWall0;
  const wallSec = wallMs / 1000;
  const throughput = all.length / Math.max(wallSec, 0.001);

  // Stats
  const allLatencies = all.map((s) => s.latencyMs);
  const summary = summarizeStats(allLatencies);
  const byLabel = new Map<EndpointLabel, Sample[]>();
  for (const s of all) {
    const arr = byLabel.get(s.label) ?? [];
    arr.push(s);
    byLabel.set(s.label, arr);
  }

  const errors = all.filter((s) => !s.ok);
  const errorRate = all.length ? (errors.length / all.length) * 100 : 0;

  // Error breakdown by status
  const errorByStatus = new Map<string, number>();
  for (const e of errors) {
    const key = e.status !== null ? String(e.status) : `ERR:${e.error ?? "unknown"}`;
    errorByStatus.set(key, (errorByStatus.get(key) ?? 0) + 1);
  }

  // Gates
  const gateP50 = summary.p50 < 100;
  const gateP95 = summary.p95 < 250;
  const gateErrors = errors.length === 0;

  console.log("");
  console.log(`  Completed ${all.length} requests in ${wallMs.toFixed(0)}ms  (${throughput.toFixed(1)} req/s)`);
  console.log("");

  // Overall table
  console.log("  Overall latency (ms):");
  console.log(`    count  ${summary.count}`);
  console.log(`    min    ${fmtMs(summary.min)}`);
  console.log(`    avg    ${fmtMs(summary.avg)}`);
  console.log(`    p50    ${fmtMs(summary.p50)}   ${gateP50 ? "✓ < 100ms" : "✗ FAIL ≥ 100ms"}`);
  console.log(`    p95    ${fmtMs(summary.p95)}   ${gateP95 ? "✓ < 250ms" : "✗ FAIL ≥ 250ms"}`);
  console.log(`    p99    ${fmtMs(summary.p99)}`);
  console.log(`    max    ${fmtMs(summary.max)}`);
  console.log(`    errors ${errors.length} (${errorRate.toFixed(2)}%)   ${gateErrors ? "✓ 0 errors" : "✗ FAIL > 0 errors"}`);
  if (errors.length > 0) {
    const breakdown = [...errorByStatus.entries()].map(([k, v]) => `${k}:${v}`).join("  ");
    console.log(`           breakdown: ${breakdown}`);
    // show first few error samples
    const sampleErrs = errors.slice(0, 3);
    for (const e of sampleErrs) {
      console.log(`           e.g. [${e.label}] ${e.url} → ${e.status ?? e.error}`);
    }
  }

  // Per-endpoint breakdown
  console.log("");
  console.log("  Per-endpoint breakdown:");
  console.log(`  ${"endpoint".padEnd(10)} ${"count".padStart(6)} ${"avg".padStart(9)} ${"p50".padStart(9)} ${"p95".padStart(9)} ${"p99".padStart(9)} ${"max".padStart(9)} ${"errors".padStart(7)}`);
  for (const lbl of ["search", "profile", "stats", "list"] as EndpointLabel[]) {
    const arr = byLabel.get(lbl) ?? [];
    if (arr.length === 0) {
      console.log(`  ${lbl.padEnd(10)} ${String(0).padStart(6)} ${"-".padStart(9)} ${"-".padStart(9)} ${"-".padStart(9)} ${"-".padStart(9)} ${"-".padStart(9)} ${String(0).padStart(7)}`);
      continue;
    }
    const lat = arr.map((s) => s.latencyMs);
    const st = summarizeStats(lat);
    const ec = arr.filter((s) => !s.ok).length;
    console.log(
      `  ${lbl.padEnd(10)} ${String(arr.length).padStart(6)} ${fmtMs(st.avg).padStart(9)} ${fmtMs(st.p50).padStart(9)} ${fmtMs(st.p95).padStart(9)} ${fmtMs(st.p99).padStart(9)} ${fmtMs(st.max).padStart(9)} ${String(ec).padStart(7)}`,
    );
  }

  // Cache-hot probe
  console.log("");
  console.log("  Cache-hot probe (same search query twice, second hit < 5ms):");
  const hot = await probeCacheHot(base, timeoutMs);
  console.log(`    first:  ${fmtMs(hot.firstMs)}`);
  console.log(`    second: ${fmtMs(hot.secondMs)}   ${hot.pass ? "✓ < 5ms" : "✗ FAIL ≥ 5ms"}`);
  console.log(`    note:   ${hot.note}`);
  if (!hot.pass) {
    console.log("    hint:   If Redis is not running, LRU-only degraded mode is active —");
    console.log("            start Redis with: npm run db:redis:up  (or docker compose up -d redis)");
  }

  // Dashboard probe
  console.log("");
  console.log("  Dashboard load probe (< 2s):");
  const dash = await probeDashboard(base, timeoutMs);
  console.log(`    url:     ${dash.url}  (status ${dash.status ?? "no response"})`);
  console.log(`    latency: ${fmtMs(dash.latencyMs)}   ${dash.pass ? "✓ < 2s" : "✗ FAIL ≥ 2s"}`);
  console.log(`    note:    ${dash.note}`);

  // Final gate
  const gateHot = hot.pass;
  const gateDash = dash.pass;
  const allPass = gateP50 && gateP95 && gateErrors && gateHot && gateDash;

  console.log("");
  console.log("────────────────────────────────────────────────────────");
  if (allPass) {
    console.log("  Gate: PASS ✓  — all targets met");
  } else {
    console.log("  Gate: FAIL ✗");
    const reasons: string[] = [];
    if (!gateP50) reasons.push(`p50 ${fmtMs(summary.p50)} ≥ 100ms`);
    if (!gateP95) reasons.push(`p95 ${fmtMs(summary.p95)} ≥ 250ms`);
    if (!gateErrors) reasons.push(`${errors.length} error(s) (need 0)`);
    if (!gateHot) reasons.push(`Redis hot ${fmtMs(hot.secondMs)} ≥ 5ms`);
    if (!gateDash) reasons.push(`dashboard ${fmtMs(dash.latencyMs)} ≥ 2s`);
    for (const r of reasons) console.log(`    - ${r}`);
  }
  console.log("────────────────────────────────────────────────────────");

  // Helpful next steps on failure, especially server-related
  if (!allPass) {
    console.log("");
    if (!gateHot || !gateP50 || !gateP95) {
      console.log("  Tips: ensure Redis is running (npm run db:redis:up),");
      console.log("        run a warmup request first, and check Supabase is seeded:");
      console.log("        npx supabase db reset && npm run db:seed && npm run db:refresh:views");
    }
    if (errors.length > 0) {
      console.log("  Errors often mean missing seed data or RLS blocking anon reads.");
      console.log("  Verify migrations 0005–0010 are applied and seed completed without errors.");
    }
  }

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("[load-test] unhandled error:", e);
  // Do not crash with stack dump as gate failure — exit 1 with explanation
  console.error("Gate: FAIL (unhandled exception)");
  process.exit(1);
});

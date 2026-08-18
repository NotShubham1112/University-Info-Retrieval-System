import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServiceClient } from "@/lib/supabase/service";
import { runSearch } from "@/lib/search/run-search";
import { classifyQuery } from "@/lib/search/classifier";

const PROBES = ["22CS0001", "1045", "Rahul Sharma", "Rahul"];
const ITERATIONS = 20;

export interface TimingSummary {
  avg: number;
  min: number;
  max: number;
}

export function summarize(samples: number[]): TimingSummary {
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    avg: Math.round(avg * 100) / 100,
    min: Math.round(Math.min(...samples) * 100) / 100,
    max: Math.round(Math.max(...samples) * 100) / 100,
  };
}

async function time(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

async function main() {
  const svc = createServiceClient();
  console.log(`benchmark: ${PROBES.length} probes, ${ITERATIONS} iterations each`);
  console.log(`${"type".padEnd(8)}${"query".padEnd(14)}${"avg (ms)".padStart(10)}${"min (ms)".padStart(10)}${"max (ms)".padStart(10)}`);
  for (const q of PROBES) {
    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) times.push(await time(() => runSearch(svc, { q })));
    const { avg, min, max } = summarize(times);
    console.log(
      `${classifyQuery(q).type.padEnd(8)}${q.padEnd(14)}${avg.toFixed(2).padStart(10)}${min.toFixed(2).padStart(10)}${max.toFixed(2).padStart(10)}`,
    );
  }
}

const isMain =
  process.argv[1] != null && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

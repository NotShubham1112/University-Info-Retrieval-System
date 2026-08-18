import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svc = createClient(url, key);

  const { count } = await svc.from("students").select("id", { count: "exact", head: true });
  console.log("Total rows in DB:", count);

  const full: string[] = [];
  for (let from = 0; from < count!; from += 1000) {
    const { data } = await svc.from("students").select("first_name,last_name").range(from, from + 999);
    for (const r of data!) full.push(`${r.first_name} ${r.last_name}`);
  }

  const unique = new Set(full);
  console.log("Fetched:", full.length, "Unique:", unique.size, "Duplicates:", full.length - unique.size);
  if (unique.size < full.length) {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const n of full) { if (seen.has(n)) dupes.push(n); else seen.add(n); }
    console.log("Sample dupes:", [...new Set(dupes)].slice(0, 10));
  }
}
main();

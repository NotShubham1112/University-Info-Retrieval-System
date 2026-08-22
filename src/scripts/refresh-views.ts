import { createServiceClient } from "@/lib/supabase/service";

async function main() {
  const svc = createServiceClient();
  console.log("refreshing materialized views via rpc refresh_report_views()...");
  const { error } = await svc.rpc("refresh_report_views");
  if (error) {
    console.error("refresh_report_views failed:", error.message);
    process.exit(1);
  }
  console.log("materialized views refreshed successfully");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

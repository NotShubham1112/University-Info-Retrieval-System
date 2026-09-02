import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svc = createClient(url, key);
  const id = 180;
  console.log("=== student 180 tabs diagnostic ===");
  const t0 = Date.now();
  const { data: sum } = await svc.from("student_summary").select("*").eq("id", id).maybeSingle();
  console.log(`student_summary ${Date.now()-t0}ms`, sum ? `${sum.first_name} ${sum.last_name} pnr=${sum.pnr} course=${sum.course_id} sem=${sum.current_semester}` : "null");

  const tests: Array<[string, () => Promise<any>]> = [
    ["subject_marks", async () => {
      const s = Date.now();
      const { data, error } = await svc.from("subject_marks").select("id,marks,grade,grade_point,subjects!inner(name)").eq("student_id", id).limit(5);
      console.log(`  subject_marks ${Date.now()-s}ms`, error ? `ERROR ${error.message}` : `rows=${data?.length} sample=${data?.[0]?.grade}`);
      return data;
    }],
    ["attendance_records_legacy", async () => {
      const s = Date.now();
      const { data, error } = await svc.from("attendance").select("id,classes_conducted").limit(1);
      console.log(`  attendance legacy ${Date.now()-s}ms`, error ? `ERROR ${error.message}` : `rows probe ok, count sample`);
      return data;
    }],
    ["fee_payments", async () => {
      const s = Date.now();
      const { data, error } = await svc.from("fee_payments").select("id,status,amount_due,fee_category_rates!left(fee_type)").eq("student_id", id).limit(5);
      console.log(`  fee_payments ${Date.now()-s}ms`, error ? `ERROR ${error.message}` : `rows=${data?.length}`);
      return data;
    }],
    ["documents", async () => {
      const s = Date.now();
      const { data, error } = await svc.from("documents").select("id,document_type,file_name").eq("student_id", id).limit(5);
      console.log(`  documents ${Date.now()-s}ms`, error ? `ERROR ${error.message}` : `rows=${data?.length}`);
      return data;
    }],
    ["semester_records", async () => {
      const s = Date.now();
      const { data, error } = await svc.from("semester_records").select("semester_no,sgpa").eq("student_id", id).order("semester_no",{ascending:false}).limit(1);
      console.log(`  semester_records ${Date.now()-s}ms`, error ? `ERROR ${error.message}` : `latest=${data?.[0]?.sgpa}`);
      return data;
    }],
  ];
  for (const [name, fn] of tests) { await fn(); }
  console.log("=== personal/admission static ===");
  console.log(`  DOB=${sum?.date_of_birth} gender=${sum?.gender} blood=${sum?.blood_group} address=${sum?.address?.slice(0,30)}`);
  console.log(`  admission_mode=${sum?.admission_mode} seat=${sum?.seat_type} course=${sum?.course_id}`);
}
main();

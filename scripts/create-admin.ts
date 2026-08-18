import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key);
  const { data, error } = await admin.auth.admin.createUser({
    email: "admin@uni.local",
    password: "demo1234",
    email_confirm: true,
  });
  if (error) { console.log("Error:", error.message); return; }
  console.log("Created auth user:", data.user.id);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: data.user.id, role_id: 1 });
  if (roleErr) console.log("Role error:", roleErr.message);
  else console.log("Assigned admin role");
}
main();

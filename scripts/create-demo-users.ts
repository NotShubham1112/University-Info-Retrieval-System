import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svc = createClient(url, key);
  const users = [
    { email: "admin@uni.local", password: "demo1234", role: "admin" },
    { email: "viewer@uni.local", password: "demo1234", role: "viewer" },
    { email: "teacher@uni.local", password: "demo1234", role: "teacher" },
    { email: "accountant@uni.local", password: "demo1234", role: "accountant" },
    { email: "superadmin@uni.local", password: "demo1234", role: "super_admin" },
  ];
  for (const u of users) {
    const { data: existing } = await svc.auth.admin.listUsers();
    const found = existing.users.find(x => x.email === u.email);
    if (found) {
      console.log(`exists ${u.email} -> update role to ${u.role}`);
      await svc.auth.admin.updateUserById(found.id, { user_metadata: { role: u.role }, app_metadata: { role: u.role } });
      continue;
    }
    const { data, error } = await svc.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { role: u.role },
      app_metadata: { role: u.role },
    });
    if (error) { console.error(`create ${u.email} failed:`, error.message); continue; }
    console.log(`created ${u.email} (${u.role}) id=${data.user.id}`);
  }
  const { data: list } = await svc.auth.admin.listUsers();
  console.log("--- final users ---");
  for (const u of list.users) console.log(u.email, (u.user_metadata as any)?.role, (u.app_metadata as any)?.role);
}
main().catch(e => { console.error(e); process.exit(1); });

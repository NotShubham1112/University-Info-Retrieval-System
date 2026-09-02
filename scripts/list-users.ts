import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const svc = createClient(url, key);
  const { data, error } = await svc.auth.admin.listUsers();
  if (error) { console.error(error); return; }
  console.log(JSON.stringify(data.users.map(u => ({ email: u.email, id: u.id, confirmed: u.email_confirmed_at })), null, 2));
  const { data: roles } = await svc.from("roles").select("id,name");
  console.log("roles:", roles);
  const { data: urs } = await svc.from("user_roles").select("user_id,role_id");
  console.log("user_roles:", urs);
}
main();

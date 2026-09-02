import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const c = createClient(url, anon);
  for (const email of ["admin@uni.local","viewer@uni.local","teacher@uni.local"]) {
    const { data, error } = await c.auth.signInWithPassword({ email, password: "demo1234" });
    console.log(email, error ? `ERROR ${error.message}` : `OK user=${data.user?.id} role=${(data.user?.user_metadata as any)?.role}/${(data.user?.app_metadata as any)?.role} session=${!!data.session}`);
    if (data.session) await c.auth.signOut();
  }
}
main();

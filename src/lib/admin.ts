import { createServerClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, admin: false };
  const { data } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", user.id)
    .eq("roles.name", "admin")
    .maybeSingle();
  return { user, admin: Boolean(data) };
}

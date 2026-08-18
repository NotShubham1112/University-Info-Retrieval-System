import { createServerClient } from "@/lib/supabase/server";
import { ProfileTabs } from "@/components/profile/profile-tabs";
import { notFound } from "next/navigation";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id,pnr,roll_number,first_name,last_name,date_of_birth,email,phone,admission_date,status,program_id,campus_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <ProfileTabs student={data} />
    </main>
  );
}
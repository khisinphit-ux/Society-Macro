import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import BodyFatClient from "./BodyFatClient";

export default async function BodyFatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: bodyFat }, { data: weights }, { data: photos }] =
    await Promise.all([
      supabase.from("profiles").select("sex, birth_date").eq("id", user.id).single(),
      supabase
        .from("body_fat_entries")
        .select("*")
        .eq("client_id", user.id)
        .order("measured_on", { ascending: true })
        .limit(200),
      supabase
        .from("weight_entries")
        .select("*")
        .eq("client_id", user.id)
        .order("measured_on", { ascending: true })
        .limit(200),
      supabase
        .from("progress_photos")
        .select("*")
        .eq("client_id", user.id)
        .order("taken_on", { ascending: false })
        .limit(60),
    ]);

  return (
    <AppShell variant="client">
      <BodyFatClient
        userId={user.id}
        sex={(profile?.sex as "male" | "female") ?? "male"}
        birthDate={profile?.birth_date ?? null}
        bodyFat={bodyFat ?? []}
        weights={weights ?? []}
        photos={photos ?? []}
      />
    </AppShell>
  );
}

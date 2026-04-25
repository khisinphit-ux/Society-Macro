import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import MacrosClient from "./MacrosClient";
import { todayISO } from "@/lib/format";

export default async function MacrosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = todayISO();
  const [{ data: targets }, { data: meals }, { data: weekMeals }] = await Promise.all([
    supabase.from("macro_targets").select("*").eq("client_id", user.id).maybeSingle(),
    supabase
      .from("meal_entries")
      .select("*")
      .eq("client_id", user.id)
      .eq("eaten_on", today)
      .order("created_at", { ascending: true }),
    supabase
      .from("meal_entries")
      .select("eaten_on, kcal, protein_g, carbs_g, fat_g")
      .eq("client_id", user.id)
      .gte("eaten_on", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)),
  ]);

  return (
    <AppShell variant="client">
      <MacrosClient
        targets={targets ?? { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 }}
        todayMeals={meals ?? []}
        weekMeals={weekMeals ?? []}
        userId={user.id}
      />
    </AppShell>
  );
}

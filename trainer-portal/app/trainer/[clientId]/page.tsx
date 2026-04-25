import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TargetsForm from "./TargetsForm";
import { fmtDate, round1 } from "@/lib/format";

export default async function ClientDetail({
  params,
}: {
  params: { clientId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: link } = await supabase
    .from("trainer_clients")
    .select("client_id")
    .eq("trainer_id", user.id)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!link) notFound();

  const [
    { data: client },
    { data: targets },
    { data: meals },
    { data: bodyFat },
    { data: weights },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", params.clientId).single(),
    supabase.from("macro_targets").select("*").eq("client_id", params.clientId).maybeSingle(),
    supabase
      .from("meal_entries")
      .select("eaten_on, kcal, protein_g, carbs_g, fat_g")
      .eq("client_id", params.clientId)
      .gte("eaten_on", new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)),
    supabase
      .from("body_fat_entries")
      .select("measured_on, body_fat_pct")
      .eq("client_id", params.clientId)
      .order("measured_on", { ascending: false })
      .limit(10),
    supabase
      .from("weight_entries")
      .select("measured_on, weight_lb")
      .eq("client_id", params.clientId)
      .order("measured_on", { ascending: false })
      .limit(10),
  ]);

  // Last 7 days macro averages
  const last7 = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const recent = (meals ?? []).filter((m: any) => m.eaten_on >= last7);
  const days = new Set(recent.map((m: any) => m.eaten_on)).size || 1;
  const sum = recent.reduce(
    (acc: any, m: any) => ({
      kcal: acc.kcal + Number(m.kcal),
      protein_g: acc.protein_g + Number(m.protein_g),
      carbs_g: acc.carbs_g + Number(m.carbs_g),
      fat_g: acc.fat_g + Number(m.fat_g),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );

  return (
    <AppShell variant="trainer">
      <Link href="/trainer" className="text-sm text-emerald-700 hover:underline">
        ← All clients
      </Link>
      <h1 className="text-2xl font-semibold mt-1">{client?.full_name || client?.email}</h1>
      <p className="text-sm text-gray-500 mb-6">{client?.email}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold mb-4">Macro targets</h2>
          <TargetsForm clientId={params.clientId} initial={targets} />
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Last 7-day average</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-gray-500">Calories</dt><dd className="text-lg">{round1(sum.kcal / days)}</dd></div>
            <div><dt className="text-gray-500">Protein</dt><dd className="text-lg">{round1(sum.protein_g / days)} g</dd></div>
            <div><dt className="text-gray-500">Carbs</dt><dd className="text-lg">{round1(sum.carbs_g / days)} g</dd></div>
            <div><dt className="text-gray-500">Fat</dt><dd className="text-lg">{round1(sum.fat_g / days)} g</dd></div>
          </dl>
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Recent body fat</h2>
          {bodyFat && bodyFat.length > 0 ? (
            <ul className="divide-y text-sm">
              {bodyFat.map((b: any) => (
                <li key={b.measured_on} className="py-2 flex justify-between">
                  <span>{fmtDate(b.measured_on)}</span>
                  <span className="font-medium">{b.body_fat_pct}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No measurements yet.</p>
          )}
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Recent weight</h2>
          {weights && weights.length > 0 ? (
            <ul className="divide-y text-sm">
              {weights.map((w: any) => (
                <li key={w.measured_on} className="py-2 flex justify-between">
                  <span>{fmtDate(w.measured_on)}</span>
                  <span className="font-medium">{w.weight_lb} lb</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No weigh-ins yet.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

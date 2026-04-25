import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import AddClientForm from "./AddClientForm";

export default async function TrainerHome() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "trainer") redirect("/portal/macros");

  const { data: links } = await supabase
    .from("trainer_clients")
    .select("client:profiles!trainer_clients_client_id_fkey(id, full_name, email)")
    .eq("trainer_id", user.id);

  const clients = (links ?? [])
    .map((l: any) => l.client)
    .filter(Boolean) as { id: string; full_name: string | null; email: string }[];

  return (
    <AppShell variant="trainer">
      <div className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-2 card">
          <h2 className="font-semibold mb-4">Your clients</h2>
          {clients.length === 0 ? (
            <p className="text-sm text-gray-500">No clients yet — add one on the right.</p>
          ) : (
            <ul className="divide-y">
              {clients.map((c) => (
                <li key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.full_name || "(no name)"}</p>
                    <p className="text-sm text-gray-500">{c.email}</p>
                  </div>
                  <Link href={`/trainer/${c.id}`} className="btn-secondary">Open</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="font-semibold mb-4">Add a client</h2>
          <AddClientForm />
        </section>
      </div>
    </AppShell>
  );
}

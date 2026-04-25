import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import JournalClient from "./JournalClient";

export default async function JournalPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("client_id", user.id)
    .order("entry_date", { ascending: false })
    .limit(60);

  return (
    <AppShell variant="client">
      <JournalClient initialEntries={entries ?? []} userId={user.id} />
    </AppShell>
  );
}

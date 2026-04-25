"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { fmtDate, todayISO } from "@/lib/format";

type Entry = { id: string; entry_date: string; body: string };

export default function JournalClient({
  initialEntries,
  userId,
}: {
  initialEntries: Entry[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [date, setDate] = useState(todayISO());
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    await supabase.from("journal_entries").insert({
      client_id: userId,
      entry_date: date,
      body,
    });
    setSaving(false);
    setBody("");
    router.refresh();
  }

  async function remove(id: string) {
    await supabase.from("journal_entries").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <section className="card md:col-span-1">
        <h2 className="font-semibold mb-4">New entry</h2>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[10rem]"
              placeholder="How did you feel today? What did you eat? Any cravings, energy levels…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <button className="btn-primary w-full" disabled={saving || !body.trim()}>
            {saving ? "Saving…" : "Save entry"}
          </button>
        </form>
      </section>

      <section className="card md:col-span-2">
        <h2 className="font-semibold mb-4">History</h2>
        {initialEntries.length === 0 ? (
          <p className="text-sm text-gray-500">No journal entries yet.</p>
        ) : (
          <ul className="space-y-4">
            {initialEntries.map((e) => (
              <li key={e.id} className="border-l-2 border-emerald-500 pl-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{fmtDate(e.entry_date)}</p>
                  <button onClick={() => remove(e.id)} className="btn-ghost text-xs">Delete</button>
                </div>
                <p className="text-sm whitespace-pre-wrap mt-1">{e.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

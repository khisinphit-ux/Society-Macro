"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Targets = {
  client_id?: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export default function TargetsForm({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Targets | null;
}) {
  const supabase = createClient();
  const [targets, setTargets] = useState<Targets>(
    initial ?? { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 },
  );
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from("macro_targets")
      .upsert({ client_id: clientId, ...targets, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return setErr(error.message);
    setSavedAt(new Date().toLocaleTimeString());
  }

  function field(key: keyof Targets, label: string, suffix = "") {
    return (
      <div>
        <label className="label">{label}</label>
        <div className="relative">
          <input
            className="input pr-10"
            type="number"
            min={0}
            value={targets[key] as number}
            onChange={(e) => setTargets({ ...targets, [key]: Number(e.target.value) })}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {field("kcal", "Calories", "kcal")}
        {field("protein_g", "Protein", "g")}
        {field("carbs_g", "Carbs", "g")}
        {field("fat_g", "Fat", "g")}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save targets"}
        </button>
        {savedAt && <span className="text-sm text-gray-500">Saved {savedAt}</span>}
      </div>
    </form>
  );
}

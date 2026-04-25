"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { round1, todayISO } from "@/lib/format";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

type Targets = { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
type Meal = {
  id: string;
  meal: string;
  custom_name: string | null;
  servings: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes: string | null;
};
type Food = {
  id: string;
  name: string;
  serving_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export default function MacrosClient({
  targets,
  todayMeals,
  weekMeals,
  userId,
}: {
  targets: Targets;
  todayMeals: Meal[];
  weekMeals: { eaten_on: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const totals = useMemo(
    () =>
      todayMeals.reduce(
        (a, m) => ({
          kcal: a.kcal + Number(m.kcal),
          protein_g: a.protein_g + Number(m.protein_g),
          carbs_g: a.carbs_g + Number(m.carbs_g),
          fat_g: a.fat_g + Number(m.fat_g),
        }),
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      ),
    [todayMeals],
  );

  // 7-day chart
  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay[d] = 0;
    }
    weekMeals.forEach((m) => {
      if (byDay[m.eaten_on] !== undefined) byDay[m.eaten_on] += Number(m.kcal);
    });
    return Object.entries(byDay).map(([d, kcal]) => ({
      day: d.slice(5),
      kcal: Math.round(kcal),
    }));
  }, [weekMeals]);

  // ----- Add food state -----
  const [meal, setMeal] = useState<"breakfast" | "lunch" | "dinner" | "snack">("breakfast");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [picked, setPicked] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);
  const [adding, setAdding] = useState(false);

  // Manual fallback
  const [manualName, setManualName] = useState("");
  const [manualKcal, setManualKcal] = useState(0);
  const [manualProtein, setManualProtein] = useState(0);
  const [manualCarbs, setManualCarbs] = useState(0);
  const [manualFat, setManualFat] = useState(0);

  async function search(q: string) {
    setQuery(q);
    if (q.length < 2) return setResults([]);
    const { data } = await supabase
      .from("foods")
      .select("*")
      .ilike("name", `%${q}%`)
      .limit(10);
    setResults(data ?? []);
  }

  async function addFromFood() {
    if (!picked) return;
    setAdding(true);
    await supabase.from("meal_entries").insert({
      client_id: userId,
      eaten_on: todayISO(),
      meal,
      food_id: picked.id,
      custom_name: picked.name,
      servings,
      kcal: round1(picked.kcal * servings),
      protein_g: round1(picked.protein_g * servings),
      carbs_g: round1(picked.carbs_g * servings),
      fat_g: round1(picked.fat_g * servings),
    });
    setAdding(false);
    setPicked(null);
    setQuery("");
    setResults([]);
    setServings(1);
    router.refresh();
  }

  async function addManual() {
    if (!manualName) return;
    setAdding(true);
    await supabase.from("meal_entries").insert({
      client_id: userId,
      eaten_on: todayISO(),
      meal,
      custom_name: manualName,
      servings: 1,
      kcal: manualKcal,
      protein_g: manualProtein,
      carbs_g: manualCarbs,
      fat_g: manualFat,
    });
    setAdding(false);
    setManualName(""); setManualKcal(0); setManualProtein(0); setManualCarbs(0); setManualFat(0);
    router.refresh();
  }

  async function deleteMeal(id: string) {
    await supabase.from("meal_entries").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Targets bars */}
      <section className="card">
        <h2 className="font-semibold mb-4">Today</h2>
        <div className="grid sm:grid-cols-4 gap-4">
          <ProgressBar label="Calories" value={totals.kcal} target={targets.kcal} suffix="kcal" />
          <ProgressBar label="Protein"  value={totals.protein_g} target={targets.protein_g} suffix="g" />
          <ProgressBar label="Carbs"    value={totals.carbs_g}   target={targets.carbs_g}   suffix="g" />
          <ProgressBar label="Fat"      value={totals.fat_g}     target={targets.fat_g}     suffix="g" />
        </div>
      </section>

      {/* Today's log */}
      <section className="card">
        <h2 className="font-semibold mb-4">Today's log</h2>
        {todayMeals.length === 0 ? (
          <p className="text-sm text-gray-500">Nothing logged yet — add something below.</p>
        ) : (
          <ul className="divide-y">
            {todayMeals.map((m) => (
              <li key={m.id} className="py-2 flex items-center gap-3">
                <span className="text-xs uppercase text-gray-500 w-20">{m.meal}</span>
                <span className="flex-1">{m.custom_name} {m.servings !== 1 && `× ${m.servings}`}</span>
                <span className="text-sm text-gray-600">{round1(m.kcal)} kcal · {round1(m.protein_g)}P/{round1(m.carbs_g)}C/{round1(m.fat_g)}F</span>
                <button onClick={() => deleteMeal(m.id)} className="btn-ghost text-xs">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add food */}
      <section className="card">
        <h2 className="font-semibold mb-4">Add food</h2>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="label">Meal</label>
            <select className="input" value={meal} onChange={(e) => setMeal(e.target.value as any)}>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
          <div className="flex-1 min-w-[16rem]">
            <label className="label">Search food database</label>
            <input className="input" placeholder="e.g. chicken breast" value={query} onChange={(e) => search(e.target.value)} />
            {results.length > 0 && (
              <ul className="mt-1 border rounded-md bg-white shadow-sm max-h-56 overflow-auto">
                {results.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => { setPicked(f); setResults([]); setQuery(f.name); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between"
                    >
                      <span>{f.name}</span>
                      <span className="text-gray-500">{f.kcal} kcal / {f.serving_g}g</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {picked && (
            <>
              <div className="w-28">
                <label className="label">Servings</label>
                <input className="input" type="number" step="0.25" min="0" value={servings} onChange={(e) => setServings(Number(e.target.value))} />
              </div>
              <button className="btn-primary" disabled={adding} onClick={addFromFood}>
                Add {picked.name}
              </button>
            </>
          )}
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">Or enter manually</summary>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <input className="input col-span-2 sm:col-span-1" placeholder="Name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
            <input className="input" type="number" placeholder="kcal" value={manualKcal || ""} onChange={(e) => setManualKcal(Number(e.target.value))} />
            <input className="input" type="number" placeholder="P (g)" value={manualProtein || ""} onChange={(e) => setManualProtein(Number(e.target.value))} />
            <input className="input" type="number" placeholder="C (g)" value={manualCarbs || ""} onChange={(e) => setManualCarbs(Number(e.target.value))} />
            <input className="input" type="number" placeholder="F (g)" value={manualFat || ""} onChange={(e) => setManualFat(Number(e.target.value))} />
            <button className="btn-secondary col-span-2 sm:col-auto" disabled={adding} onClick={addManual}>Add</button>
          </div>
        </details>
      </section>

      {/* 7 day chart */}
      <section className="card">
        <h2 className="font-semibold mb-4">Last 7 days — calories</h2>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="kcal" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function ProgressBar({
  label, value, target, suffix,
}: { label: string; value: number; target: number; suffix: string }) {
  const pct = Math.min(100, target > 0 ? (value / target) * 100 : 0);
  const over = value > target;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={over ? "text-red-600 font-medium" : "font-medium"}>
          {round1(value)} / {target} {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={over ? "h-full bg-red-500" : "h-full bg-emerald-500"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

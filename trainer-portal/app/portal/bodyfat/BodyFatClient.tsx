"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { ageFromBirthDate, jacksonPollock3Site } from "@/lib/bodyfat";
import { fmtDate, todayISO } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type BFEntry = { id: string; measured_on: string; body_fat_pct: number; method: string | null };
type WEntry = { id: string; measured_on: string; weight_lb: number };
type Photo = { id: string; taken_on: string; storage_path: string };

export default function BodyFatClient({
  userId, sex, birthDate, bodyFat, weights, photos,
}: {
  userId: string;
  sex: "male" | "female";
  birthDate: string | null;
  bodyFat: BFEntry[];
  weights: WEntry[];
  photos: Photo[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const ageYears = ageFromBirthDate(birthDate);

  // Combined chart data — bf% + weight by date
  const chartData = useMemo(() => {
    const byDay: Record<string, { day: string; bf?: number; weight?: number }> = {};
    bodyFat.forEach((e) => {
      byDay[e.measured_on] ??= { day: e.measured_on };
      byDay[e.measured_on].bf = Number(e.body_fat_pct);
    });
    weights.forEach((w) => {
      byDay[w.measured_on] ??= { day: w.measured_on };
      byDay[w.measured_on].weight = Number(w.weight_lb);
    });
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
  }, [bodyFat, weights]);

  // -- BF % manual ---
  const [bfDate, setBfDate] = useState(todayISO());
  const [bfPct, setBfPct] = useState<number | "">("");
  const [bfNotes, setBfNotes] = useState("");

  async function addBF(e: React.FormEvent) {
    e.preventDefault();
    if (bfPct === "") return;
    await supabase.from("body_fat_entries").insert({
      client_id: userId,
      measured_on: bfDate,
      body_fat_pct: Number(bfPct),
      method: "manual",
      notes: bfNotes || null,
    });
    setBfPct(""); setBfNotes("");
    router.refresh();
  }

  // -- Skinfold ---
  const [sfDate, setSfDate] = useState(todayISO());
  const [s1, setS1] = useState<number | "">("");
  const [s2, setS2] = useState<number | "">("");
  const [s3, setS3] = useState<number | "">("");

  const computed = useMemo(() => {
    if (s1 === "" || s2 === "" || s3 === "") return null;
    return jacksonPollock3Site({
      sex, ageYears,
      s1_mm: Number(s1), s2_mm: Number(s2), s3_mm: Number(s3),
    });
  }, [s1, s2, s3, sex, ageYears]);

  const [s1Label, s2Label, s3Label] =
    sex === "male"
      ? ["Chest (mm)", "Abdomen (mm)", "Thigh (mm)"]
      : ["Tricep (mm)", "Suprailiac (mm)", "Thigh (mm)"];

  async function addSkinfold(e: React.FormEvent) {
    e.preventDefault();
    if (computed == null) return;
    const sites =
      sex === "male"
        ? { chest_mm: Number(s1), abdomen_mm: Number(s2), thigh_mm: Number(s3) }
        : { tricep_mm: Number(s1), suprailiac_mm: Number(s2), thigh_mm: Number(s3) };
    await supabase.from("skinfold_entries").insert({
      client_id: userId,
      measured_on: sfDate,
      computed_pct: computed,
      ...sites,
    });
    await supabase.from("body_fat_entries").insert({
      client_id: userId,
      measured_on: sfDate,
      body_fat_pct: computed,
      method: "skinfold",
    });
    setS1(""); setS2(""); setS3("");
    router.refresh();
  }

  // -- Weight log ---
  const [wDate, setWDate] = useState(todayISO());
  const [wLb, setWLb] = useState<number | "">("");

  async function addWeight(e: React.FormEvent) {
    e.preventDefault();
    if (wLb === "") return;
    await supabase.from("weight_entries").insert({
      client_id: userId,
      measured_on: wDate,
      weight_lb: Number(wLb),
    });
    setWLb("");
    router.refresh();
  }

  // -- Photos ---
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const p of photos) {
        const { data } = await supabase.storage
          .from("progress-photos")
          .createSignedUrl(p.storage_path, 60 * 60); // 1 hour
        if (data?.signedUrl) map[p.id] = data.signedUrl;
      }
      if (!cancelled) setPhotoUrls(map);
    })();
    return () => { cancelled = true; };
  }, [photos, supabase]);

  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("progress-photos")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      alert(upErr.message);
      return;
    }
    await supabase.from("progress_photos").insert({
      client_id: userId,
      taken_on: todayISO(),
      storage_path: path,
    });
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-semibold mb-4">Body fat % & weight over time</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-500">Add a measurement below to start tracking.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="bf" orientation="left" label={{ value: "BF %", angle: -90, position: "insideLeft" }} />
                <YAxis yAxisId="w" orientation="right" label={{ value: "lb", angle: 90, position: "insideRight" }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="bf" type="monotone" dataKey="bf" name="Body fat %" stroke="#10b981" connectNulls />
                <Line yAxisId="w" type="monotone" dataKey="weight" name="Weight (lb)" stroke="#6366f1" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card">
          <h2 className="font-semibold mb-4">Log body fat % (manual)</h2>
          <form onSubmit={addBF} className="grid grid-cols-2 gap-3">
            <div className="col-span-1">
              <label className="label">Date</label>
              <input className="input" type="date" value={bfDate} onChange={(e) => setBfDate(e.target.value)} />
            </div>
            <div className="col-span-1">
              <label className="label">Body fat %</label>
              <input className="input" type="number" step="0.1" value={bfPct} onChange={(e) => setBfPct(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <input className="input" value={bfNotes} onChange={(e) => setBfNotes(e.target.value)} />
            </div>
            <button className="btn-primary col-span-2">Save</button>
          </form>
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Skinfold calculator (3-site Jackson-Pollock, {sex})</h2>
          <form onSubmit={addSkinfold} className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="label">Date</label>
              <input className="input" type="date" value={sfDate} onChange={(e) => setSfDate(e.target.value)} />
            </div>
            <div>
              <label className="label">{s1Label}</label>
              <input className="input" type="number" step="0.5" value={s1} onChange={(e) => setS1(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <label className="label">{s2Label}</label>
              <input className="input" type="number" step="0.5" value={s2} onChange={(e) => setS2(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div>
              <label className="label">{s3Label}</label>
              <input className="input" type="number" step="0.5" value={s3} onChange={(e) => setS3(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="col-span-3 text-sm">
              {computed != null ? (
                <p>Calculated: <span className="font-semibold text-emerald-700">{computed}%</span> body fat (age {ageYears})</p>
              ) : (
                <p className="text-gray-500">Enter all three sites to compute.</p>
              )}
            </div>
            <button className="btn-primary col-span-3" disabled={computed == null}>Save</button>
          </form>
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Log weight</h2>
          <form onSubmit={addWeight} className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={wDate} onChange={(e) => setWDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Weight (lb)</label>
              <input className="input" type="number" step="0.1" value={wLb} onChange={(e) => setWLb(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <button className="btn-primary col-span-2">Save</button>
          </form>
        </section>

        <section className="card">
          <h2 className="font-semibold mb-4">Progress photos</h2>
          <label className={`btn-secondary cursor-pointer ${uploading ? "opacity-50" : ""}`}>
            {uploading ? "Uploading…" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
                e.target.value = "";
              }}
            />
          </label>
          {photos.length === 0 ? (
            <p className="text-sm text-gray-500 mt-3">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  {photoUrls[p.id] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrls[p.id]}
                      alt={p.taken_on}
                      className="w-full aspect-square object-cover rounded-md border"
                    />
                  )}
                  <span className="absolute bottom-1 left-1 right-1 bg-black/60 text-white text-xs px-1 rounded">
                    {fmtDate(p.taken_on)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

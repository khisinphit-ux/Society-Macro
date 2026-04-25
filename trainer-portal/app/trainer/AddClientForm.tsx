"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddClientForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [birthDate, setBirthDate] = useState("");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setTempPassword(null);
    setLoading(true);
    const res = await fetch("/api/invite-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, sex, birthDate: birthDate || null }),
    });
    setLoading(false);
    const json = await res.json();
    if (!res.ok) return setErr(json.error || "Failed");
    setTempPassword(json.tempPassword);
    setFullName("");
    setEmail("");
    setBirthDate("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="label">Full name</label>
        <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Sex (for body fat formula)</label>
          <select className="input" value={sex} onChange={(e) => setSex(e.target.value as any)}>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="label">Birth date</label>
          <input className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Adding…" : "Add client"}
      </button>

      {tempPassword && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm">
          <p className="font-medium text-emerald-800">Client created.</p>
          <p>Share these credentials privately:</p>
          <p className="mt-1 font-mono text-xs bg-white p-2 rounded border">
            password: {tempPassword}
          </p>
          <p className="mt-1 text-emerald-700">They can change it after first login.</p>
        </div>
      )}
    </form>
  );
}

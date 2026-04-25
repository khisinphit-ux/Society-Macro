import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function randomPassword(): string {
  // 16 char random password — letters, digits, a couple symbols.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "trainer") {
    return NextResponse.json({ error: "Only trainers can add clients" }, { status: 403 });
  }

  const { fullName, email, sex, birthDate } = await req.json();
  if (!email || !fullName) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const tempPassword = randomPassword();

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  if (createErr || !created.user) {
    return NextResponse.json(
      { error: createErr?.message || "Could not create user" },
      { status: 400 },
    );
  }

  const newId = created.user.id;

  // Update the auto-created profile with extra info.
  await admin
    .from("profiles")
    .update({ full_name: fullName, role: "client", sex, birth_date: birthDate })
    .eq("id", newId);

  // Link to current trainer.
  await admin
    .from("trainer_clients")
    .insert({ trainer_id: user.id, client_id: newId });

  // Default macro targets — trainer can edit.
  await admin
    .from("macro_targets")
    .upsert({ client_id: newId, kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 });

  return NextResponse.json({ ok: true, tempPassword });
}

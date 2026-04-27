// 9-site skinfold body fat formula (matches user's existing trainer template).
// BF% = ((27 * sum_of_skinfolds_mm) / body_weight_lb) + (age * 0.15) - (height * 0.01)
// Sites: chest, biceps, triceps, back, abs, hip, quad, calf, lower back.

export function ageFromBirthDate(birthDateISO: string | null | undefined): number {
  if (!birthDateISO) return 30;
  const b = new Date(birthDateISO);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export const NINE_SITES = [
  { key: "chest",     label: "Chest" },
  { key: "biceps",    label: "Biceps" },
  { key: "triceps",   label: "Triceps" },
  { key: "back",      label: "Back" },
  { key: "abs",       label: "Abs" },
  { key: "hip",       label: "Hip" },
  { key: "quad",      label: "Quad" },
  { key: "calf",      label: "Calf" },
  { key: "lowerBack", label: "Lower Back" },
] as const;

export type SiteKey = typeof NINE_SITES[number]["key"];

export function nineSiteBodyFat(args: {
  sites: Partial<Record<SiteKey, number>>;
  weightLb: number;
  ageYears: number;
  heightIn: number;
}): number | null {
  const values = NINE_SITES.map(s => args.sites[s.key]);
  if (values.some(v => v == null || isNaN(v as number))) return null;
  if (!args.weightLb || args.weightLb <= 0) return null;
  const sum = values.reduce<number>((a, b) => a + (b as number), 0);
  const pct = ((27 * sum) / args.weightLb) + (args.ageYears * 0.15) - (args.heightIn * 0.01);
  return Math.round(pct * 10) / 10;
}

export function bodyFatCategory(pct: number, sex: "male" | "female"): string {
  if (sex === "female") {
    if (pct < 14) return "Essential (10–13%)";
    if (pct < 21) return "Athlete (14–20%)";
    if (pct < 25) return "Fitness (21–24%)";
    if (pct < 32) return "Average (25–31%)";
    return "Obese (32%+)";
  }
  if (pct < 6) return "Essential (2–5%)";
  if (pct < 14) return "Athlete (6–13%)";
  if (pct < 18) return "Fitness (14–17%)";
  if (pct < 25) return "Average (18–24%)";
  return "Obese (25%+)";
}

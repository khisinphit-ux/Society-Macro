// Jackson-Pollock 3-site body fat % formula.
// Men:   chest + abdomen + thigh
// Women: tricep + suprailiac + thigh

export function ageFromBirthDate(birthDateISO: string | null | undefined): number {
  if (!birthDateISO) return 30; // sensible default
  const b = new Date(birthDateISO);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function jacksonPollock3Site(args: {
  sex: "male" | "female";
  ageYears: number;
  // for male: chest, abdomen, thigh
  // for female: tricep, suprailiac, thigh
  s1_mm: number;
  s2_mm: number;
  s3_mm: number;
}): number {
  const { sex, ageYears, s1_mm, s2_mm, s3_mm } = args;
  const sum = s1_mm + s2_mm + s3_mm;
  let bodyDensity: number;
  if (sex === "male") {
    bodyDensity =
      1.10938 -
      0.0008267 * sum +
      0.0000016 * sum * sum -
      0.0002574 * ageYears;
  } else {
    bodyDensity =
      1.0994921 -
      0.0009929 * sum +
      0.0000023 * sum * sum -
      0.0001392 * ageYears;
  }
  // Siri equation
  const pct = (495 / bodyDensity - 450);
  return Math.round(pct * 10) / 10;
}

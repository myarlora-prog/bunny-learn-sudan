export type Level = { name: string; min: number; next: number | null };

const LEVELS: { name: string; min: number }[] = [
  { name: "مبتدئ", min: 0 },
  { name: "متعلم", min: 500 },
  { name: "متقدم", min: 1500 },
  { name: "خبير", min: 3500 },
  { name: "محترف", min: 7000 },
  { name: "بطل Saqro", min: 12000 },
];

export function levelFor(points: number): Level {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i]!.min) idx = i;
  const current = LEVELS[idx]!;
  const next = LEVELS[idx + 1]?.min ?? null;
  return { name: current.name, min: current.min, next };
}

/** Progress (0-100) toward the next level. */
export function levelProgress(points: number): number {
  const { min, next } = levelFor(points);
  if (next === null) return 100;
  return Math.min(100, Math.round(((points - min) / (next - min)) * 100));
}

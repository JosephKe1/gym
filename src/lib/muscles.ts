// Maps the catalog's fine-grained muscle names into the display groups
// used across the app (target-muscle summary, picker filter, icons).

export const MUSCLE_GROUPS = [
  'Chest',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Back',
  'Abs',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
  'Neck',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

const RAW_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'Chest',
  shoulders: 'Shoulders',
  traps: 'Back',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abdominals: 'Abs',
  glutes: 'Glutes',
  abductors: 'Glutes',
  adductors: 'Quads',
  quadriceps: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  neck: 'Neck',
}

export function toGroup(rawMuscle: string): MuscleGroup | null {
  return RAW_TO_GROUP[rawMuscle] ?? null
}

/** Representative catalog muscle name per group — used when storing custom exercises. */
export const GROUP_TO_RAW: Record<MuscleGroup, string> = {
  Chest: 'chest',
  Shoulders: 'shoulders',
  Biceps: 'biceps',
  Triceps: 'triceps',
  Forearms: 'forearms',
  Back: 'lats',
  Abs: 'abdominals',
  Glutes: 'glutes',
  Quads: 'quadriceps',
  Hamstrings: 'hamstrings',
  Calves: 'calves',
  Neck: 'neck',
}

export function groupsOf(primary: string[], secondary: string[] = []): MuscleGroup[] {
  const out: MuscleGroup[] = []
  for (const m of [...primary, ...secondary]) {
    const g = toGroup(m)
    if (g && !out.includes(g)) out.push(g)
  }
  return out
}

/** Short two-letter badge + tint used when an exercise image is unavailable. */
export const GROUP_BADGE: Record<MuscleGroup, { label: string; classes: string }> = {
  Chest: { label: 'CH', classes: 'bg-rose-100 text-rose-600' },
  Shoulders: { label: 'SH', classes: 'bg-amber-100 text-amber-600' },
  Biceps: { label: 'BI', classes: 'bg-sky-100 text-sky-600' },
  Triceps: { label: 'TR', classes: 'bg-indigo-100 text-indigo-600' },
  Forearms: { label: 'FA', classes: 'bg-teal-100 text-teal-600' },
  Back: { label: 'BK', classes: 'bg-blue-100 text-blue-600' },
  Abs: { label: 'AB', classes: 'bg-lime-100 text-lime-600' },
  Glutes: { label: 'GL', classes: 'bg-fuchsia-100 text-fuchsia-600' },
  Quads: { label: 'QD', classes: 'bg-orange-100 text-orange-600' },
  Hamstrings: { label: 'HS', classes: 'bg-violet-100 text-violet-600' },
  Calves: { label: 'CA', classes: 'bg-emerald-100 text-emerald-600' },
  Neck: { label: 'NK', classes: 'bg-slate-200 text-slate-600' },
}

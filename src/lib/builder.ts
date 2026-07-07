import type { Plan, PlanExercise, Workout } from '../types'
import { getExercise } from '../data/catalog'
import { matchesEquipment } from '../data/equipment'
import { groupsOf, type MuscleGroup } from './muscles'
import { uid } from './store'

// ---------------- wizard answers ----------------

export type Goal = 'build' | 'lose' | 'maintain'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type Focus = 'balanced' | 'upper' | 'lower'
export type StylePref = 'any' | 'full' | 'split'
export type Gender = 'male' | 'female' | 'na'

export interface BuilderAnswers {
  gender: Gender
  bodyFat: number // midpoint of chosen band
  goal: Goal
  level: Level
  availableDays: number[] // Mon-first weekday indexes
  daysPerWeek: number
  focus: Focus
  stylePref: StylePref
  priorityMuscle: MuscleGroup | null
  equipment: string[] // fine-grained keys ([] = everything available)
}

export const GOAL_LABEL: Record<Goal, string> = { build: 'Build Muscle', lose: 'Lose Fat', maintain: 'Maintain' }
export const LEVEL_LABEL: Record<Level, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' }

/** BWS-style goal recommendation from body fat (thresholds: ~20% male / ~30% female). */
export function recommendGoal(gender: Gender, bodyFat: number, statedPriority: Goal): { goal: Goal; reason: string } {
  const threshold = gender === 'female' ? 30 : 20
  if (statedPriority === 'maintain') {
    return { goal: 'maintain', reason: 'You said maintaining your current shape matters most right now, so we recommend a maintenance-focused plan.' }
  }
  if (bodyFat > threshold) {
    return {
      goal: 'lose',
      reason: `Since your body fat is on the higher side, you'll get the best results getting below ~${threshold}% before committing to a dedicated muscle-building ("lean bulk") phase. You'll very likely still build some muscle as you lean down.`,
    }
  }
  return {
    goal: 'build',
    reason: `At your body fat level you're in a great position to focus on building muscle. If you bulk for 3–6 months, consider a short fat-loss phase afterward so body fat doesn't creep too high.`,
  }
}

// ---------------- exercise candidate pools ----------------
// Ordered by preference; the first candidate the user's equipment allows wins.

const POOLS: Record<string, string[]> = {
  chest_compound: ['Barbell_Bench_Press_-_Medium_Grip', 'Dumbbell_Bench_Press', 'Leverage_Chest_Press', 'Machine_Bench_Press', 'Bench_Press_-_With_Bands', 'Pushups'],
  chest_incline: ['Incline_Dumbbell_Press', 'Barbell_Incline_Bench_Press_-_Medium_Grip', 'Leverage_Incline_Chest_Press', 'Incline_Push-Up'],
  chest_iso: ['Flat_Bench_Cable_Flyes', 'Dumbbell_Flyes', 'Butterfly', 'Incline_Dumbbell_Flyes'],
  back_vertical: ['Pullups', 'Full_Range-Of-Motion_Lat_Pulldown', 'Chin-Up', 'Wide-Grip_Lat_Pulldown', 'Band_Assisted_Pull-Up'],
  back_horizontal: ['Bent_Over_Barbell_Row', 'Seated_Cable_Rows', 'Bent_Over_Two-Dumbbell_Row', 'Leverage_High_Row', 'One-Arm_Dumbbell_Row', 'Inverted_Row'],
  rear_delt: ['Face_Pull', 'Cable_Rear_Delt_Fly', 'Seated_Bent-Over_Rear_Delt_Raise', 'Reverse_Flyes'],
  side_delt: ['Side_Lateral_Raise', 'Cable_Seated_Lateral_Raise', 'Seated_Side_Lateral_Raise', 'Lateral_Raise_-_With_Bands'],
  shoulder_press: ['Barbell_Shoulder_Press', 'Dumbbell_Shoulder_Press', 'Leverage_Shoulder_Press', 'Shoulder_Press_-_With_Bands', 'Handstand_Push-Ups'],
  biceps: ['Barbell_Curl', 'Dumbbell_Bicep_Curl', 'Cable_Preacher_Curl', 'Concentration_Curls'],
  biceps2: ['Alternate_Hammer_Curl', 'Cable_Hammer_Curls_-_Rope_Attachment', 'Preacher_Hammer_Dumbbell_Curl'],
  triceps: ['Triceps_Pushdown_-_Rope_Attachment', 'Lying_Triceps_Press', 'Dips_-_Triceps_Version', 'Bench_Dips'],
  triceps2: ['Cable_Rope_Overhead_Triceps_Extension', 'Standing_Dumbbell_Triceps_Extension', 'Dumbbell_One-Arm_Triceps_Extension'],
  quad_compound: ['Barbell_Squat', 'Leg_Press', 'Goblet_Squat', 'Dumbbell_Squat', 'Front_Barbell_Squat', 'Bodyweight_Squat'],
  quad_secondary: ['Leg_Press', 'Hack_Squat', 'Leg_Extensions', 'Smith_Machine_Squat', 'Bodyweight_Squat'],
  lunge: ['Dumbbell_Lunges', 'Barbell_Lunge', 'Split_Squat_with_Dumbbells', 'Dumbbell_Rear_Lunge', 'Bodyweight_Walking_Lunge'],
  hinge: ['Romanian_Deadlift', 'Stiff-Legged_Dumbbell_Deadlift', 'Barbell_Deadlift', 'Good_Morning'],
  ham_iso: ['Lying_Leg_Curls', 'Seated_Leg_Curl', 'Ball_Leg_Curl', 'Standing_Leg_Curl', 'Glute_Ham_Raise'],
  glute: ['Barbell_Hip_Thrust', 'Barbell_Glute_Bridge', 'Butt_Lift_Bridge', 'Glute_Kickback'],
  glute2: ['Glute_Kickback', 'One-Legged_Cable_Kickback', 'Flutter_Kicks'],
  calves: ['Standing_Calf_Raises', 'Calf_Press_On_The_Leg_Press_Machine', 'Standing_Dumbbell_Calf_Raise', 'Barbell_Seated_Calf_Raise', 'Calf_Raise_On_A_Dumbbell'],
  abs: ['Cable_Crunch', 'Hanging_Leg_Raise', 'Ab_Crunch_Machine', 'Crunches', 'Plank'],
  traps: ['Barbell_Shrug', 'Dumbbell_Shrug', 'Cable_Shrugs'],
}

type SlotSpec = { pool: string; sets: number; repsMin: number; repsMax: number; perSide?: boolean }

const s = (pool: string, sets: number, repsMin: number, repsMax: number, perSide = false): SlotSpec => ({ pool, sets, repsMin, repsMax, perSide })

// ---------------- day templates ----------------

const DAY_TEMPLATES: Record<string, { name: string; slots: SlotSpec[] }> = {
  full: {
    name: 'Full Body',
    slots: [s('quad_compound', 3, 6, 10), s('chest_compound', 3, 6, 10), s('back_horizontal', 3, 8, 12), s('shoulder_press', 2, 8, 12), s('hinge', 2, 8, 12), s('abs', 2, 10, 15)],
  },
  upper: {
    name: 'Upper',
    slots: [s('chest_compound', 3, 6, 10), s('back_horizontal', 3, 6, 10), s('shoulder_press', 2, 8, 12), s('back_vertical', 2, 8, 12), s('side_delt', 2, 10, 15), s('triceps', 2, 10, 15), s('biceps', 2, 10, 15)],
  },
  lower: {
    name: 'Lower',
    slots: [s('quad_compound', 3, 6, 10), s('hinge', 3, 6, 10), s('lunge', 2, 8, 12, true), s('ham_iso', 3, 10, 15), s('calves', 3, 10, 15), s('abs', 2, 10, 15)],
  },
  lower_quad: {
    name: 'Lower 1 (Quad Focused)',
    slots: [s('quad_compound', 3, 6, 10), s('quad_secondary', 3, 8, 12), s('lunge', 2, 8, 12, true), s('quad_secondary', 3, 10, 15), s('calves', 3, 10, 15), s('abs', 2, 10, 15)],
  },
  lower_glute: {
    name: 'Lower 2 (Glute Focused)',
    slots: [s('glute', 3, 8, 12), s('hinge', 3, 6, 10), s('lunge', 2, 8, 12, true), s('ham_iso', 3, 10, 15), s('glute2', 2, 10, 15, true), s('calves', 3, 10, 15)],
  },
  push: {
    name: 'Push',
    slots: [s('chest_compound', 3, 6, 10), s('shoulder_press', 3, 8, 12), s('chest_incline', 3, 8, 12), s('side_delt', 3, 10, 15), s('triceps', 2, 10, 15), s('triceps2', 2, 10, 15)],
  },
  pull: {
    name: 'Pull',
    slots: [s('back_vertical', 3, 6, 10), s('back_horizontal', 3, 8, 12), s('rear_delt', 3, 10, 15), s('biceps', 2, 8, 12), s('biceps2', 2, 8, 12), s('traps', 2, 10, 15)],
  },
  chest: { name: 'Chest', slots: [s('chest_compound', 4, 6, 10), s('chest_incline', 3, 8, 12), s('chest_iso', 3, 10, 15), s('triceps', 3, 10, 15), s('abs', 2, 10, 15)] },
  back: { name: 'Back', slots: [s('back_vertical', 4, 6, 10), s('back_horizontal', 3, 8, 12), s('rear_delt', 3, 10, 15), s('traps', 3, 10, 15), s('biceps2', 2, 8, 12)] },
  shoulders: { name: 'Shoulders', slots: [s('shoulder_press', 4, 6, 10), s('side_delt', 3, 10, 15), s('rear_delt', 3, 10, 15), s('traps', 3, 10, 15), s('abs', 2, 10, 15)] },
  arms: { name: 'Arms', slots: [s('biceps', 3, 8, 12), s('triceps', 3, 8, 12), s('biceps2', 3, 10, 15), s('triceps2', 3, 10, 15), s('abs', 2, 10, 15)] },
}

// ---------------- split library ----------------

export interface SplitOption {
  id: string
  name: string
  description: string
  /** DAY_TEMPLATES keys in order, one per training day. */
  days: string[]
}

const SPLITS: Record<number, SplitOption[]> = {
  2: [
    { id: 'fb2', name: '2-Day Full Body', description: 'Two balanced full-body sessions per week.', days: ['full', 'full'] },
    { id: 'ul2', name: '2-Day Upper/Lower', description: 'One upper-body and one lower-body session.', days: ['upper', 'lower'] },
  ],
  3: [
    { id: 'fb3', name: '3-Day Full Body', description: 'Three balanced full-body sessions per week.', days: ['full', 'full', 'full'] },
    { id: 'ppl3', name: '3-Day Push/Pull/Legs', description: 'Classic push, pull, and legs split.', days: ['push', 'pull', 'lower'] },
    { id: 'ulf3', name: '3-Day Upper/Lower/Full', description: 'Upper, lower, and a full-body day.', days: ['upper', 'lower', 'full'] },
  ],
  4: [
    { id: 'ul4', name: '4-Day Upper/Lower', description: 'Upper and lower body trained twice each week.', days: ['upper', 'lower', 'upper', 'lower'] },
    { id: 'pplu4', name: '4-Day Push/Pull/Legs + Upper', description: 'PPL with an extra upper-body day.', days: ['push', 'pull', 'lower', 'upper'] },
    { id: 'fb4', name: '4-Day Full Body', description: 'Four balanced full-body sessions.', days: ['full', 'full', 'full', 'full'] },
  ],
  5: [
    { id: 'ulppl5', name: '5-Day Upper/Lower/Push/Pull/Legs', description: 'Balanced split with upper, lower, and dedicated push, pull, and leg sessions.', days: ['upper', 'lower_quad', 'push', 'pull', 'lower_glute'] },
    { id: 'bro5', name: '5-Day Bro Split', description: 'Upper body focused program training one major muscle group per day.', days: ['chest', 'back', 'lower', 'shoulders', 'arms'] },
    { id: 'lul5', name: '5-Day Lower/Upper', description: 'Lower body focused split alternating between lower and upper body workouts.', days: ['lower_quad', 'upper', 'lower_glute', 'upper', 'lower'] },
    { id: 'pplpp5', name: '5-Day Push/Pull/Legs + Push/Pull', description: 'Upper body focused split with two push days, two pull days, and one leg day.', days: ['push', 'pull', 'lower', 'push', 'pull'] },
    { id: 'fb5', name: '5-Day Full Body', description: 'Balanced workouts that train your entire body each session.', days: ['full', 'full', 'full', 'full', 'full'] },
  ],
  6: [
    { id: 'ppl6', name: '6-Day Push/Pull/Legs ×2', description: 'The classic PPL split run twice per week.', days: ['push', 'pull', 'lower_quad', 'push', 'pull', 'lower_glute'] },
    { id: 'ul6', name: '6-Day Upper/Lower ×3', description: 'Upper and lower body trained three times each week.', days: ['upper', 'lower', 'upper', 'lower', 'upper', 'lower'] },
    { id: 'bro6', name: '6-Day Bro Split + Legs', description: 'One muscle group per day with an extra leg day.', days: ['chest', 'back', 'lower_quad', 'shoulders', 'arms', 'lower_glute'] },
  ],
}

/** Splits available for a day count, with the recommended one first. */
export function splitOptions(a: Pick<BuilderAnswers, 'daysPerWeek' | 'level' | 'focus' | 'stylePref'>): SplitOption[] {
  const options = [...(SPLITS[a.daysPerWeek] ?? SPLITS[3])]
  let recommendedId = options[0].id
  if (a.stylePref === 'full') {
    recommendedId = options.find((o) => o.days.every((d) => d === 'full'))?.id ?? recommendedId
  } else if (a.focus === 'upper') {
    recommendedId =
      options.find((o) => ['bro5', 'pplpp5', 'pplu4', 'ppl3', 'ppl6', 'bro6', 'ul2'].includes(o.id))?.id ?? recommendedId
  } else if (a.focus === 'lower') {
    recommendedId = options.find((o) => ['lul5', 'ul4', 'ulf3', 'ul6', 'ul2'].includes(o.id))?.id ?? recommendedId
  } else if (a.level === 'beginner' && a.daysPerWeek <= 3) {
    recommendedId = options.find((o) => o.days.every((d) => d === 'full'))?.id ?? recommendedId
  }
  const rec = options.find((o) => o.id === recommendedId)!
  return [rec, ...options.filter((o) => o.id !== recommendedId)]
}

// ---------------- plan generation ----------------

function pickExercise(pool: string, equipment: string[], used: Set<string>): string | null {
  for (const id of POOLS[pool] ?? []) {
    const ex = getExercise(id)
    if (!ex) continue
    if (used.has(id)) continue
    if (equipment.length > 0 && !matchesEquipment(ex, equipment)) continue
    return id
  }
  // allow a repeat rather than an empty slot
  for (const id of POOLS[pool] ?? []) {
    const ex = getExercise(id)
    if (ex && (equipment.length === 0 || matchesEquipment(ex, equipment))) return id
  }
  return null
}

/** Generate the full plan from wizard answers + chosen split. Weekly schedule mapped onto available days. */
export function generatePlan(a: BuilderAnswers, split: SplitOption): Plan {
  const trainingDays = [...a.availableDays].sort((x, y) => x - y).slice(0, a.daysPerWeek)
  const schedule: (string | null)[] = [null, null, null, null, null, null, null]
  const workouts: Workout[] = []
  const nameCounts = new Map<string, number>()

  split.days.forEach((dayKey, i) => {
    const tpl = DAY_TEMPLATES[dayKey]
    let slots = tpl.slots
    // volume by level: beginners trim the last isolation slots, advanced adds a set to compounds
    if (a.level === 'beginner') slots = slots.slice(0, Math.max(4, slots.length - 2))

    const used = new Set<string>()
    const exercises: PlanExercise[] = []
    for (const spec of slots) {
      const id = pickExercise(spec.pool, a.equipment, used)
      if (!id) continue
      used.add(id)
      let sets = spec.sets
      if (a.level === 'advanced' && spec.repsMax <= 10) sets += 1
      const ex = getExercise(id)
      // extra volume for the priority muscle
      if (a.priorityMuscle && ex && groupsOf(ex.primaryMuscles).includes(a.priorityMuscle)) sets = Math.min(5, sets + 1)
      exercises.push({ id: uid(), exerciseId: id, sets, repsMin: spec.repsMin, repsMax: spec.repsMax, perSide: spec.perSide ?? false, supersetWith: null, restSec: null })
    }

    // dedupe workout names (e.g. multiple Push days)
    const count = (nameCounts.get(tpl.name) ?? 0) + 1
    nameCounts.set(tpl.name, count)
    const total = split.days.filter((d) => DAY_TEMPLATES[d].name === tpl.name).length
    const name = total > 1 ? `${tpl.name} ${count}` : tpl.name

    const workoutId = uid()
    workouts.push({ id: workoutId, name, exercises })
    const day = trainingDays[i]
    if (day !== undefined) schedule[day] = workoutId
  })

  return {
    id: uid(),
    name: `${LEVEL_LABEL[a.level]}: ${split.name}`,
    subtitle: `${LEVEL_LABEL[a.level]} · ${GOAL_LABEL[a.goal]}`,
    createdAt: Date.now(),
    workouts,
    schedule,
  }
}

// ---------------- body fat bands (for the slider) ----------------

export const BF_BANDS: { value: number; label: string; blurbMale: string; blurbFemale: string }[] = [
  { value: 8, label: 'less than 10%', blurbMale: 'Very lean — visible abs and vascularity.', blurbFemale: 'Extremely lean — athletic/competition level.' },
  { value: 12, label: '10–14%', blurbMale: 'Lean — abs visible, athletic look.', blurbFemale: 'Very lean and athletic.' },
  { value: 17, label: '15–19%', blurbMale: 'Fit — some definition, abs faint.', blurbFemale: 'Lean — visible muscle tone.' },
  { value: 22, label: '20–24%', blurbMale: 'Average — little visible definition.', blurbFemale: 'Fit and healthy range.' },
  { value: 27, label: '25–29%', blurbMale: 'Softer midsection, no visible abs.', blurbFemale: 'Average — soft but healthy.' },
  { value: 32, label: '30–34%', blurbMale: 'Noticeable fat storage around the waist.', blurbFemale: 'Softer overall shape.' },
  { value: 37, label: '35–39%', blurbMale: 'High body fat.', blurbFemale: 'Higher body fat.' },
  { value: 42, label: '40% or more', blurbMale: 'Very high body fat.', blurbFemale: 'Very high body fat.' },
]

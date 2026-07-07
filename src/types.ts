// ---------- Exercise catalog ----------

export interface CatalogExercise {
  id: string
  name: string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  equipment: string
  category: string
  level: string
  mechanic: string | null
  instructions: string[]
  image: string | null
}

/** How a custom exercise is tracked during a session. */
export type TrackType = 'weight-reps' | 'bodyweight' | 'bodyweight-plus' | 'duration' | 'reps-only'

/** A user-created exercise. Shape-compatible with CatalogExercise so it renders everywhere. */
export interface CustomExercise extends CatalogExercise {
  custom: true
  trackType: TrackType
  defaultSets: number
  defaultRepsMin: number
  defaultRepsMax: number
  /** Default rest between sets, seconds. null = global default. */
  defaultRestSec?: number | null
  /** Soft-deleted: hidden from the picker but still resolvable for history. */
  deleted?: boolean
}

// ---------- Workout plan ----------

/** An exercise slot inside a workout template. */
export interface PlanExercise {
  /** Unique slot id (stable even if the exercise is swapped). */
  id: string
  exerciseId: string
  sets: number
  repsMin: number
  repsMax: number
  /** e.g. curls done one arm at a time */
  perSide?: boolean
  /** Slot id of the exercise this one is supersetted with. */
  supersetWith?: string | null
  /** Rest between sets for this exercise, in seconds. null/undefined = use the global default. */
  restSec?: number | null
  /** For timed exercises: also log a weight (weighted planks, loaded carries). */
  trackWeight?: boolean
}

export interface Workout {
  id: string
  name: string
  exercises: PlanExercise[]
}

export interface Plan {
  id: string
  name: string
  subtitle: string
  createdAt: number
  workouts: Workout[]
  /** Monday-first: schedule[0] = Mon ... schedule[6] = Sun. Value is a workout id or null (rest). */
  schedule: (string | null)[]
}

// ---------- Session logging ----------

export type Effort = 'easy' | 'ideal' | 'max'

export interface SetLog {
  weight: number | null
  reps: number | null
  /** For timed exercises (planks, cardio, stretches). */
  timeSec: number | null
  effort: Effort | null
  done: boolean
}

export interface ExerciseLog {
  slotId: string
  exerciseId: string
  perSide: boolean
  targetSets: number
  repsMin: number
  repsMax: number
  supersetWith: string | null
  /** Per-exercise rest override captured at session start. */
  restSec: number | null
  /** For timed exercises: also log a weight. */
  trackWeight?: boolean
  sets: SetLog[]
}

export interface Session {
  id: string
  workoutId: string
  workoutName: string
  /** Local date the session belongs to, YYYY-MM-DD. */
  date: string
  startedAt: number
  finishedAt: number | null
  logs: ExerciseLog[]
}

// ---------- Settings & app state ----------

export interface Settings {
  unit: 'lb' | 'kg'
  restSec: number
  /** Equipment the user has access to (catalog equipment keys). Empty = everything. */
  equipment: string[]
  /** Whether the exercise picker narrows to owned equipment by default. */
  filterByEquipment: boolean
}

export interface AppState {
  version: number
  plans: Plan[]
  activePlanId: string
  sessions: Session[]
  activeSession: Session | null
  customExercises: CustomExercise[]
  settings: Settings
  /** Timestamp of the last JSON backup export, for reminder nudges. */
  lastBackupAt: number | null
}

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
  settings: Settings
  /** Timestamp of the last JSON backup export, for reminder nudges. */
  lastBackupAt: number | null
}

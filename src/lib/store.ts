import { useSyncExternalStore } from 'react'
import type { AppState, Effort, ExerciseLog, Plan, PlanExercise, Session, SetLog, Workout } from '../types'
import { seedPlan } from '../data/seed'
import { getExercise, isTimed, isWeighted } from '../data/catalog'

const STORAGE_KEY = 'gym-app-state-v1'
const STATE_VERSION = 1

// ---------- helpers ----------

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Local date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday-first weekday index (Mon=0 ... Sun=6). */
export function weekdayIndex(d: Date = new Date()): number {
  return (d.getDay() + 6) % 7
}

/** Dates (YYYY-MM-DD) of the current week, Monday first. */
export function currentWeekDates(): string[] {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - weekdayIndex(now))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return localDate(d)
  })
}

// ---------- state container ----------

function defaultState(): AppState {
  return {
    version: STATE_VERSION,
    plan: seedPlan(),
    sessions: [],
    activeSession: null,
    settings: { unit: 'lb', restSec: 90 },
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || parsed.version !== STATE_VERSION) return defaultState()
    return { ...defaultState(), ...parsed }
  } catch {
    return defaultState()
  }
}

let state: AppState = loadState()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full or unavailable — keep running in memory
  }
}

function setState(updater: (s: AppState) => AppState) {
  state = updater(state)
  persist()
  listeners.forEach((l) => l())
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export function getState(): AppState {
  return state
}

// ---------- plan actions ----------

function updatePlan(fn: (p: Plan) => Plan) {
  setState((s) => ({ ...s, plan: fn(s.plan) }))
}

function updateWorkout(workoutId: string, fn: (w: Workout) => Workout) {
  updatePlan((p) => ({
    ...p,
    workouts: p.workouts.map((w) => (w.id === workoutId ? fn(w) : w)),
  }))
}

export const actions = {
  renamePlan(name: string) {
    updatePlan((p) => ({ ...p, name }))
  },

  renameWorkout(workoutId: string, name: string) {
    updateWorkout(workoutId, (w) => ({ ...w, name }))
  },

  /** Create a new empty workout, optionally assigning it to a weekday. */
  addWorkout(name: string, dayIndex: number | null): string {
    const id = uid()
    updatePlan((p) => ({
      ...p,
      workouts: [...p.workouts, { id, name, exercises: [] }],
      schedule: dayIndex === null ? p.schedule : p.schedule.map((d, i) => (i === dayIndex ? id : d)),
    }))
    return id
  },

  assignWorkoutToDay(dayIndex: number, workoutId: string | null) {
    updatePlan((p) => ({
      ...p,
      schedule: p.schedule.map((d, i) => (i === dayIndex ? workoutId : d)),
    }))
  },

  deleteWorkout(workoutId: string) {
    updatePlan((p) => ({
      ...p,
      workouts: p.workouts.filter((w) => w.id !== workoutId),
      schedule: p.schedule.map((d) => (d === workoutId ? null : d)),
    }))
  },

  addExercise(workoutId: string, exerciseId: string, sets = 3, repsMin = 8, repsMax = 12) {
    const slot: PlanExercise = { id: uid(), exerciseId, sets, repsMin, repsMax, perSide: false, supersetWith: null }
    updateWorkout(workoutId, (w) => ({ ...w, exercises: [...w.exercises, slot] }))
  },

  removeExercise(workoutId: string, slotId: string) {
    updateWorkout(workoutId, (w) => ({
      ...w,
      exercises: w.exercises
        .filter((e) => e.id !== slotId)
        .map((e) => (e.supersetWith === slotId ? { ...e, supersetWith: null } : e)),
    }))
  },

  swapExercise(workoutId: string, slotId: string, newExerciseId: string) {
    updateWorkout(workoutId, (w) => ({
      ...w,
      exercises: w.exercises.map((e) => (e.id === slotId ? { ...e, exerciseId: newExerciseId } : e)),
    }))
  },

  editSetsReps(workoutId: string, slotId: string, sets: number, repsMin: number, repsMax: number, perSide: boolean) {
    updateWorkout(workoutId, (w) => ({
      ...w,
      exercises: w.exercises.map((e) => (e.id === slotId ? { ...e, sets, repsMin, repsMax, perSide } : e)),
    }))
  },

  /** Pair two slots as a superset (or unpair when otherSlotId is null). */
  setSuperset(workoutId: string, slotId: string, otherSlotId: string | null) {
    updateWorkout(workoutId, (w) => ({
      ...w,
      exercises: w.exercises.map((e) => {
        // clear any existing pairing that involves either slot
        let next = e
        if (e.supersetWith === slotId || e.id === slotId || e.supersetWith === otherSlotId || e.id === otherSlotId) {
          next = { ...e, supersetWith: null }
        }
        if (otherSlotId !== null) {
          if (next.id === slotId) next = { ...next, supersetWith: otherSlotId }
          if (next.id === otherSlotId) next = { ...next, supersetWith: slotId }
        }
        return next
      }),
    }))
  },

  moveExercise(workoutId: string, slotId: string, direction: -1 | 1) {
    updateWorkout(workoutId, (w) => {
      const idx = w.exercises.findIndex((e) => e.id === slotId)
      const to = idx + direction
      if (idx < 0 || to < 0 || to >= w.exercises.length) return w
      const next = [...w.exercises]
      const [item] = next.splice(idx, 1)
      next.splice(to, 0, item)
      return { ...w, exercises: next }
    })
  },

  // ---------- session actions ----------

  startSession(workoutId: string) {
    const workout = state.plan.workouts.find((w) => w.id === workoutId)
    if (!workout) return
    const logs: ExerciseLog[] = workout.exercises.map((e) => ({
      slotId: e.id,
      exerciseId: e.exerciseId,
      perSide: e.perSide ?? false,
      targetSets: e.sets,
      repsMin: e.repsMin,
      repsMax: e.repsMax,
      supersetWith: e.supersetWith ?? null,
      sets: Array.from({ length: e.sets }, () => emptySet()),
    }))
    const session: Session = {
      id: uid(),
      workoutId,
      workoutName: workout.name,
      date: localDate(),
      startedAt: Date.now(),
      finishedAt: null,
      logs,
    }
    setState((s) => ({ ...s, activeSession: session }))
  },

  updateSet(logIndex: number, setIndex: number, patch: Partial<SetLog>) {
    setState((s) => {
      if (!s.activeSession) return s
      const logs = s.activeSession.logs.map((log, li) =>
        li === logIndex
          ? { ...log, sets: log.sets.map((set, si) => (si === setIndex ? { ...set, ...patch } : set)) }
          : log,
      )
      return { ...s, activeSession: { ...s.activeSession, logs } }
    })
  },

  addSet(logIndex: number) {
    setState((s) => {
      if (!s.activeSession) return s
      const logs = s.activeSession.logs.map((log, li) =>
        li === logIndex ? { ...log, sets: [...log.sets, emptySet()] } : log,
      )
      return { ...s, activeSession: { ...s.activeSession, logs } }
    })
  },

  removeLastSet(logIndex: number) {
    setState((s) => {
      if (!s.activeSession) return s
      const logs = s.activeSession.logs.map((log, li) =>
        li === logIndex && log.sets.length > 1 ? { ...log, sets: log.sets.slice(0, -1) } : log,
      )
      return { ...s, activeSession: { ...s.activeSession, logs } }
    })
  },

  finishSession() {
    setState((s) => {
      if (!s.activeSession) return s
      const finished: Session = { ...s.activeSession, finishedAt: Date.now() }
      return { ...s, activeSession: null, sessions: [...s.sessions, finished] }
    })
  },

  discardSession() {
    setState((s) => ({ ...s, activeSession: null }))
  },

  deleteSession(sessionId: string) {
    setState((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== sessionId) }))
  },

  // ---------- settings / data ----------

  setUnit(unit: 'lb' | 'kg') {
    setState((s) => ({ ...s, settings: { ...s.settings, unit } }))
  },

  setRestSec(restSec: number) {
    setState((s) => ({ ...s, settings: { ...s.settings, restSec } }))
  },

  importState(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as AppState
      if (!parsed || parsed.version !== STATE_VERSION || !parsed.plan || !Array.isArray(parsed.sessions)) return false
      setState(() => ({ ...defaultState(), ...parsed }))
      return true
    } catch {
      return false
    }
  },

  resetAll() {
    setState(() => defaultState())
  },
}

function emptySet(): SetLog {
  return { weight: null, reps: null, timeSec: null, effort: null, done: false }
}

// ---------- derived data ----------

export type DayStatus = 'rest' | 'upcoming' | 'today' | 'complete' | 'missed'

export function dayStatus(dayIndex: number): DayStatus {
  const workoutId = state.plan.schedule[dayIndex]
  return dayStatusFor(state, dayIndex, workoutId)
}

export function dayStatusFor(s: AppState, dayIndex: number, workoutId: string | null): DayStatus {
  if (!workoutId) return 'rest'
  const dates = currentWeekDates()
  const date = dates[dayIndex]
  // any finished session that day counts — training off-schedule still marks the day complete
  const done = s.sessions.some((sess) => sess.date === date && sess.finishedAt !== null)
  if (done) return 'complete'
  const today = weekdayIndex()
  if (dayIndex < today) return 'missed'
  if (dayIndex === today) return 'today'
  return 'upcoming'
}

export interface LastPerformance {
  date: string
  sets: SetLog[]
}

/** Most recent finished-session log for an exercise, for "last time" hints. */
export function lastPerformance(s: AppState, exerciseId: string): LastPerformance | null {
  for (let i = s.sessions.length - 1; i >= 0; i--) {
    const sess = s.sessions[i]
    const log = sess.logs.find((l) => l.exerciseId === exerciseId && l.sets.some((x) => x.done))
    if (log) return { date: sess.date, sets: log.sets.filter((x) => x.done) }
  }
  return null
}

export type LogMode = 'weight-reps' | 'reps' | 'time'

/** How a given exercise should be logged. */
export function logMode(exerciseId: string): LogMode {
  const ex = getExercise(exerciseId)
  if (!ex) return 'weight-reps'
  if (isTimed(ex)) return 'time'
  if (!isWeighted(ex)) return 'reps'
  return 'weight-reps'
}

export const EFFORT_LABEL: Record<Effort, string> = { easy: 'Easy', ideal: 'Ideal', max: 'Max' }

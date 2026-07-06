import { useSyncExternalStore } from 'react'
import type { AppState, Effort, ExerciseLog, Plan, PlanExercise, Session, SetLog, Workout } from '../types'
import { seedPlan } from '../data/seed'
import { getExercise, isTimed, isWeighted } from '../data/catalog'

const STORAGE_KEY = 'gym-app-state-v1'
const STATE_VERSION = 2

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

/** Dates (YYYY-MM-DD) of a week, Monday first. offset 0 = this week, -1 = last week, +1 = next. */
export function weekDates(offset = 0): string[] {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - weekdayIndex(now) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return localDate(d)
  })
}

/** Human-readable range like "Jul 6 – Jul 12" for a week offset. */
export function weekRangeLabel(offset = 0): string {
  const dates = weekDates(offset)
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return `${fmt(dates[0])} – ${fmt(dates[6])}`
}

// ---------- state container ----------

function defaultSettings(): AppState['settings'] {
  return { unit: 'lb', restSec: 90, equipment: [], filterByEquipment: false }
}

function defaultState(): AppState {
  const plan = seedPlan()
  return {
    version: STATE_VERSION,
    plans: [plan],
    activePlanId: plan.id,
    sessions: [],
    activeSession: null,
    settings: defaultSettings(),
    lastBackupAt: null,
  }
}

/**
 * Upgrade any previously stored shape to the current version.
 * Never discards user data — unknown/corrupt input returns null instead.
 */
function migrate(parsed: unknown): AppState | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>

  // v1: single `plan` object
  if (p.version === 1 && p.plan && typeof p.plan === 'object') {
    const oldPlan = p.plan as Omit<Plan, 'id' | 'createdAt'> & Partial<Plan>
    const plan: Plan = {
      id: oldPlan.id ?? uid(),
      name: oldPlan.name ?? 'My Program',
      subtitle: oldPlan.subtitle ?? 'Custom Program',
      createdAt: oldPlan.createdAt ?? Date.now(),
      workouts: oldPlan.workouts ?? [],
      schedule: oldPlan.schedule ?? [null, null, null, null, null, null, null],
    }
    return {
      version: STATE_VERSION,
      plans: [plan],
      activePlanId: plan.id,
      sessions: Array.isArray(p.sessions) ? (p.sessions as Session[]) : [],
      activeSession: (p.activeSession as Session | null) ?? null,
      settings: { ...defaultSettings(), ...(p.settings as object | undefined) },
      lastBackupAt: null,
    }
  }

  if (p.version === STATE_VERSION && Array.isArray(p.plans) && (p.plans as Plan[]).length > 0) {
    const plans = p.plans as Plan[]
    const activePlanId = plans.some((x) => x.id === p.activePlanId) ? (p.activePlanId as string) : plans[0].id
    return {
      version: STATE_VERSION,
      plans,
      activePlanId,
      sessions: Array.isArray(p.sessions) ? (p.sessions as Session[]) : [],
      activeSession: (p.activeSession as Session | null) ?? null,
      settings: { ...defaultSettings(), ...(p.settings as object | undefined) },
      lastBackupAt: typeof p.lastBackupAt === 'number' ? p.lastBackupAt : null,
    }
  }

  return null
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    return migrate(JSON.parse(raw)) ?? defaultState()
  } catch {
    return defaultState()
  }
}

let state: AppState = loadState()
const listeners = new Set<() => void>()

function persist() {
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(STORAGE_KEY, json)
  } catch {
    // storage full or unavailable — keep running in memory
  }
  idbWrite(json)
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

export function activePlan(s: AppState): Plan {
  return s.plans.find((p) => p.id === s.activePlanId) ?? s.plans[0]
}

// ---------- IndexedDB mirror (second copy of the same state) ----------

const IDB_NAME = 'gym-app-backup'
const IDB_STORE = 'state'

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

let idbTimer: ReturnType<typeof setTimeout> | null = null
function idbWrite(json: string) {
  // throttle: at most one IDB write per 2s burst of updates
  if (idbTimer) clearTimeout(idbTimer)
  idbTimer = setTimeout(async () => {
    try {
      const db = await idbOpen()
      db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(json, STORAGE_KEY)
    } catch {
      // IndexedDB unavailable — localStorage remains the primary copy
    }
  }, 2000)
}

async function idbRead(): Promise<string | null> {
  try {
    const db = await idbOpen()
    return await new Promise((resolve) => {
      const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(STORAGE_KEY)
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/**
 * Run once at startup: ask the browser not to evict our storage, and if
 * localStorage was wiped but the IndexedDB mirror survived, restore from it.
 */
export async function bootstrapStore(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // not supported — fine
  }
  if (localStorage.getItem(STORAGE_KEY)) return
  const mirrored = await idbRead()
  if (!mirrored) return
  try {
    const restored = migrate(JSON.parse(mirrored))
    if (restored) setState(() => restored)
  } catch {
    // corrupt mirror — ignore
  }
}

// ---------- plan actions ----------

function updatePlan(fn: (p: Plan) => Plan) {
  setState((s) => ({
    ...s,
    plans: s.plans.map((p) => (p.id === s.activePlanId ? fn(p) : p)),
  }))
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

  // ---------- program management ----------

  /** Create an empty program: one blank workout per selected day (Mon-first indexes). Returns its id. */
  createPlan(name: string, days: number[]): string {
    const id = uid()
    const schedule: (string | null)[] = [null, null, null, null, null, null, null]
    const workouts: Workout[] = []
    const sorted = [...days].sort((a, b) => a - b)
    sorted.forEach((day, i) => {
      const wid = uid()
      workouts.push({ id: wid, name: `Workout ${i + 1}`, exercises: [] })
      schedule[day] = wid
    })
    const plan: Plan = { id, name, subtitle: 'Custom Program', createdAt: Date.now(), workouts, schedule }
    setState((s) => ({ ...s, plans: [...s.plans, plan], activePlanId: id }))
    return id
  },

  setActivePlan(planId: string) {
    setState((s) => (s.plans.some((p) => p.id === planId) ? { ...s, activePlanId: planId } : s))
  },

  renamePlanById(planId: string, name: string) {
    setState((s) => ({ ...s, plans: s.plans.map((p) => (p.id === planId ? { ...p, name } : p)) }))
  },

  deletePlan(planId: string) {
    setState((s) => {
      if (s.plans.length <= 1) return s
      const plans = s.plans.filter((p) => p.id !== planId)
      return { ...s, plans, activePlanId: s.activePlanId === planId ? plans[0].id : s.activePlanId }
    })
  },

  // ---------- workout editing (active program) ----------

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
    const workout = activePlan(state).workouts.find((w) => w.id === workoutId)
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

  toggleEquipment(key: string) {
    setState((s) => {
      const has = s.settings.equipment.includes(key)
      const equipment = has ? s.settings.equipment.filter((e) => e !== key) : [...s.settings.equipment, key]
      return { ...s, settings: { ...s.settings, equipment } }
    })
  },

  setFilterByEquipment(on: boolean) {
    setState((s) => ({ ...s, settings: { ...s.settings, filterByEquipment: on } }))
  },

  markBackup() {
    setState((s) => ({ ...s, lastBackupAt: Date.now() }))
  },

  importState(json: string): boolean {
    try {
      const restored = migrate(JSON.parse(json))
      if (!restored) return false
      setState(() => restored)
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

export function dayStatusFor(s: AppState, date: string, workoutId: string | null): DayStatus {
  // any finished session that day counts — training off-schedule still marks the day complete
  const done = s.sessions.some((sess) => sess.date === date && sess.finishedAt !== null)
  const today = localDate()
  if (!workoutId) return done && date <= today ? 'complete' : 'rest'
  if (done) return 'complete'
  if (date < today) return 'missed'
  if (date === today) return 'today'
  return 'upcoming'
}

/** Finished sessions on a given date (for showing what was actually done on past days). */
export function sessionsOn(s: AppState, date: string): Session[] {
  return s.sessions.filter((sess) => sess.date === date && sess.finishedAt !== null)
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

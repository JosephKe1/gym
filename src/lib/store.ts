import { useSyncExternalStore } from 'react'
import type { AppState, CustomExercise, Effort, ExerciseLog, Plan, PlanExercise, Session, SetLog, TrackType, Workout } from '../types'
import { seedPlan } from '../data/seed'
import { getExercise, isTimed, isWeighted, setCustomExercises } from '../data/catalog'
import { migrateCoarseEquipment } from '../data/equipment'
import { GROUP_TO_RAW, type MuscleGroup } from './muscles'
import { suggestSets } from './suggest'

const STORAGE_KEY = 'gym-app-state-v1'
const STATE_VERSION = 3

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
    customExercises: [],
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
      customExercises: [],
      settings: { ...defaultSettings(), ...(p.settings as object | undefined) },
      lastBackupAt: null,
    }
  }

  // v2 (coarse equipment keys, no custom exercises) and v3 share the same core shape
  if ((p.version === 2 || p.version === STATE_VERSION) && Array.isArray(p.plans) && (p.plans as Plan[]).length > 0) {
    const plans = p.plans as Plan[]
    const activePlanId = plans.some((x) => x.id === p.activePlanId) ? (p.activePlanId as string) : plans[0].id
    const settings = { ...defaultSettings(), ...(p.settings as object | undefined) }
    if (p.version === 2) settings.equipment = migrateCoarseEquipment(settings.equipment)
    return {
      version: STATE_VERSION,
      plans,
      activePlanId,
      sessions: Array.isArray(p.sessions) ? (p.sessions as Session[]) : [],
      activeSession: (p.activeSession as Session | null) ?? null,
      customExercises: Array.isArray(p.customExercises) ? (p.customExercises as CustomExercise[]) : [],
      settings,
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
setCustomExercises(state.customExercises)
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
  const prevCustom = state.customExercises
  state = updater(state)
  if (state.customExercises !== prevCustom) setCustomExercises(state.customExercises)
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

/** Days between two YYYY-MM-DD dates (b - a), DST-safe. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
}

/**
 * The workout scheduled on a given date — weekly plans map by weekday,
 * rotating plans by position in their cycle (works for past and future dates).
 */
export function workoutIdForDate(plan: Plan, date: string): string | null {
  if (plan.cycle && plan.cycle.days.length > 0) {
    const n = plan.cycle.days.length
    const idx = ((daysBetween(plan.cycle.anchorDate, date) % n) + n) % n
    return plan.cycle.days[idx]
  }
  const [y, m, d] = date.split('-').map(Number)
  return plan.schedule[weekdayIndex(new Date(y, m - 1, d))]
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

  /** Assign a workout to the slot a date falls on — weekday for weekly plans, cycle position for rotations. */
  assignWorkoutToDate(date: string, workoutId: string | null) {
    updatePlan((p) => {
      if (p.cycle && p.cycle.days.length > 0) {
        const n = p.cycle.days.length
        const [ay, am, ad] = p.cycle.anchorDate.split('-').map(Number)
        const [by, bm, bd] = date.split('-').map(Number)
        const diff = Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000)
        const idx = ((diff % n) + n) % n
        return { ...p, cycle: { ...p.cycle, days: p.cycle.days.map((d, i) => (i === idx ? workoutId : d)) } }
      }
      const [y, m, d] = date.split('-').map(Number)
      const dayIndex = weekdayIndex(new Date(y, m - 1, d))
      return { ...p, schedule: p.schedule.map((x, i) => (i === dayIndex ? workoutId : x)) }
    })
  },

  /** Slide a rotating plan's cycle by N days (e.g. +1 after missing a day). */
  shiftCycle(planId: string, deltaDays: number) {
    setState((s) => ({
      ...s,
      plans: s.plans.map((p) => {
        if (p.id !== planId || !p.cycle) return p
        const [y, m, d] = p.cycle.anchorDate.split('-').map(Number)
        const anchor = new Date(y, m - 1, d)
        anchor.setDate(anchor.getDate() + deltaDays)
        return { ...p, cycle: { ...p.cycle, anchorDate: localDate(anchor) } }
      }),
    }))
  },

  /** Create a rotating program: entries are workout names (null = rest day). Cycle starts today. */
  createCyclePlan(name: string, entries: (string | null)[]): string {
    const id = uid()
    const workouts: Workout[] = []
    const days: (string | null)[] = entries.map((entry) => {
      if (entry === null) return null
      const wid = uid()
      workouts.push({ id: wid, name: entry, exercises: [] })
      return wid
    })
    const plan: Plan = {
      id,
      name,
      subtitle: 'Custom Program',
      createdAt: Date.now(),
      workouts,
      schedule: [null, null, null, null, null, null, null],
      cycle: { days, anchorDate: localDate() },
    }
    setState((s) => ({ ...s, plans: [...s.plans, plan], activePlanId: id }))
    return id
  },

  /** Insert a wizard-generated plan. */
  addGeneratedPlan(plan: Plan, activate: boolean) {
    setState((s) => ({
      ...s,
      plans: [...s.plans, plan],
      activePlanId: activate ? plan.id : s.activePlanId,
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
    const ex = getExercise(exerciseId)
    let restSec: number | null = null
    if (ex && 'defaultSets' in ex) {
      const c = ex as CustomExercise
      sets = c.defaultSets
      repsMin = c.defaultRepsMin
      repsMax = c.defaultRepsMax
      restSec = c.defaultRestSec ?? null
    }
    const slot: PlanExercise = { id: uid(), exerciseId, sets, repsMin, repsMax, perSide: false, supersetWith: null, restSec }
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

  editSetsReps(
    workoutId: string,
    slotId: string,
    patch: { sets: number; repsMin: number; repsMax: number; perSide: boolean; restSec: number | null; trackWeight?: boolean },
  ) {
    updateWorkout(workoutId, (w) => ({
      ...w,
      exercises: w.exercises.map((e) => (e.id === slotId ? { ...e, ...patch } : e)),
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
    const logs: ExerciseLog[] = workout.exercises.map((e) => {
      // pre-fill each set with last session's numbers so the user only adjusts
      const suggestions = suggestSets(logMode(e.exerciseId), e.sets, e.repsMax, lastPerformance(state, e.exerciseId))
      return {
        slotId: e.id,
        exerciseId: e.exerciseId,
        perSide: e.perSide ?? false,
        targetSets: e.sets,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        supersetWith: e.supersetWith ?? null,
        restSec: e.restSec ?? null,
        trackWeight: e.trackWeight ?? false,
        sets: suggestions.map((s) => ({ ...emptySet(), weight: s.weight, reps: s.reps })),
      }
    })
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

  // ---------- in-session workout editing ----------
  // Each takes alsoPlan: true applies the change to the plan workout too (future sessions).

  sessionAddExercise(exerciseId: string, alsoPlan: boolean) {
    const ex = getExercise(exerciseId)
    let sets = 3
    let repsMin = 8
    let repsMax = 12
    let restSec: number | null = null
    if (ex && 'defaultSets' in ex) {
      const c = ex as CustomExercise
      sets = c.defaultSets
      repsMin = c.defaultRepsMin
      repsMax = c.defaultRepsMax
      restSec = c.defaultRestSec ?? null
    }
    const slotId = uid()
    setState((s) => {
      if (!s.activeSession) return s
      const suggestions = suggestSets(logMode(exerciseId), sets, repsMax, lastPerformance(s, exerciseId))
      const log: ExerciseLog = {
        slotId,
        exerciseId,
        perSide: false,
        targetSets: sets,
        repsMin,
        repsMax,
        supersetWith: null,
        restSec,
        trackWeight: false,
        sets: suggestions.map((x) => ({ ...emptySet(), weight: x.weight, reps: x.reps })),
      }
      const slot: PlanExercise = { id: slotId, exerciseId, sets, repsMin, repsMax, perSide: false, supersetWith: null, restSec }
      return {
        ...s,
        activeSession: { ...s.activeSession, logs: [...s.activeSession.logs, log] },
        plans: alsoPlan ? patchSessionWorkout(s, (w) => ({ ...w, exercises: [...w.exercises, slot] })) : s.plans,
      }
    })
  },

  sessionRemoveExercise(logIndex: number, alsoPlan: boolean) {
    setState((s) => {
      if (!s.activeSession) return s
      const slotId = s.activeSession.logs[logIndex]?.slotId
      if (!slotId) return s
      const logs = s.activeSession.logs
        .filter((_, i) => i !== logIndex)
        .map((l) => (l.supersetWith === slotId ? { ...l, supersetWith: null } : l))
      return {
        ...s,
        activeSession: { ...s.activeSession, logs },
        plans: alsoPlan
          ? patchSessionWorkout(s, (w) => ({
              ...w,
              exercises: w.exercises
                .filter((e) => e.id !== slotId)
                .map((e) => (e.supersetWith === slotId ? { ...e, supersetWith: null } : e)),
            }))
          : s.plans,
      }
    })
  },

  /** Swap the exercise: un-done sets are re-prefilled for the new exercise; completed sets are cleared. */
  sessionSwapExercise(logIndex: number, newExerciseId: string, alsoPlan: boolean) {
    setState((s) => {
      if (!s.activeSession) return s
      const log = s.activeSession.logs[logIndex]
      if (!log) return s
      const suggestions = suggestSets(logMode(newExerciseId), log.sets.length, log.repsMax, lastPerformance(s, newExerciseId))
      const logs = s.activeSession.logs.map((l, i) =>
        i === logIndex
          ? {
              ...l,
              exerciseId: newExerciseId,
              trackWeight: false,
              sets: l.sets.map((_, si) => ({ ...emptySet(), weight: suggestions[si]?.weight ?? null, reps: suggestions[si]?.reps ?? null })),
            }
          : l,
      )
      return {
        ...s,
        activeSession: { ...s.activeSession, logs },
        plans: alsoPlan
          ? patchSessionWorkout(s, (w) => ({
              ...w,
              exercises: w.exercises.map((e) => (e.id === log.slotId ? { ...e, exerciseId: newExerciseId } : e)),
            }))
          : s.plans,
      }
    })
  },

  sessionEditTargets(
    logIndex: number,
    patch: { sets: number; repsMin: number; repsMax: number; perSide: boolean; trackWeight: boolean },
    alsoPlan: boolean,
  ) {
    setState((s) => {
      if (!s.activeSession) return s
      const log = s.activeSession.logs[logIndex]
      if (!log) return s
      const resized = [...log.sets]
      while (resized.length < patch.sets) resized.push(emptySet())
      resized.length = patch.sets
      const logs = s.activeSession.logs.map((l, i) =>
        i === logIndex
          ? { ...l, targetSets: patch.sets, repsMin: patch.repsMin, repsMax: patch.repsMax, perSide: patch.perSide, trackWeight: patch.trackWeight, sets: resized }
          : l,
      )
      return {
        ...s,
        activeSession: { ...s.activeSession, logs },
        plans: alsoPlan
          ? patchSessionWorkout(s, (w) => ({
              ...w,
              exercises: w.exercises.map((e) => (e.id === log.slotId ? { ...e, ...patch } : e)),
            }))
          : s.plans,
      }
    })
  },

  /** Save a rest time from inside a session: updates the running log AND the plan slot for next time. */
  saveSessionRest(logIndex: number, restSec: number | null) {
    setState((s) => {
      if (!s.activeSession) return s
      const log = s.activeSession.logs[logIndex]
      if (!log) return s
      const logs = s.activeSession.logs.map((l, i) => (i === logIndex ? { ...l, restSec } : l))
      const plans = s.plans.map((p) => ({
        ...p,
        workouts: p.workouts.map((w) =>
          w.id === s.activeSession!.workoutId
            ? { ...w, exercises: w.exercises.map((e) => (e.id === log.slotId ? { ...e, restSec } : e)) }
            : w,
        ),
      }))
      return { ...s, plans, activeSession: { ...s.activeSession, logs } }
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

  // ---------- custom exercises ----------

  createCustomExercise(input: {
    name: string
    equipmentKey: string
    trackType: TrackType
    primaryGroup: MuscleGroup
    secondaryGroups: MuscleGroup[]
    defaultSets: number
    defaultRepsMin: number
    defaultRepsMax: number
    defaultRestSec: number | null
  }): CustomExercise {
    const ex: CustomExercise = {
      id: `custom-${uid()}`,
      custom: true,
      name: input.name,
      primaryMuscles: [GROUP_TO_RAW[input.primaryGroup]],
      secondaryMuscles: input.secondaryGroups.map((g) => GROUP_TO_RAW[g]),
      equipment: input.equipmentKey,
      category: 'strength',
      level: 'custom',
      mechanic: null,
      instructions: [],
      image: null,
      trackType: input.trackType,
      defaultSets: input.defaultSets,
      defaultRepsMin: input.defaultRepsMin,
      defaultRepsMax: input.defaultRepsMax,
      defaultRestSec: input.defaultRestSec,
    }
    setState((s) => ({ ...s, customExercises: [...s.customExercises, ex] }))
    return ex
  },

  /** Soft-delete: hidden from the picker, removed from all workouts; history stays resolvable. */
  deleteCustomExercise(exerciseId: string) {
    setState((s) => ({
      ...s,
      customExercises: s.customExercises.map((ex) => (ex.id === exerciseId ? { ...ex, deleted: true } : ex)),
      plans: s.plans.map((p) => ({
        ...p,
        workouts: p.workouts.map((w) => {
          const removed = w.exercises.filter((e) => e.exerciseId === exerciseId).map((e) => e.id)
          return {
            ...w,
            exercises: w.exercises
              .filter((e) => e.exerciseId !== exerciseId)
              .map((e) => (e.supersetWith && removed.includes(e.supersetWith) ? { ...e, supersetWith: null } : e)),
          }
        }),
      })),
    }))
  },

  // ---------- settings / data ----------

  setUnit(unit: 'lb' | 'kg') {
    setState((s) => ({ ...s, settings: { ...s.settings, unit } }))
  },

  setRestSec(restSec: number) {
    setState((s) => ({ ...s, settings: { ...s.settings, restSec } }))
  },

  setEquipment(keys: string[]) {
    setState((s) => ({ ...s, settings: { ...s.settings, equipment: keys, filterByEquipment: keys.length > 0 } }))
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

/** Apply a workout transform to the plan workout of the active session. */
function patchSessionWorkout(s: AppState, fn: (w: Workout) => Workout): Plan[] {
  const workoutId = s.activeSession?.workoutId
  if (!workoutId) return s.plans
  return s.plans.map((p) => ({
    ...p,
    workouts: p.workouts.map((w) => (w.id === workoutId ? fn(w) : w)),
  }))
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

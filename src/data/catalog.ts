import raw from './exercises.json'
import type { CatalogExercise, CustomExercise } from '../types'
import { groupsOf, type MuscleGroup } from '../lib/muscles'
import { matchesEquipment } from './equipment'

export const CATALOG = raw as CatalogExercise[]

const byId = new Map<string, CatalogExercise>()
for (const ex of CATALOG) byId.set(ex.id, ex)

// Custom exercises live in app state; the store mirrors them here so that
// exercise lookup stays a plain synchronous call everywhere in the UI.
let customById = new Map<string, CustomExercise>()
let customList: CustomExercise[] = []

export function setCustomExercises(list: CustomExercise[]) {
  customList = list
  customById = new Map(list.map((ex) => [ex.id, ex]))
}

export function getExercise(id: string): CatalogExercise | undefined {
  return customById.get(id) ?? byId.get(id)
}

export function getCustomExercise(id: string): CustomExercise | undefined {
  return customById.get(id)
}

export function isCustom(ex: CatalogExercise): ex is CustomExercise {
  return (ex as CustomExercise).custom === true
}

/** Visible (non-deleted) custom exercises. */
export function customExercises(): CustomExercise[] {
  return customList.filter((ex) => !ex.deleted)
}

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export function imageUrl(ex: CatalogExercise): string | null {
  return ex.image ? IMAGE_BASE + ex.image : null
}

/** True for exercises logged by time (seconds) rather than reps. */
export function isTimed(ex: CatalogExercise): boolean {
  if (isCustom(ex)) return ex.trackType === 'duration'
  return ex.category === 'cardio' || ex.category === 'stretching'
}

/** True for exercises where logging a weight makes sense. */
export function isWeighted(ex: CatalogExercise): boolean {
  if (isCustom(ex)) return ex.trackType === 'weight-reps' || ex.trackType === 'bodyweight-plus'
  return ex.equipment !== 'body only' && ex.equipment !== '' && ex.equipment !== 'foam roll' && ex.category !== 'cardio' && ex.category !== 'stretching'
}

export function searchCatalog(
  query: string,
  group: MuscleGroup | null,
  equipment: string[] | null = null,
): CatalogExercise[] {
  const q = query.trim().toLowerCase()
  const pass = (ex: CatalogExercise) => {
    if (q && !ex.name.toLowerCase().includes(q)) return false
    if (group && !groupsOf(ex.primaryMuscles).includes(group)) return false
    // custom exercises are deliberate creations — never hide them behind the equipment filter
    if (equipment && equipment.length > 0 && !isCustom(ex) && !matchesEquipment(ex, equipment)) return false
    return true
  }
  return [...customExercises().filter(pass), ...CATALOG.filter(pass)]
}

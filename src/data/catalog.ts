import raw from './exercises.json'
import type { CatalogExercise } from '../types'
import { groupsOf, type MuscleGroup } from '../lib/muscles'

export const CATALOG = raw as CatalogExercise[]

const byId = new Map<string, CatalogExercise>()
for (const ex of CATALOG) byId.set(ex.id, ex)

export function getExercise(id: string): CatalogExercise | undefined {
  return byId.get(id)
}

const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

export function imageUrl(ex: CatalogExercise): string | null {
  return ex.image ? IMAGE_BASE + ex.image : null
}

/** True for exercises logged by time (seconds) rather than reps. */
export function isTimed(ex: CatalogExercise): boolean {
  return ex.category === 'cardio' || ex.category === 'stretching'
}

/** True for exercises where logging a weight makes sense. */
export function isWeighted(ex: CatalogExercise): boolean {
  return ex.equipment !== 'body only' && ex.equipment !== '' && ex.equipment !== 'foam roll' && ex.category !== 'cardio' && ex.category !== 'stretching'
}

export function searchCatalog(query: string, group: MuscleGroup | null): CatalogExercise[] {
  const q = query.trim().toLowerCase()
  return CATALOG.filter((ex) => {
    if (q && !ex.name.toLowerCase().includes(q)) return false
    if (group && !groupsOf(ex.primaryMuscles).includes(group)) return false
    return true
  })
}

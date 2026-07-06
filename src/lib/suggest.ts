import type { SetLog } from '../types'
import type { LastPerformance, LogMode } from './store'

/**
 * Progression hint for one set, derived from the same set of the previous
 * session and its effort rating. Inputs are pre-filled with last time's
 * numbers; the direction arrows + copy tell the user how to push.
 */
export interface SetSuggestion {
  weight: number | null
  reps: number | null
  weightDir: 'up' | null
  repsDir: 'up' | 'down' | null
  title: string | null
  body: string | null
  prev: SetLog | null
}

const NONE = (prev: SetLog | null): SetSuggestion => ({
  weight: prev?.weight ?? null,
  reps: prev?.reps ?? null,
  weightDir: null,
  repsDir: null,
  title: null,
  body: null,
  prev,
})

export function suggestSets(
  mode: LogMode,
  targetSets: number,
  repsMax: number,
  last: LastPerformance | null,
): SetSuggestion[] {
  const prevSets = last?.sets ?? []
  return Array.from({ length: targetSets }, (_, i) => {
    const prev = prevSets[i] ?? prevSets[prevSets.length - 1] ?? null
    // timed sets are re-measured with the stopwatch, not pre-filled
    if (!prev || mode === 'time') return mode === 'time' ? { ...NONE(prev), weight: null, reps: null } : NONE(prev)

    const base = NONE(prev)
    if (mode !== 'weight-reps') base.weight = null
    const reps = prev.reps
    const earlierHard = prevSets.slice(0, i).some((s) => s.effort === 'max')

    if (mode === 'weight-reps' && (prev.effort === 'easy' || prev.effort === 'ideal') && reps != null && reps >= repsMax) {
      return {
        ...base,
        weightDir: 'up',
        repsDir: 'down',
        title: 'More weight, less reps',
        body: `For this set, try using a slightly heavier weight. Because of this, you may not be able to reach ${reps} reps.`,
      }
    }
    if (earlierHard && reps != null) {
      return {
        ...base,
        repsDir: 'up',
        title: 'Increase reps',
        body: `Since you already pushed hard on an earlier set, stick to the same weight and try to do at least ${reps} reps. If you can do even more than that, great!`,
      }
    }
    if (prev.effort === 'easy' && reps != null) {
      return {
        ...base,
        repsDir: 'up',
        title: 'Increase reps',
        body: `Last time this felt easy. Aim for at least ${reps + 1} reps${mode === 'weight-reps' ? ' at the same weight' : ''}.`,
      }
    }
    if (prev.effort === 'ideal' && reps != null) {
      return {
        ...base,
        repsDir: 'up',
        title: 'Increase reps',
        body: `You had a little left in the tank last time. Try for ${reps + 1} reps${mode === 'weight-reps' ? ' at the same weight' : ''}.`,
      }
    }
    if (prev.effort === 'max' && reps != null) {
      return {
        ...base,
        repsDir: 'up',
        title: 'Match your reps',
        body: `This set was max effort last time. Stick to the same weight and try to match ${reps} reps with good form.`,
      }
    }
    return base
  })
}

import { useState } from 'react'
import type { CatalogExercise } from '../types'
import { imageUrl } from '../data/catalog'
import { groupsOf, GROUP_BADGE } from '../lib/muscles'

/**
 * Exercise thumbnail. A colored muscle-group badge renders immediately;
 * the photo (from the free-exercise-db CDN) fades in over it once loaded,
 * so slow or offline networks still show something meaningful.
 */
export default function ExerciseImage({ exercise, size = 'md' }: { exercise: CatalogExercise; size?: 'sm' | 'md' | 'lg' }) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const url = imageUrl(exercise)
  const dims = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-28 h-28' : 'w-16 h-16'

  const group = groupsOf(exercise.primaryMuscles)[0]
  const badge = group ? GROUP_BADGE[group] : { label: 'EX', classes: 'bg-slate-200 text-slate-600' }

  return (
    <div className={`${dims} relative rounded-xl flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden ${badge.classes}`}>
      {badge.label}
      {url && !failed && (
        <img
          src={url}
          alt={exercise.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover bg-white transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  )
}

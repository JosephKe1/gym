import { useMemo, useState } from 'react'
import { ChevronDown, Trash2, TrendingUp } from 'lucide-react'
import Menu from '../components/Menu'
import ExerciseImage from '../components/ExerciseImage'
import { getExercise } from '../data/catalog'
import { useAppState, actions, EFFORT_LABEL } from '../lib/store'
import type { Session } from '../types'

export default function ProgressView() {
  const state = useAppState()
  const sessions = useMemo(() => [...state.sessions].reverse(), [state.sessions])

  // exercises that have at least one finished, weighted set — candidates for the chart
  const trackedExercises = useMemo(() => {
    const ids = new Map<string, number>()
    for (const s of state.sessions) {
      for (const log of s.logs) {
        if (log.sets.some((x) => x.done && x.weight != null)) {
          ids.set(log.exerciseId, (ids.get(log.exerciseId) ?? 0) + 1)
        }
      }
    }
    return [...ids.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [state.sessions])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const chartExerciseId = selectedId ?? trackedExercises[0] ?? null

  return (
    <div className="pb-28 px-5">
      <h1 className="text-2xl font-bold pt-4">Progress</h1>

      {chartExerciseId ? (
        <ExerciseChart
          exerciseId={chartExerciseId}
          options={trackedExercises}
          onSelect={setSelectedId}
          unit={state.settings.unit}
        />
      ) : (
        <div className="mt-6 bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-400">
          <TrendingUp className="mx-auto mb-3" />
          Finish a workout and your strength progress will show up here.
        </div>
      )}

      <h2 className="text-2xl font-bold mt-8">History</h2>
      {sessions.length === 0 && <p className="text-slate-400 mt-3">No workouts logged yet.</p>}
      <ul className="mt-4 space-y-3">
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} unit={state.settings.unit} />
        ))}
      </ul>
    </div>
  )
}

// ---------- per-exercise top-set chart ----------

interface Point {
  date: string
  weight: number
}

function ExerciseChart({
  exerciseId,
  options,
  onSelect,
  unit,
}: {
  exerciseId: string
  options: string[]
  onSelect: (id: string) => void
  unit: string
}) {
  const state = useAppState()
  const ex = getExercise(exerciseId)
  const [active, setActive] = useState<number | null>(null)

  const points: Point[] = useMemo(() => {
    const out: Point[] = []
    for (const s of state.sessions) {
      let top: number | null = null
      for (const log of s.logs) {
        if (log.exerciseId !== exerciseId) continue
        for (const set of log.sets) {
          if (set.done && set.weight != null) top = Math.max(top ?? 0, set.weight)
        }
      }
      if (top != null) out.push({ date: s.date, weight: top })
    }
    return out
  }, [state.sessions, exerciseId])

  if (!ex || points.length === 0) return null

  // chart geometry
  const W = 340
  const H = 150
  const PAD = { l: 34, r: 12, t: 12, b: 22 }
  const ws = points.map((p) => p.weight)
  const min = Math.min(...ws)
  const max = Math.max(...ws)
  const span = max - min || 1
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r))
  const y = (w: number) => PAD.t + (1 - (w - min) / span) * (H - PAD.t - PAD.b)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.weight).toFixed(1)}`).join(' ')
  const activePoint = active != null ? points[active] : null

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-3xl p-4">
      <label className="text-xs font-bold text-slate-400">TOP SET WEIGHT ({unit.toUpperCase()})</label>
      <select
        value={exerciseId}
        onChange={(e) => onSelect(e.target.value)}
        className="mt-1 w-full text-lg font-bold bg-transparent outline-none"
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {getExercise(id)?.name ?? id}
          </option>
        ))}
      </select>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full mt-2 touch-none"
        role="img"
        aria-label={`${ex.name} top-set weight over time`}
        onPointerLeave={() => setActive(null)}
      >
        {/* recessive grid: min & max only */}
        {[...new Set([min, max])].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {v}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.weight)} r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            {/* generous invisible hit target */}
            <circle cx={x(i)} cy={y(p.weight)} r="14" fill="transparent" onPointerDown={() => setActive(i)} onPointerEnter={() => setActive(i)} />
          </g>
        ))}
        {/* direct label on latest point */}
        {active === null && points.length > 0 && (
          <text
            x={x(points.length - 1)}
            y={y(points[points.length - 1].weight) - 8}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            fill="#334155"
          >
            {points[points.length - 1].weight}
            {unit}
          </text>
        )}
        {activePoint && active != null && (
          <g>
            <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
            <text
              x={Math.min(Math.max(x(active), PAD.l + 30), W - PAD.r - 30)}
              y={PAD.t + 2}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#334155"
            >
              {activePoint.date} · {activePoint.weight}
              {unit}
            </text>
          </g>
        )}
        <text x={PAD.l} y={H - 6} fontSize="10" fill="#94a3b8">
          {points[0].date}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize="10" fill="#94a3b8">
          {points[points.length - 1].date}
        </text>
      </svg>
    </div>
  )
}

// ---------- history cards ----------

function SessionCard({ session, unit }: { session: Session; unit: string }) {
  const [open, setOpen] = useState(false)
  const doneSets = session.logs.reduce((a, l) => a + l.sets.filter((s) => s.done).length, 0)
  const volume = session.logs.reduce(
    (a, l) => a + l.sets.reduce((b, s) => b + (s.done && s.weight != null && s.reps != null ? s.weight * s.reps : 0), 0),
    0,
  )
  const durationMin =
    session.finishedAt != null ? Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000)) : null

  return (
    <li className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="grow text-left min-w-0">
          <p className="text-slate-400 text-sm">{formatDate(session.date)}</p>
          <p className="text-lg font-bold truncate">{session.workoutName}</p>
          <p className="text-slate-500 text-sm">
            {doneSets} sets{volume > 0 ? ` · ${Math.round(volume).toLocaleString()} ${unit} volume` : ''}
            {durationMin != null ? ` · ${durationMin} min` : ''}
          </p>
        </button>
        <Menu
          items={[
            {
              label: 'Delete entry',
              icon: <Trash2 size={18} />,
              danger: true,
              onClick: () => {
                if (confirm('Delete this workout from history?')) actions.deleteSession(session.id)
              },
            },
          ]}
        />
        <button type="button" aria-label={open ? 'Collapse' : 'Expand'} onClick={() => setOpen((o) => !o)} className="p-1 text-slate-400">
          <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {session.logs.map((log) => {
            const ex = getExercise(log.exerciseId)
            const done = log.sets.filter((s) => s.done)
            if (!ex) return null
            return (
              <li key={log.slotId} className="flex items-start gap-3">
                <ExerciseImage exercise={ex} size="sm" />
                <div className="min-w-0">
                  <p className="font-semibold">{ex.name}</p>
                  {done.length === 0 ? (
                    <p className="text-slate-400 text-sm">Skipped</p>
                  ) : (
                    <p className="text-slate-500 text-sm">
                      {done
                        .map((s) => {
                          const base =
                            s.timeSec != null
                              ? `${s.timeSec}s`
                              : `${s.weight != null ? s.weight + unit + '×' : ''}${s.reps ?? '–'}`
                          return s.effort ? `${base} (${EFFORT_LABEL[s.effort]})` : base
                        })
                        .join(', ')}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

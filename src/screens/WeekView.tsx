import { useState } from 'react'
import {
  Pencil,
  Plus,
  Dumbbell,
  AlertTriangle,
  CheckCircle2,
  PersonStanding,
  Play,
  FolderKanban,
  Download,
} from 'lucide-react'
import Menu from '../components/Menu'
import Sheet from '../components/Sheet'
import ProgramsSheet from '../components/ProgramsSheet'
import CalendarStrip from '../components/CalendarStrip'
import { actions, activePlan, dayStatusFor, sessionsOn, useAppState, weekDates, weekRangeLabel, workoutIdForDate, localDate, type DayStatus } from '../lib/store'

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const BACKUP_NUDGE_MS = 21 * 24 * 60 * 60 * 1000 // 3 weeks

export default function WeekView({
  onOpenWorkout,
  onOpenSettings,
}: {
  onOpenWorkout: (workoutId: string) => void
  onOpenSettings: () => void
}) {
  const state = useAppState()
  const plan = activePlan(state)
  const [assignDate, setAssignDate] = useState<string | null>(null)
  const [showPrograms, setShowPrograms] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  const dates = weekDates(weekOffset)
  const todayWorkoutId = workoutIdForDate(plan, localDate())
  const todayWorkout = plan.workouts.find((w) => w.id === todayWorkoutId)
  const todayStatus = dayStatusFor(state, localDate(), todayWorkoutId ?? null)

  const needsBackupNudge =
    state.sessions.length >= 3 &&
    (state.lastBackupAt === null || Date.now() - state.lastBackupAt > BACKUP_NUDGE_MS)

  return (
    <div className="pb-28">
      <CalendarStrip weekOffset={weekOffset} onSelectWeekOffset={setWeekOffset} />

      <header className="px-5 pt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-slate-500 text-sm">{plan.subtitle}</p>
          <button
            type="button"
            className="flex items-center gap-2 mt-0.5 min-w-0"
            onClick={() => {
              const name = prompt('Program name', plan.name)
              if (name?.trim()) actions.renamePlan(name.trim())
            }}
          >
            <h1 className="text-2xl font-bold truncate">{plan.name}</h1>
            <Pencil size={16} className="text-slate-400 shrink-0" />
          </button>
        </div>
        <button
          type="button"
          aria-label="My programs"
          onClick={() => setShowPrograms(true)}
          className="shrink-0 mt-1 w-11 h-11 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center active:bg-slate-200"
        >
          <FolderKanban size={20} />
        </button>
      </header>

      {todayWorkout && weekOffset === 0 && (
        <div className="mx-5 mt-5 bg-blue-50 rounded-3xl p-6 flex items-center justify-between">
          <div>
            <p className={`font-semibold ${todayStatus === 'complete' ? 'text-green-600' : 'text-blue-600'}`}>
              {todayStatus === 'complete' ? 'Workout Complete' : "Today's Workout"}
            </p>
            <p className="text-3xl font-bold mt-1">{todayWorkout.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenWorkout(todayWorkout.id)}
            className="bg-blue-600 text-white font-semibold rounded-full px-6 py-3.5 active:bg-blue-700 flex items-center gap-2"
          >
            {todayStatus === 'complete' ? 'View Workout' : <><Play size={16} fill="currentColor" /> Start</>}
          </button>
        </div>
      )}

      {needsBackupNudge && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mx-5 mt-4 w-[calc(100%-2.5rem)] flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left"
        >
          <Download size={18} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-800">
            <span className="font-semibold">Back up your progress.</span> It's been a while since your last export —
            tap to open Settings.
          </span>
        </button>
      )}

      <div className="px-5 mt-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {weekOffset === 0 ? "This Week's Schedule" : weekOffset === -1 ? 'Last Week' : weekOffset === 1 ? 'Next Week' : 'Schedule'}
        </h2>
        {weekOffset !== 0 && (
          <button type="button" onClick={() => setWeekOffset(0)} className="text-blue-600 text-sm font-semibold">
            Back to today
          </button>
        )}
      </div>
      <p className="px-5 mt-1 text-slate-400 text-sm">{weekRangeLabel(weekOffset)}</p>

      <ul className="px-5 mt-4 space-y-3">
        {DAY_LABELS.map((label, i) => {
          const date = dates[i]
          const workoutId = workoutIdForDate(plan, date)
          const workout = plan.workouts.find((w) => w.id === workoutId)
          const status = dayStatusFor(state, date, workoutId ?? null)
          const doneNames =
            status === 'complete'
              ? [...new Set(sessionsOn(state, date).map((sess) => sess.workoutName))]
              : []
          return (
            <li key={label} className="flex items-center gap-4">
              <span className="w-11 shrink-0 text-center">
                <span className={`block font-bold text-sm ${date === localDate() ? 'text-blue-600' : 'text-slate-700'}`}>
                  {label}
                </span>
                <span className={`block text-xs ${date === localDate() ? 'text-blue-500 font-semibold' : 'text-slate-400'}`}>
                  {Number(date.slice(8))}
                </span>
              </span>
              <DayCard
                status={status}
                workoutName={workout?.name ?? null}
                doneNames={doneNames}
                onOpen={() => workout && onOpenWorkout(workout.id)}
                onAdd={() => setAssignDate(date)}
                menu={
                  <Menu
                    items={[
                      { label: workout ? 'Change workout' : 'Assign workout', onClick: () => setAssignDate(date) },
                      ...(workout
                        ? [{ label: 'Make it a rest day', danger: true, onClick: () => actions.assignWorkoutToDate(date, null) }]
                        : []),
                    ]}
                  />
                }
              />
            </li>
          )
        })}
      </ul>

      {assignDate !== null && (
        <AssignWorkoutSheet
          date={assignDate}
          onClose={() => setAssignDate(null)}
          onOpenWorkout={onOpenWorkout}
        />
      )}

      {showPrograms && <ProgramsSheet onClose={() => setShowPrograms(false)} />}
    </div>
  )
}

function DayCard({
  status,
  workoutName,
  doneNames,
  onOpen,
  onAdd,
  menu,
}: {
  status: DayStatus
  workoutName: string | null
  doneNames: string[]
  onOpen: () => void
  onAdd: () => void
  menu: React.ReactNode
}) {
  const frame =
    status === 'rest'
      ? 'border border-slate-200 bg-white'
      : status === 'missed'
        ? 'border border-orange-200 bg-orange-50/40'
        : status === 'complete'
          ? 'border border-green-200 bg-green-50/40'
          : 'bg-slate-100'

  const iconFrame =
    status === 'rest'
      ? 'border border-slate-200 text-slate-400'
      : status === 'missed'
        ? 'border border-orange-200 bg-orange-50 text-orange-500'
        : status === 'complete'
          ? 'border border-green-200 bg-green-50 text-green-600'
          : 'border border-blue-200 bg-blue-50 text-blue-600'

  // on a completed day, show what was actually trained if it differs from the scheduled workout
  const completedLabel =
    doneNames.length > 0 && (!workoutName || !doneNames.includes(workoutName)) ? doneNames.join(', ') : null

  return (
    <div className={`grow flex items-center gap-3 rounded-2xl p-3 min-w-0 ${frame}`}>
      <span className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconFrame}`}>
        {status === 'rest' && !workoutName ? <PersonStanding size={24} /> : <Dumbbell size={22} />}
      </span>

      {workoutName || completedLabel ? (
        <button type="button" onClick={workoutName ? onOpen : undefined} className="grow text-left min-w-0">
          {status === 'missed' && (
            <p className="text-orange-500 text-sm font-semibold flex items-center gap-1">
              Missed <AlertTriangle size={13} />
            </p>
          )}
          {status === 'complete' && (
            <p className="text-green-600 text-sm font-semibold flex items-center gap-1">
              Complete <CheckCircle2 size={13} />
            </p>
          )}
          <p className="text-lg font-semibold truncate">{completedLabel ?? workoutName}</p>
          {completedLabel && workoutName && <p className="text-slate-400 text-sm truncate">Scheduled: {workoutName}</p>}
        </button>
      ) : (
        <div className="grow flex items-center justify-between min-w-0">
          <span className="text-slate-400 text-lg">Rest</span>
          <button type="button" onClick={onAdd} className="flex items-center gap-1.5 text-blue-600 font-bold">
            <Plus size={18} className="bg-blue-600 text-white rounded-full p-0.5" /> Add Workout
          </button>
        </div>
      )}

      {menu}
    </div>
  )
}

function AssignWorkoutSheet({
  date,
  onClose,
  onOpenWorkout,
}: {
  date: string
  onClose: () => void
  onOpenWorkout: (id: string) => void
}) {
  const state = useAppState()
  const plan = activePlan(state)
  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-8">
        <h2 className="text-2xl font-bold">
          {formatAssignDate(date)} · Choose a workout
        </h2>
        {plan.cycle && (
          <p className="text-slate-400 text-sm mt-1">
            This program rotates every {plan.cycle.days.length} days — the change applies to this slot in every
            rotation.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {plan.workouts.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => {
                  actions.assignWorkoutToDate(date, w.id)
                  onClose()
                }}
                className="w-full flex items-center gap-4 bg-slate-100 rounded-2xl p-4 active:bg-slate-200"
              >
                <Dumbbell size={20} className="text-blue-600" />
                <span className="text-lg font-medium grow text-left">{w.name}</span>
                <span className="text-slate-400 text-sm">{w.exercises.length} exercises</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                const name = prompt('New workout name', 'New Workout')
                if (!name?.trim()) return
                const id = actions.addWorkout(name.trim(), null)
                actions.assignWorkoutToDate(date, id)
                onClose()
                onOpenWorkout(id)
              }}
              className="w-full flex items-center gap-4 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-blue-600 font-semibold active:bg-slate-100"
            >
              <Plus size={20} /> Create new workout
            </button>
          </li>
        </ul>
      </div>
    </Sheet>
  )
}

function formatAssignDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

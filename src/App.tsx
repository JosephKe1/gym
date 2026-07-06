import { useState } from 'react'
import { Dumbbell, TrendingUp, Settings as SettingsIcon, Play } from 'lucide-react'
import WeekView from './screens/WeekView'
import WorkoutDetail from './screens/WorkoutDetail'
import SessionView from './screens/SessionView'
import ProgressView from './screens/ProgressView'
import SettingsView from './screens/SettingsView'
import { actions, useAppState } from './lib/store'

type Tab = 'workout' | 'progress' | 'settings'

export default function App() {
  const state = useAppState()
  const [tab, setTab] = useState<Tab>('workout')
  const [openWorkoutId, setOpenWorkoutId] = useState<string | null>(null)
  const [inSession, setInSession] = useState(false)

  const showSession = inSession && state.activeSession !== null

  if (showSession) {
    return (
      <div className="max-w-lg mx-auto min-h-dvh">
        <SessionView onDone={() => setInSession(false)} />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto min-h-dvh">
      {tab === 'workout' &&
        (openWorkoutId ? (
          <WorkoutDetail
            workoutId={openWorkoutId}
            onBack={() => setOpenWorkoutId(null)}
            onStart={() => {
              if (!state.activeSession) actions.startSession(openWorkoutId)
              setInSession(true)
            }}
            onHistory={() => setTab('progress')}
          />
        ) : (
          <WeekView onOpenWorkout={(id) => setOpenWorkoutId(id)} />
        ))}
      {tab === 'progress' && <ProgressView />}
      {tab === 'settings' && <SettingsView />}

      {state.activeSession && (
        <button
          type="button"
          onClick={() => setInSession(true)}
          className="fixed bottom-20 inset-x-5 max-w-lg sm:mx-auto bg-slate-900 text-white rounded-2xl py-3.5 px-5 font-semibold shadow-xl flex items-center justify-center gap-2 z-40"
        >
          <Play size={16} fill="currentColor" /> Resume workout: {state.activeSession.workoutName}
        </button>
      )}

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)] z-30">
        <div className="max-w-lg mx-auto flex">
          {(
            [
              { key: 'workout', label: 'Workout', icon: Dumbbell },
              { key: 'progress', label: 'Progress', icon: TrendingUp },
              { key: 'settings', label: 'Settings', icon: SettingsIcon },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key)
                if (key === 'workout') setOpenWorkoutId(null)
              }}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
                tab === key ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronDown, X } from 'lucide-react'
import { actions, useAppState } from '../lib/store'
import { getExercise } from '../data/catalog'
import { EQUIPMENT_CATEGORIES, EQUIPMENT_ITEMS } from '../data/equipment'
import { type MuscleGroup } from '../lib/muscles'
import {
  BF_BANDS,
  GOAL_LABEL,
  recommendGoal,
  splitOptions,
  generatePlan,
  type BuilderAnswers,
  type Focus,
  type Gender,
  type Goal,
  type Level,
  type SplitOption,
  type StylePref,
} from '../lib/builder'
import type { Plan } from '../types'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const STEPS = [
  'goalPriority',
  'gender',
  'bodyFat',
  'goalRec',
  'level',
  'availability',
  'daysPerWeek',
  'focus',
  'style',
  'priority',
  'gymType',
  'equipment',
  'split',
  'preview',
] as const
type Step = (typeof STEPS)[number]

const GYM_PRESETS: { key: string; label: string; hint: string; equipment: string[] | 'all' | 'keep' }[] = [
  { key: 'full', label: 'Full Gym', hint: 'Fully equipped commercial gym', equipment: 'all' },
  {
    key: 'limited',
    label: 'Limited Gym',
    hint: 'Small gym with limited equipment',
    equipment: ['barbell', 'dumbbell', 'ez-bar', 'flat-bench', 'adjustable-bench', 'pull-up-bar', 'cable-machine', 'lat-pulldown', 'cable-row', 'leg-press', 'leg-extension', 'lying-leg-curl'],
  },
  { key: 'home', label: 'Home Gym', hint: 'Squat rack, barbell, dumbbells, bench', equipment: ['barbell', 'dumbbell', 'flat-bench', 'adjustable-bench', 'pull-up-bar', 'resistance-bands'] },
  { key: 'dumbbell', label: 'Dumbbells Only', hint: 'A set of dumbbells and a bench', equipment: ['dumbbell', 'flat-bench', 'adjustable-bench'] },
  { key: 'bands', label: 'Resistance Bands Only', hint: 'Work out anywhere with bands', equipment: ['resistance-bands', 'mini-bands'] },
  { key: 'bodyweight', label: 'Bodyweight Only', hint: 'Just your bodyweight (and maybe a pull-up bar)', equipment: ['pull-up-bar'] },
  { key: 'custom', label: 'Custom', hint: 'Keep my current equipment selection', equipment: 'keep' },
]

export default function ProgramBuilder({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { settings } = useAppState()
  const [stepIndex, setStepIndex] = useState(0)

  const [goalPriority, setGoalPriority] = useState<Goal | null>(null)
  const [gender, setGender] = useState<Gender | null>(null)
  const [bfIndex, setBfIndex] = useState(3)
  const [goal, setGoal] = useState<Goal | null>(null)
  const [level, setLevel] = useState<Level | null>(null)
  const [availableDays, setAvailableDays] = useState<number[]>([])
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [stylePref, setStylePref] = useState<StylePref | null>(null)
  const [priorityMuscle, setPriorityMuscle] = useState<MuscleGroup | null | 'all'>('all')
  const [equipment, setEquipment] = useState<string[]>(settings.equipment)
  const [chosenSplit, setChosenSplit] = useState<SplitOption | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)

  const step: Step = STEPS[stepIndex]
  const bf = BF_BANDS[bfIndex]
  const rec = useMemo(
    () => (goalPriority && gender ? recommendGoal(gender, bf.value, goalPriority) : null),
    [goalPriority, gender, bf],
  )

  const answers = (): BuilderAnswers => ({
    gender: gender ?? 'na',
    bodyFat: bf.value,
    goal: goal ?? 'build',
    level: level ?? 'intermediate',
    availableDays,
    daysPerWeek: daysPerWeek ?? Math.min(availableDays.length, 5),
    focus: focus ?? 'balanced',
    stylePref: stylePref ?? 'any',
    priorityMuscle: priorityMuscle === 'all' ? null : priorityMuscle,
    equipment,
  })

  const splits = useMemo(
    () => (step === 'split' || step === 'preview' ? splitOptions(answers()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, daysPerWeek, level, focus, stylePref],
  )

  const canNext: boolean =
    (step === 'goalPriority' && goalPriority !== null) ||
    (step === 'gender' && gender !== null) ||
    step === 'bodyFat' ||
    (step === 'goalRec' && goal !== null) ||
    (step === 'level' && level !== null) ||
    (step === 'availability' && availableDays.length >= 2) ||
    (step === 'daysPerWeek' && daysPerWeek !== null) ||
    (step === 'focus' && focus !== null) ||
    (step === 'style' && stylePref !== null) ||
    step === 'priority' ||
    step === 'equipment' ||
    (step === 'split' && chosenSplit !== null)

  const next = () => {
    if (step === 'split' && chosenSplit) {
      setPlan(generatePlan(answers(), chosenSplit))
    }
    if (step === 'daysPerWeek' && daysPerWeek !== null && daysPerWeek > availableDays.length) {
      setDaysPerWeek(availableDays.length)
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  }
  const back = () => (stepIndex === 0 ? onClose() : setStepIndex((i) => i - 1))

  const option = (selected: boolean, onClick: () => void, label: string, hint?: string) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left ${
        selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white'
      }`}
    >
      <span
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400 text-transparent'
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-semibold">{label}</span>
        {hint && <span className={`block text-sm ${selected ? 'text-blue-500' : 'text-slate-400'}`}>{hint}</span>}
      </span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <header className="shrink-0 px-4 pt-4 pb-2 flex items-center gap-3">
        <button type="button" aria-label="Back" onClick={back} className="p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold grow">Create New Program</h1>
        <button type="button" aria-label="Close builder" onClick={onClose} className="p-1">
          <X size={24} />
        </button>
      </header>
      <div className="shrink-0 h-1.5 bg-slate-100">
        <div className="h-full bg-blue-600 transition-all" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="grow overflow-y-auto px-5 py-5">
        {step === 'goalPriority' && (
          <>
            <h2 className="text-3xl font-bold">What is most important to you right now?</h2>
            <div className="mt-5 space-y-3">
              {option(goalPriority === 'build', () => setGoalPriority('build'), 'Building more muscle')}
              {option(goalPriority === 'lose', () => setGoalPriority('lose'), 'Losing fat and getting to a lower body fat %')}
              {option(goalPriority === 'maintain', () => setGoalPriority('maintain'), 'Maintaining my current shape')}
            </div>
          </>
        )}

        {step === 'gender' && (
          <>
            <h2 className="text-3xl font-bold">What's your gender?</h2>
            <p className="text-slate-400 mt-2">Used only to calibrate body-fat reference ranges.</p>
            <div className="mt-5 space-y-3">
              {option(gender === 'male', () => setGender('male'), 'Male')}
              {option(gender === 'female', () => setGender('female'), 'Female')}
              {option(gender === 'na', () => setGender('na'), 'Prefer not to say')}
            </div>
          </>
        )}

        {step === 'bodyFat' && (
          <>
            <h2 className="text-3xl font-bold">My estimated body fat percentage is…</h2>
            <p className="text-slate-400 mt-2">Compare yourself against the descriptions — a rough estimate is fine.</p>
            <div className="mt-10 text-center">
              <p className="text-5xl font-bold text-blue-600">{bf.label}</p>
              <p className="text-slate-500 mt-3 min-h-12">{gender === 'female' ? bf.blurbFemale : bf.blurbMale}</p>
            </div>
            <input
              type="range"
              min={0}
              max={BF_BANDS.length - 1}
              step={1}
              value={bfIndex}
              onChange={(e) => setBfIndex(Number(e.target.value))}
              className="w-full mt-6 accent-blue-600 h-2"
            />
            <p className="text-slate-400 text-sm mt-2 text-center">Drag the slider to continue</p>
          </>
        )}

        {step === 'goalRec' && rec && (
          <>
            <h2 className="text-3xl font-bold">Thanks for answering!</h2>
            <p className="mt-4 text-lg">
              Based on your responses, we think the best goal for you is{' '}
              <span className="text-blue-600 font-bold">{GOAL_LABEL[rec.goal]}</span>.
            </p>
            <p className="mt-4 text-slate-600">{rec.reason}</p>
            <p className="mt-4 text-slate-600">That said, it's totally up to you.</p>
            <div className="mt-8 space-y-3">
              {(['build', 'lose', 'maintain'] as Goal[]).map((g) =>
                option(goal === g, () => setGoal(g), `Set my goal as ${GOAL_LABEL[g]}${g === rec.goal ? ' (recommended)' : ''}`),
              )}
            </div>
          </>
        )}

        {step === 'level' && (
          <>
            <h2 className="text-3xl font-bold">What's your training level?</h2>
            <div className="mt-5 space-y-3">
              {option(level === 'beginner', () => setLevel('beginner'), 'Beginner', 'New to lifting, or returning after a long break')}
              {option(level === 'intermediate', () => setLevel('intermediate'), 'Intermediate', '6+ months of consistent training')}
              {option(level === 'advanced', () => setLevel('advanced'), 'Advanced', 'Several years of consistent training')}
            </div>
          </>
        )}

        {step === 'availability' && (
          <>
            <h2 className="text-3xl font-bold">Availability</h2>
            <p className="text-slate-500 mt-2">
              Select the days of the week that you will <span className="text-blue-600 font-semibold">be able to work out</span>.
            </p>
            <p className="text-slate-400 italic mt-1">Choose a minimum of 2 days.</p>
            <div className="mt-5 space-y-3">
              {DAY_NAMES.map((day, i) =>
                option(
                  availableDays.includes(i),
                  () => setAvailableDays((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i])),
                  day,
                ),
              )}
            </div>
          </>
        )}

        {step === 'daysPerWeek' && (
          <>
            <h2 className="text-3xl font-bold">How many days per week would you like to work out?</h2>
            <p className="text-slate-400 italic mt-2">More isn't always better. Pick what you'll be most consistent with.</p>
            <div className="mt-5 space-y-3">
              {[2, 3, 4, 5, 6]
                .filter((n) => n <= availableDays.length)
                .map((n) => option(daysPerWeek === n, () => setDaysPerWeek(n), `${n} days per week`))}
            </div>
          </>
        )}

        {step === 'focus' && (
          <>
            <h2 className="text-3xl font-bold">What's most important to you?</h2>
            <p className="text-slate-500 mt-2">This will help determine the best workout split for you.</p>
            <div className="mt-5 space-y-3">
              {option(focus === 'balanced', () => setFocus('balanced'), 'Building both my upper and lower body equally')}
              {option(focus === 'upper', () => setFocus('upper'), 'Building my upper body')}
              {option(focus === 'lower', () => setFocus('lower'), 'Building my lower body')}
            </div>
          </>
        )}

        {step === 'style' && (
          <>
            <h2 className="text-3xl font-bold">What types of workouts do you prefer?</h2>
            <div className="mt-5 space-y-3">
              {option(stylePref === 'any', () => setStylePref('any'), 'No Preference', "I'm open to any type of workout style.")}
              {option(stylePref === 'full', () => setStylePref('full'), 'Full body', 'Train your whole body in each session.')}
              {option(
                stylePref === 'split',
                () => setStylePref('split'),
                'Target specific muscle groups each workout',
                'Focus on select muscles per session (e.g., upper body, legs, chest).',
              )}
            </div>
          </>
        )}

        {step === 'priority' && (
          <>
            <h2 className="text-3xl font-bold">What muscle group do you want to prioritize?</h2>
            <p className="text-slate-400 italic mt-2">
              Pick one and we'll add extra volume to it in your workouts. You can always change things later.
            </p>
            <div className="mt-5 space-y-3">
              {option(priorityMuscle === 'all', () => setPriorityMuscle('all'), 'I want to grow everything equally')}
              {(['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes'] as MuscleGroup[]).map((g) =>
                option(priorityMuscle === g, () => setPriorityMuscle(g), g),
              )}
            </div>
          </>
        )}

        {step === 'gymType' && (
          <>
            <h2 className="text-3xl font-bold">What type of gym do you typically work out in?</h2>
            <p className="text-slate-400 italic mt-2">We'll pre-select the equipment we assume you have.</p>
            <div className="mt-5 space-y-3">
              {GYM_PRESETS.map((p) =>
                option(
                  false,
                  () => {
                    if (p.equipment === 'all') setEquipment(EQUIPMENT_ITEMS.map((i) => i.key))
                    else if (p.equipment !== 'keep') setEquipment(p.equipment)
                    next()
                  },
                  p.label,
                  p.hint,
                ),
              )}
            </div>
          </>
        )}

        {step === 'equipment' && (
          <>
            <h2 className="text-3xl font-bold">What equipment do you have access to?</h2>
            <p className="text-slate-400 italic mt-2">
              We've highlighted the equipment we assume you have. Adjust as needed — it also becomes your picker filter.
            </p>
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <div key={cat} className="mt-5">
                <p className="text-xs font-bold text-slate-400 uppercase">{cat}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EQUIPMENT_ITEMS.filter((i) => i.category === cat).map(({ key, label }) => {
                    const on = equipment.includes(key)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setEquipment((e) => (on ? e.filter((x) => x !== key) : [...e, key]))}
                        className={`px-3.5 py-2 rounded-full text-sm font-semibold border-2 ${
                          on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 'split' && (
          <>
            <h2 className="text-3xl font-bold">Choose Your Workout Split</h2>
            <p className="text-slate-500 mt-2">
              Based on your {daysPerWeek}-day availability, {level} level, and preferences, here's what we recommend. You
              can always pick a different split.
            </p>
            <div className="mt-5 space-y-4">
              {splits.map((split, i) => {
                const selected = chosenSplit?.id === split.id
                return (
                  <button
                    key={split.id}
                    type="button"
                    onClick={() => setChosenSplit(split)}
                    className={`w-full text-left rounded-2xl border-2 p-4 ${
                      selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {i === 0 && (
                      <span className="inline-block text-xs font-bold text-green-700 border border-green-400 bg-green-50 rounded-full px-3 py-1 mb-2">
                        RECOMMENDED
                      </span>
                    )}
                    <p className="font-bold text-lg">{split.name}</p>
                    <p className="text-slate-500 text-sm mt-1">{split.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {split.days.map((d, j) => (
                        <span key={j} className="text-xs font-bold text-slate-500 bg-slate-200/70 rounded-md px-2.5 py-1.5 uppercase">
                          {d.replace('_', ' ').replace('lower quad', 'lower (quad)').replace('lower glute', 'lower (glute)')}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {step === 'preview' && plan && (
          <PreviewStep
            plan={plan}
            splitName={chosenSplit?.name ?? ''}
            onRename={(name) => setPlan({ ...plan, name })}
            onStart={() => {
              actions.setEquipment(equipment)
              actions.addGeneratedPlan(plan, true)
              onDone()
            }}
            onSave={() => {
              actions.setEquipment(equipment)
              actions.addGeneratedPlan(plan, false)
              onDone()
            }}
          />
        )}
      </div>

      {step !== 'gymType' && step !== 'preview' && (
        <div className="shrink-0 px-5 py-4 border-t border-slate-100">
          <button
            type="button"
            disabled={!canNext}
            onClick={next}
            className="w-full bg-blue-600 text-white text-lg font-bold rounded-full py-4 active:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {step === 'split' ? 'Generate Program' : 'Next'}
          </button>
        </div>
      )}
    </div>
  )
}

function PreviewStep({
  plan,
  splitName,
  onRename,
  onStart,
  onSave,
}: {
  plan: Plan
  splitName: string
  onRename: (name: string) => void
  onStart: () => void
  onSave: () => void
}) {
  const [openDay, setOpenDay] = useState<string | null>(null)
  return (
    <>
      <p className="text-slate-500">{splitName}</p>
      <button
        type="button"
        className="flex items-start gap-3 mt-1 text-left"
        onClick={() => {
          const name = prompt('Program name', plan.name)
          if (name?.trim()) onRename(name.trim())
        }}
      >
        <h2 className="text-3xl font-bold">{plan.name}</h2>
        <span className="text-slate-400 mt-2">✎</span>
      </button>
      <p className="text-slate-500 mt-2">{plan.subtitle}</p>

      <div className="flex gap-3 mt-5">
        <button type="button" onClick={onStart} className="bg-blue-600 text-white font-bold rounded-full px-6 py-3.5 active:bg-blue-700">
          Start This Program
        </button>
        <button type="button" onClick={onSave} className="border-2 border-blue-500 text-blue-600 font-bold rounded-full px-6 py-3 active:bg-blue-50">
          Save to Library
        </button>
      </div>

      <div className="mt-6 space-y-3 pb-8">
        {plan.schedule.map((workoutId, i) => {
          if (!workoutId) return null
          const workout = plan.workouts.find((w) => w.id === workoutId)
          if (!workout) return null
          const open = openDay === workout.id
          return (
            <div key={workout.id} className="bg-slate-100 rounded-2xl p-4">
              <button type="button" onClick={() => setOpenDay(open ? null : workout.id)} className="w-full flex items-center justify-between text-left">
                <span>
                  <span className="block text-slate-400 text-sm">{DAY_NAMES[i]}</span>
                  <span className="block text-xl font-bold">{workout.name}</span>
                </span>
                <ChevronDown size={20} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <ul className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
                  {workout.exercises.map((e) => {
                    const ex = getExercise(e.exerciseId)
                    return (
                      <li key={e.id} className="text-slate-600 text-sm flex justify-between gap-2">
                        <span className="truncate">{ex?.name ?? e.exerciseId}</span>
                        <span className="text-slate-400 shrink-0">
                          {e.sets} × {e.repsMin}-{e.repsMax}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

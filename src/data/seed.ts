import type { Plan, PlanExercise } from '../types'

let slot = 0
function pe(
  exerciseId: string,
  sets: number,
  repsMin: number,
  repsMax: number,
  opts: { perSide?: boolean } = {},
): PlanExercise {
  slot += 1
  return { id: `seed-${slot}`, exerciseId, sets, repsMin, repsMax, perSide: opts.perSide ?? false, supersetWith: null }
}

/** A 5-day Upper / Lower / Push / Pull / Legs split to start from. Fully editable in the app. */
export function seedPlan(): Plan {
  return {
    id: 'plan-seed',
    name: 'Intermediate: 5-Day ULPPL Plan',
    subtitle: 'Intermediate · Build Muscle',
    createdAt: Date.now(),
    workouts: [
      {
        id: 'w-upper',
        name: 'Upper',
        exercises: [
          pe('Barbell_Bench_Press_-_Medium_Grip', 3, 6, 10),
          pe('Bent_Over_Barbell_Row', 3, 6, 10),
          pe('Dumbbell_Shoulder_Press', 2, 8, 12),
          pe('Full_Range-Of-Motion_Lat_Pulldown', 2, 8, 12),
          pe('Side_Lateral_Raise', 2, 10, 15),
          pe('Triceps_Pushdown_-_Rope_Attachment', 2, 10, 15),
        ],
      },
      {
        id: 'w-lower1',
        name: 'Lower 1 (Quad Focused)',
        exercises: [
          pe('Barbell_Squat', 3, 6, 10),
          pe('Leg_Press', 3, 8, 12),
          pe('Dumbbell_Lunges', 2, 8, 12, { perSide: true }),
          pe('Leg_Extensions', 3, 10, 15),
          pe('Standing_Calf_Raises', 3, 10, 15),
          pe('Cable_Crunch', 3, 10, 15),
        ],
      },
      {
        id: 'w-push',
        name: 'Push',
        exercises: [
          pe('Incline_Dumbbell_Press', 3, 6, 10),
          pe('Barbell_Shoulder_Press', 3, 8, 12),
          pe('Dumbbell_Bench_Press', 3, 8, 12),
          pe('Side_Lateral_Raise', 3, 10, 15),
          pe('Triceps_Pushdown_-_Rope_Attachment', 2, 10, 15),
          pe('Cable_Rope_Overhead_Triceps_Extension', 2, 10, 15),
        ],
      },
      {
        id: 'w-pull',
        name: 'Pull',
        exercises: [
          pe('Pullups', 3, 6, 10),
          pe('Seated_Cable_Rows', 3, 10, 15),
          pe('Cable_Rear_Delt_Fly', 3, 10, 15),
          pe('One_Arm_Dumbbell_Preacher_Curl', 2, 8, 12, { perSide: true }),
          pe('Alternate_Hammer_Curl', 2, 8, 12),
          pe('Face_Pull', 2, 10, 15),
        ],
      },
      {
        id: 'w-lower2',
        name: 'Lower 2 (Glute Focused)',
        exercises: [
          pe('Barbell_Hip_Thrust', 3, 8, 12),
          pe('Romanian_Deadlift', 3, 6, 10),
          pe('Dumbbell_Rear_Lunge', 2, 8, 12, { perSide: true }),
          pe('Lying_Leg_Curls', 3, 10, 15),
          pe('Glute_Kickback', 2, 10, 15, { perSide: true }),
          pe('Barbell_Seated_Calf_Raise', 3, 10, 15),
        ],
      },
    ],
    // Mon..Sun
    schedule: ['w-upper', 'w-lower1', null, 'w-push', 'w-pull', 'w-lower2', null],
  }
}

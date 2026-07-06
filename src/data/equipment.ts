import type { CatalogExercise } from '../types'

// Fine-grained equipment taxonomy (modeled on the BWS list). Each item knows
// how to match catalog exercises: by the catalog's coarse equipment field,
// by a name pattern, or both. Custom exercises store the item key directly.

export type EquipmentCategory = 'Free Weights' | 'Machines' | 'Other'

export interface EquipmentItem {
  key: string
  label: string
  category: EquipmentCategory
  /** Catalog coarse equipment values this item covers (empty = any). */
  coarse: string[]
  /** Name pattern that must also match (undefined = coarse match is enough). */
  pattern?: RegExp
}

export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  // ----- Free weights -----
  { key: 'barbell', label: 'Barbell', category: 'Free Weights', coarse: ['barbell'] },
  { key: 'dumbbell', label: 'Dumbbell', category: 'Free Weights', coarse: ['dumbbell'] },
  { key: 'ez-bar', label: 'EZ Bar', category: 'Free Weights', coarse: ['e-z curl bar'] },
  { key: 'kettlebell', label: 'Kettle Bell', category: 'Free Weights', coarse: ['kettlebells'] },
  { key: 'landmine', label: 'Landmine Attachment', category: 'Free Weights', coarse: [], pattern: /landmine/i },
  { key: 'trap-bar', label: 'Trap Bar', category: 'Free Weights', coarse: [], pattern: /trap bar/i },

  // ----- Machines -----
  { key: 'cable-machine', label: 'Cable Machine', category: 'Machines', coarse: ['cable'] },
  { key: 'cable-row', label: 'Cable Row', category: 'Machines', coarse: ['cable'], pattern: /row/i },
  { key: 'lat-pulldown', label: 'Lat Pulldown Cable', category: 'Machines', coarse: ['cable'], pattern: /pull-?down/i },
  { key: 'smith-machine', label: 'Smith Machine', category: 'Machines', coarse: [], pattern: /smith/i },
  { key: 'leg-press', label: 'Leg Press Machine', category: 'Machines', coarse: ['machine'], pattern: /leg press/i },
  { key: 'hack-squat', label: 'Hack Squat Machine', category: 'Machines', coarse: ['machine'], pattern: /hack/i },
  { key: 'leg-extension', label: 'Leg Extension Machine', category: 'Machines', coarse: ['machine'], pattern: /leg extension/i },
  { key: 'lying-leg-curl', label: 'Lying Leg Curl Machine', category: 'Machines', coarse: ['machine'], pattern: /lying leg curl/i },
  { key: 'seated-leg-curl', label: 'Seated Leg Curl Machine', category: 'Machines', coarse: ['machine'], pattern: /seated leg curl|standing leg curl/i },
  { key: 'chest-press-machine', label: 'Chest Press Machine', category: 'Machines', coarse: ['machine'], pattern: /chest press|bench press/i },
  { key: 'chest-fly-machine', label: 'Chest Fly / Pec Deck', category: 'Machines', coarse: ['machine'], pattern: /fly|pec|butterfly/i },
  { key: 'shoulder-press-machine', label: 'Shoulder Press Machine', category: 'Machines', coarse: ['machine'], pattern: /shoulder press/i },
  { key: 'dip-machine', label: 'Dip Machine', category: 'Machines', coarse: ['machine'], pattern: /dip/i },
  { key: 'back-extension-machine', label: 'Back Extension Machine', category: 'Machines', coarse: ['machine', 'other'], pattern: /back extension|hyperextension/i },
  { key: 'back-row-machine', label: 'Back Machine Row', category: 'Machines', coarse: ['machine'], pattern: /row/i },
  { key: 'hip-abduction', label: 'Hip Abduction/Adduction', category: 'Machines', coarse: ['machine'], pattern: /abduct|adduct|thigh/i },
  { key: 'hip-thrust-machine', label: 'Hip Thrust Machine', category: 'Machines', coarse: ['machine'], pattern: /hip thrust|glute/i },
  { key: 'calves-machine', label: 'Calf Raise Machine', category: 'Machines', coarse: ['machine'], pattern: /calf|calves/i },
  { key: 'plate-loaded-press', label: 'Plate Loaded Press', category: 'Machines', coarse: ['machine'], pattern: /leverage (chest|incline|decline|shoulder|bench)/i },
  { key: 'plate-loaded-row', label: 'Plate Loaded Row', category: 'Machines', coarse: ['machine'], pattern: /leverage.*row|leverage.*pull/i },
  { key: 'other-machines', label: 'Other Machines', category: 'Machines', coarse: ['machine'] },

  // ----- Other -----
  { key: 'pull-up-bar', label: 'Pull-up Bar', category: 'Other', coarse: [], pattern: /pull-?up|chin-?up|hanging/i },
  { key: 'dip-station', label: 'Dip Station', category: 'Other', coarse: [], pattern: /\bdip/i },
  { key: 'flat-bench', label: 'Flat Bench', category: 'Other', coarse: [], pattern: /bench/i },
  { key: 'adjustable-bench', label: 'Adjustable Bench', category: 'Other', coarse: [], pattern: /incline|decline/i },
  { key: 'swiss-ball', label: 'Swiss Ball', category: 'Other', coarse: ['exercise ball'] },
  { key: 'resistance-bands', label: 'Resistance Bands', category: 'Other', coarse: ['bands'] },
  { key: 'mini-bands', label: 'Mini-bands', category: 'Other', coarse: ['bands'], pattern: /mini/i },
  { key: 'medicine-ball', label: 'Medicine Ball', category: 'Other', coarse: ['medicine ball'] },
  { key: 'foam-roller', label: 'Foam Roller', category: 'Other', coarse: ['foam roll'] },
  { key: 'ab-roller', label: 'Ab Roller', category: 'Other', coarse: [], pattern: /ab roller|wheel/i },
  { key: 'ghd', label: 'Glute Ham Developer', category: 'Other', coarse: [], pattern: /glute-?ham/i },
  { key: 'box', label: 'Box', category: 'Other', coarse: [], pattern: /\bbox\b/i },
  { key: 'none-other', label: 'None / Other', category: 'Other', coarse: ['other', ''] },
]

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = ['Free Weights', 'Machines', 'Other']

const byKey = new Map(EQUIPMENT_ITEMS.map((i) => [i.key, i]))

export function equipmentLabel(key: string): string {
  return byKey.get(key)?.label ?? key
}

function itemMatches(item: EquipmentItem, ex: CatalogExercise): boolean {
  if (item.coarse.length > 0 && !item.coarse.includes(ex.equipment)) return false
  if (item.pattern && !item.pattern.test(ex.name)) return false
  return true
}

/**
 * True if the exercise can be done with the selected equipment.
 * Bodyweight-only exercises always pass. Custom exercises store an item key
 * in their equipment field and match on it exactly.
 */
export function matchesEquipment(ex: CatalogExercise, selectedKeys: string[]): boolean {
  if (ex.equipment === 'body only') return true
  if (byKey.has(ex.equipment)) {
    // custom exercise with a fine-grained key
    return selectedKeys.includes(ex.equipment) || ex.equipment === 'none-other'
  }
  return selectedKeys.some((key) => {
    const item = byKey.get(key)
    return item ? itemMatches(item, ex) : false
  })
}

/** Maps the old coarse equipment settings (state v2) onto the new item keys. */
export function migrateCoarseEquipment(old: string[]): string[] {
  const map: Record<string, string[]> = {
    barbell: ['barbell'],
    dumbbell: ['dumbbell'],
    'e-z curl bar': ['ez-bar'],
    kettlebells: ['kettlebell'],
    cable: ['cable-machine', 'cable-row', 'lat-pulldown'],
    machine: EQUIPMENT_ITEMS.filter((i) => i.category === 'Machines').map((i) => i.key),
    bands: ['resistance-bands', 'mini-bands'],
    'medicine ball': ['medicine-ball'],
    'exercise ball': ['swiss-ball'],
    'foam roll': ['foam-roller'],
    other: ['none-other'],
    'body only': [],
  }
  const out = new Set<string>()
  for (const key of old) {
    // already a fine key (idempotent re-migration)
    if (byKey.has(key)) out.add(key)
    for (const fine of map[key] ?? []) out.add(fine)
  }
  return [...out]
}

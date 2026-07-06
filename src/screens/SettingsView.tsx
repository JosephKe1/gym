import { useEffect, useRef, useState } from 'react'
import { Download, Upload, RotateCcw, ShieldCheck, Shield } from 'lucide-react'
import { actions, getState, useAppState } from '../lib/store'
import { EQUIPMENT_TYPES } from '../data/catalog'

export default function SettingsView() {
  const { settings, lastBackupAt } = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null))
  }, [])

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    actions.markBackup()
  }

  const importData = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const ok = actions.importState(String(reader.result))
      setMessage(ok ? 'Backup imported.' : 'Import failed — not a valid backup file.')
    }
    reader.readAsText(file)
  }

  return (
    <div className="pb-28 px-5">
      <h1 className="text-2xl font-bold pt-4">Settings</h1>

      <section className="mt-6 bg-white border border-slate-200 rounded-3xl p-5 space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">Weight unit</span>
          <div className="flex bg-slate-100 rounded-full p-1">
            {(['lb', 'kg'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => actions.setUnit(u)}
                className={`px-5 py-2 rounded-full font-semibold ${
                  settings.unit === u ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-lg font-medium">Rest timer</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease rest time"
              onClick={() => actions.setRestSec(Math.max(15, settings.restSec - 15))}
              className="w-10 h-10 rounded-full bg-slate-100 text-xl font-bold active:bg-slate-200"
            >
              −
            </button>
            <span className="font-bold text-lg w-16 text-center">
              {Math.floor(settings.restSec / 60)}:{String(settings.restSec % 60).padStart(2, '0')}
            </span>
            <button
              type="button"
              aria-label="Increase rest time"
              onClick={() => actions.setRestSec(Math.min(600, settings.restSec + 15))}
              className="w-10 h-10 rounded-full bg-slate-100 text-xl font-bold active:bg-slate-200"
            >
              +
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 bg-white border border-slate-200 rounded-3xl p-5">
        <h2 className="font-bold text-lg">My equipment</h2>
        <p className="text-slate-500 text-sm mt-1">
          Pick what you have access to. The exercise picker can then narrow its results to matching exercises
          (bodyweight moves are always included).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {EQUIPMENT_TYPES.map(({ key, label }) => {
            const on = settings.equipment.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => actions.toggleEquipment(key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 ${
                  on ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
        <label className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
          <span className="font-medium">Filter picker by my equipment</span>
          <input
            type="checkbox"
            checked={settings.filterByEquipment}
            onChange={(e) => actions.setFilterByEquipment(e.target.checked)}
            disabled={settings.equipment.length === 0}
            className="w-6 h-6 accent-blue-600"
          />
        </label>
        {settings.equipment.length === 0 && (
          <p className="text-slate-400 text-xs mt-2">Select at least one equipment type to enable filtering.</p>
        )}
      </section>

      <section className="mt-6 bg-white border border-slate-200 rounded-3xl p-5 space-y-3">
        <h2 className="font-bold text-lg">Your data</h2>
        <p className="text-slate-500 text-sm">
          Everything is stored in this browser (two copies: localStorage plus an IndexedDB mirror that auto-restores if
          one is cleared). For real safety, export a backup file now and then — especially before clearing browser data
          or switching devices.
        </p>

        <div className="flex items-center gap-2 text-sm">
          {persisted ? (
            <>
              <ShieldCheck size={16} className="text-green-600" />
              <span className="text-green-700">Browser granted persistent storage — data won't be auto-evicted.</span>
            </>
          ) : (
            <>
              <Shield size={16} className="text-slate-400" />
              <span className="text-slate-500">
                Persistent storage not confirmed by this browser — exports are your safety net.
              </span>
            </>
          )}
        </div>

        <p className="text-sm text-slate-500">
          Last backup:{' '}
          <span className="font-semibold text-slate-700">
            {lastBackupAt ? new Date(lastBackupAt).toLocaleDateString() : 'never'}
          </span>
        </p>

        <button
          type="button"
          onClick={exportData}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 rounded-2xl py-3.5 font-semibold active:bg-slate-200"
        >
          <Download size={18} /> Export backup
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 rounded-2xl py-3.5 font-semibold active:bg-slate-200"
        >
          <Upload size={18} /> Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) importData(f)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (confirm('Reset the app? This deletes your programs and all workout history.')) {
              actions.resetAll()
              setMessage('App reset to the starter plan.')
            }
          }}
          className="w-full flex items-center justify-center gap-2 text-red-600 bg-red-50 rounded-2xl py-3.5 font-semibold active:bg-red-100"
        >
          <RotateCcw size={18} /> Reset everything
        </button>
        {message && <p className="text-center text-sm text-slate-500">{message}</p>}
      </section>

      <p className="text-center text-slate-300 text-sm mt-8">
        Exercise catalog: free-exercise-db (public domain) · 873 exercises
      </p>
    </div>
  )
}

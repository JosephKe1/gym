# Gym

A clean, mobile-first workout tracker for personal use, inspired by the Built With Science app's UI. No accounts, no backend — everything lives in your browser's local storage.

## Features

- **Weekly schedule** — a dated Mon–Sun plan with workouts assigned per day, complete/missed/rest states, week-to-week navigation (browse past and future weeks), and a "today" banner. Comes seeded with a 5-day Upper/Lower/Push/Pull/Legs split; everything is editable.
- **Multiple programs** — build programs from scratch (weekly or rotating cycle), switch between them, rename, delete.
- **Guided program builder** — a BWS-style wizard (goal, body fat %, training level, availability, focus, style, priority muscle, gym type + equipment) that recommends a split, generates every workout from your equipment, and previews the program before you start it.
- **Rotating splits** — programs can repeat on an N-day cycle instead of a fixed weekly schedule (e.g. Push/Pull/Legs/Rest); the weekly view and calendar show each week's actual lineup, and the rotation can be shifted if you miss a day.
- **Equipment filter** — pick your available equipment from a categorized list (free weights, specific machines, benches, bands, etc.) and the exercise picker narrows to matching exercises.
- **Workout editor** — per-workout target-muscle breakdown (with %), and per-exercise menu: Swap, Remove, Edit Sets & Reps, Superset with…, reorder.
- **Exercise catalog** — 873 exercises from the public-domain [free-exercise-db](https://github.com/yuhonas/free-exercise-db), searchable and filterable by muscle group, with step-by-step instructions and photos.
- **Custom exercises** — create your own from the picker: name, equipment, tracking type (weight+reps / bodyweight / bodyweight+added / duration / reps only), primary and secondary muscles, default sets and rep range.
- **Per-exercise rest times** — override the global rest timer for any exercise via Edit Sets & Reps; the session timer uses it automatically.
- **Session logging** — per-set weight, reps (or time for planks/cardio/stretches), effort rating (Easy / Ideal / Max), and a set-completion checkmark that auto-starts a **rest timer** (adjustable ±15s, skippable, vibrates when done). Shows what you lifted last time. An in-progress session survives page reloads.
- **Progress** — top-set weight chart per exercise, plus full session history with volume and duration.
- **Settings** — lb/kg, default rest duration, equipment selection, JSON export/import backup, full reset.
- **Data safety** — state is written to localStorage plus an IndexedDB mirror that auto-restores if localStorage is cleared; the app requests persistent storage from the browser and nudges you to export a backup every few weeks.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Open it on your phone (same Wi-Fi): `npm run dev -- --host`, then visit the LAN URL it prints. Add it to your home screen for an app-like experience.

## Deploy to GitHub Pages

A workflow (`.github/workflows/deploy.yml`) builds and publishes the app to GitHub Pages on every push to `main`. Enable it once in the repo settings: **Settings → Pages → Source: GitHub Actions**. Your tracker will be live at `https://<user>.github.io/gym/`.

Note: data is per-browser. Use **Settings → Export backup** in the app to move data between devices.

## Stack

Vite · React · TypeScript · Tailwind CSS · lucide-react. State is a small hand-rolled store persisted to `localStorage` (`src/lib/store.ts`).

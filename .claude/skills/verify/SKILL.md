# Verify: gym workout tracker

Single-page Vite + React app, no backend. All state in localStorage.

## Build & launch

```bash
npm install
npm run build                      # tsc -b && vite build — must pass
npm run dev -- --port 5173 --host 127.0.0.1 &   # dev server
```

## Drive (Playwright, chromium at /opt/pw-browsers/chromium)

Use a 390×844 viewport. Key flows to exercise:

1. Week view: `text=This Week's Schedule`; today's banner button is `Start` (fresh state) or `View Workout` (after a finished session today).
2. Workout detail: click a workout name in the schedule list → `text=Target Muscles`. Kebab menus are `button[aria-label="More options"]`.
3. Exercise picker: `button[aria-label="Add exercise"]`. Sheet root is `div.z-50` — scope all picker selectors to it (background content stays in the DOM). The All/Muscle tabs need `exact: true` (many exercise names contain "All"/"Back").
4. Session: `button:has-text("Start Workout")` → fill `input[type="number"]` fields, effort chip cycles `– – –` → Easy → Ideal → Max, check `button[aria-label="Mark set complete"]` → rest-timer bar appears (`text=Skip`).
5. Finishing with unlogged sets fires a `confirm` dialog — arm `page.once('dialog', d => d.accept())` first. After finish-from-resume the app lands on the week view (back stack resets on reload).
6. Persistence: reload mid-session → `text=Resume workout` bar must appear.

## Gotchas

- Each Playwright launch has fresh localStorage — seed state by driving the UI, don't assume prior runs persist.
- Exercise photos load from raw.githubusercontent.com and hang (never error) through the sandbox proxy — thumbnails show muscle-group badges instead; this is expected here, not a bug.
- Day statuses depend on the real current date (Mon-first week).

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrapStore } from './lib/store'

// Restores from the IndexedDB mirror if localStorage was wiped, and asks the
// browser for persistent storage, before first render.
bootstrapStore().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// H1 FIX: Removed BrowserRouter — the app uses a custom useState-based
// navigation system (no URL routing). BrowserRouter was dead weight in the bundle.
// When URL-based routing is needed in a future version, add react-router then.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

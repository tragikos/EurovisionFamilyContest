import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Firestore's realtime connection retries silently after a network blip
// (common on mobile switching between wifi/cellular) - that transient
// failure otherwise surfaces as a scary uncaught "Failed to fetch" error
// even though the SDK recovers on its own and the app keeps working.
window.addEventListener('unhandledrejection', (event) => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
  if (message.includes('Failed to fetch')) {
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

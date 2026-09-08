import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'
import './styles/global.css'

async function prepare() {
  // Mock replies are useful for isolated component work, but must be explicitly
  // enabled. Normal local development should exercise the real local API.
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_USE_MSW === 'true'
  ) {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  }
}

void prepare().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import App from './App'
import './styles/global.css'

async function prepare() {
  // Chunk 6: MSW only in local Vite + mock API base (never in production builds)
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_API_BASE_URL === '/api'
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

import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { PatientPage } from './pages/PatientPage'
import { InsightsPage } from './pages/InsightsPage'
import { DoctorsPage } from './pages/DoctorsPage'
import type { ReactNode } from 'react'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading, bypass } = useAuth()
  if (loading) return <p className="muted">Loading…</p>
  if (!user && !bypass) return <Navigate to="/login" replace />
  if (!user) return <Navigate to="/login" replace />
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <HomePage />
          </Protected>
        }
      />
      <Route
        path="/patient/:patientId"
        element={
          <Protected>
            <PatientPage />
          </Protected>
        }
      />
      <Route
        path="/insights"
        element={
          <Protected>
            <InsightsPage />
          </Protected>
        }
      />
      <Route
        path="/doctors"
        element={
          <Protected>
            <DoctorsPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

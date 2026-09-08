import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { AppShell } from './components/AppShell'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { PatientPage } from './pages/PatientPage'
import { InsightsPage } from './pages/InsightsPage'
import { ContinuityActionPage } from './pages/ContinuityActionPage'
import { PatientsPage } from './pages/PatientsPage'
import { WorkHistoryPage } from './pages/WorkHistoryPage'
import { WorkHistoryDetailPage } from './pages/WorkHistoryDetailPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
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
      <Route path="/today" element={<Navigate to="/" replace />} />
      <Route path="/continuity/:cardId" element={<Protected><ContinuityActionPage /></Protected>} />
      <Route path="/patients" element={<Protected><PatientsPage /></Protected>} />
      <Route path="/history" element={<Protected><WorkHistoryPage /></Protected>} />
      <Route path="/history/:eventId" element={<Protected><WorkHistoryDetailPage /></Protected>} />
      <Route path="/account" element={<Protected><AccountSettingsPage /></Protected>} />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

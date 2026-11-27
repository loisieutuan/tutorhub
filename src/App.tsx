import { Routes, Route, Navigate } from 'react-router'

import AppLayout from './components/layout/AppLayout'
import StudentDashboard from './pages/StudentDashboard'
import AssignmentsPage from './pages/AssignmentsPage'

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route
          path="/"
          element={<StudentDashboard />}
        />

        <Route
          path="/assignments"
          element={<AssignmentsPage />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </AppLayout>
  )
}

export default App
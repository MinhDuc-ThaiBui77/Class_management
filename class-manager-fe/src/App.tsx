import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ToastProvider } from './components/Toast'
import Layout from './components/Layout'
import { lazy, Suspense } from 'react'

// Eager load: frequently used pages
import LoginPage from './pages/LoginPage'
import StudentsPage from './pages/StudentsPage'
import ReportPage from './pages/ReportPage'

// Lazy load: less frequently accessed pages
const TeachersPage = lazy(() => import('./pages/TeachersPage'))
const ClassesPage = lazy(() => import('./pages/ClassesPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { canAdmin } = useAuth()
  return canAdmin ? <>{children}</> : <Navigate to="/students" replace />
}

function AppRoutes() {
  const { token } = useAuth()
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/students" replace />} />
          <Route path="students"   element={<StudentsPage />} />
          <Route path="teachers"   element={<TeachersPage />} />
          <Route path="classes"    element={<ClassesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="payments"   element={<PaymentsPage />} />
          <Route path="reports"    element={<AdminRoute><ReportPage /></AdminRoute>} />
          <Route path="accounts"   element={<AdminRoute><AccountsPage /></AdminRoute>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

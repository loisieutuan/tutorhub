
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import TutorAssignmentForm from './components/assignments/TutorAssignmentForm'
import TutorGrading from './pages/TutorGrading'
import {
  Navigate,
  Route,
  Routes,
} from 'react-router'

import {
  GraduationCap,
  LoaderCircle,
  LogOut,
  ShieldCheck,
} from 'lucide-react'

import { supabase } from './lib/supabase'

import {
  getOwnProfile,
  roleLabels,
  signOut,
  type UserProfile,
} from './lib/auth'

import { loadAssignments, type Assignment } from './data/assignments'
import { messageOf } from './lib/submission'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import StudentDashboard from './pages/StudentDashboard'
import AssignmentsPage from './pages/AssignmentsPage'
import AssignmentDetailPage from './pages/AssignmentDetailPage'

// ==========================================
// PROFILE STATE
// ==========================================

type ProfileState =
  | { status: 'loading' }
  | { status: 'ready'; profile: UserProfile }
  | { status: 'error'; message: string }

// ==========================================
// LOADING SCREEN
// ==========================================

function LoadingScreen() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50">

      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-white">
        <GraduationCap size={30} />
      </div>

      <h1 className="text-xl font-bold text-slate-900">
        LST Learning
      </h1>

      <div
        role="status"
        className="flex items-center gap-2 text-sm text-slate-500"
      >
        <LoaderCircle
          size={18}
          className="animate-spin"
        />

        Đang xác thực tài khoản...
      </div>

    </main>
  )
}

// ==========================================
// LOGOUT BUTTON
// ==========================================

function LogoutButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogout() {
    if (loading) return

    setLoading(true)
    setError('')

    try {
      await signOut()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Không thể đăng xuất.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">

      <button
        type="button"
        disabled={loading}
        onClick={handleLogout}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        <LogOut size={17} />

        {loading
          ? 'Đang đăng xuất...'
          : 'Đăng xuất'}
      </button>

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600"
        >
          {error}
        </p>
      )}

    </div>
  )
}

// ==========================================
// ACCOUNT BAR
// ==========================================

function AccountBar({
  profile,
}: {
  profile: UserProfile
}) {
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">

      <div className="flex min-w-0 items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
          <ShieldCheck size={22} />
        </div>

        <div className="min-w-0">

          <p className="text-xs text-slate-500">
            Tài khoản đang đăng nhập
          </p>

          <p className="break-words text-sm font-bold text-slate-900">
            {profile.full_name}
          </p>

          <p className="text-xs text-primary">
            {roleLabels[profile.role]}
            {profile.username
              ? ` · ${profile.username}`
              : ''}
          </p>

        </div>

      </div>

      <LogoutButton />

    </section>
  )
}

// ==========================================
// TUTOR AND PARENT TEMPORARY DASHBOARD
// ==========================================

function RoleHome({
  profile,
}: {
  profile: UserProfile
}) {
  const tutor = profile.role === 'tutor'

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8">

      <div className="mx-auto max-w-5xl">

        <div className="mb-6 flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
            <GraduationCap size={26} />
          </div>

          <div>

            <h1 className="text-xl font-extrabold text-slate-900">
              LST Learning
            </h1>

            <p className="text-xs text-slate-500">
              Never stop learning because life never stops teaching
            </p>

          </div>

        </div>

        <AccountBar profile={profile} />
        {tutor && <TutorAssignmentForm tutorId={profile.id} />}
        {tutor && <TutorGrading tutorId={profile.id} />}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">

          <p className="text-sm font-semibold text-primary">
            {tutor
              ? 'Tutor Dashboard'
              : 'Parent Dashboard'}
          </p>

          <h2 className="mt-3 break-words text-2xl font-bold text-slate-900">
            Xin chào, {profile.full_name}.
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Bạn đã đăng nhập đúng vai trò.
            Khu vực này sẽ được xây dựng
            trong những bước tiếp theo.
          </p>

        </section>

      </div>

    </main>
  )
}

// ==========================================
// AUTHENTICATED APPLICATION
// ==========================================

function SignedInApp({
  userId,
}: {
  userId: string
}) {
  const [state, setState] = useState<ProfileState>({
    status: 'loading',
  })

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        const profile = await getOwnProfile(userId)

        if (!cancelled) {
          setState({
            status: 'ready',
            profile,
          })
        }
      } catch (cause) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              cause instanceof Error
                ? cause.message
                : 'Không thể tải hồ sơ.',
          })
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [userId])

  if (state.status === 'loading') {
    return <LoadingScreen />
  }

  if (state.status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">

        <section
          role="alert"
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6"
        >

          <h1 className="text-xl font-bold text-slate-900">
            Không thể mở tài khoản
          </h1>

          <p className="mt-3 text-sm leading-6 text-red-700">
            {state.message}
          </p>

          <div className="mt-6 flex flex-wrap items-start gap-3">

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
            >
              Thử lại
            </button>

            <LogoutButton />

          </div>

        </section>

      </main>
    )
  }

  const profile = state.profile

  // Tutor va Parent

  if (profile.role !== 'student') {
    const homePath =
      profile.role === 'tutor'
        ? '/tutor'
        : '/parent'

    return (
      <Routes>

        <Route
          path={homePath}
          element={<RoleHome profile={profile} />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to={homePath}
              replace
            />
          }
        />

      </Routes>
    )
  }

  return <StudentArea profile={profile} />
}

function StudentArea({ profile }: { profile: UserProfile }) {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    loadAssignments(profile.id)
      .then(rows => { if (active) setAssignments(rows) })
      .catch(reason => { if (active) setError(messageOf(reason)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profile.id, attempt])

  function rememberDraft(assignmentId: string, submissionId: string) {
    setAssignments(rows => rows.map(row => row.id === assignmentId ? { ...row, submissionId } : row))
  }

  function reloadAssignments() {
    setLoading(true)
    setError('')
    setAttempt(value => value + 1)
  }

  return (
    <AppLayout name={profile.full_name}>
      <AccountBar profile={profile} />
      {loading ? <p role="status">Đang tải bài tập…</p> : error ? (
        <section role="alert">
          <p>{error}</p>
          <button onClick={() => { setLoading(true); setError(''); setAttempt(n => n + 1) }}>Thử lại</button>
        </section>
      ) : (
      <Routes>

        <Route
          path="/"
          element={<StudentDashboard assignments={assignments} name={profile.full_name} />}
        />

        <Route
          path="/assignments"
          element={<AssignmentsPage assignments={assignments} />}
        />

        <Route
          path="/assignments/:assignmentId"
          element={<AssignmentDetailPage assignments={assignments} onDraft={rememberDraft} onChanged={reloadAssignments} />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>

      )}
    </AppLayout>
  )
}

// ==========================================
// MAIN APP
// ==========================================

function App() {
  const [session, setSession] = useState<
    Session | null | undefined
  >(undefined)

  useEffect(() => {
    let active = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) {
          setSession(nextSession)
        }
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (session === undefined) {
    return <LoadingScreen />
  }

  if (session === null) {
    return (
      <Routes>

        <Route
          path="/login"
          element={<LoginPage />}
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
            />
          }
        />

      </Routes>
    )
  }

  return (
    <SignedInApp
      key={session.user.id}
      userId={session.user.id}
    />
  )
}

export default App

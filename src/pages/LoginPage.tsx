
import { useState } from 'react'
import type { FormEvent } from 'react'

import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  Presentation,
  ShieldCheck,
  Users,
} from 'lucide-react'

import {
  signIn,
  type AccountRole,
} from '../lib/auth'

const roleOptions = [
  {
    value: 'tutor',
    label: 'Gia sư',
    icon: Presentation,
  },
  {
    value: 'student',
    label: 'Học sinh',
    icon: GraduationCap,
  },
  {
    value: 'parent',
    label: 'Phụ huynh',
    icon: Users,
  },
] as const

function LoginPage() {
  const [role, setRole] =
    useState<AccountRole>('student')

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function changeRole(nextRole: AccountRole) {
    setRole(nextRole)
    setIdentifier('')
    setPassword('')
    setShowPassword(false)
    setError('')
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (loading) return

    setLoading(true)
    setError('')

    try {
      await signIn(role, identifier, password)
      setPassword('')
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Không thể đăng nhập. Vui lòng thử lại.',
      )
    } finally {
      setLoading(false)
    }
  }

  const isTutor = role === 'tutor'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">

      <div className="w-full max-w-md">

        {/* Branding */}

        <div className="mb-8 text-center">

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white">
            <GraduationCap size={34} />
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
            LST Learning
          </h1>

          <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-slate-500">
            Never stop learning because life never stops teaching
          </p>

        </div>

        {/* Login Card */}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">

          <div className="text-center">

            <h2 className="text-2xl font-bold tracking-tight">
              Chào mừng bạn trở lại
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Đăng nhập để tiếp tục hành trình học tập.
            </p>

          </div>

          {/* Role Selection */}

          <div
            role="group"
            aria-label="Vai trò đăng nhập"
            className="mt-6 grid grid-cols-3 gap-2"
          >
            {roleOptions.map((option) => {
              const Icon = option.icon
              const active = role === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={loading}
                  aria-pressed={active}
                  onClick={() =>
                    changeRole(option.value)
                  }
                  className={`flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-blue-50 text-primary'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Icon size={23} />
                  {option.label}
                </button>
              )
            })}
          </div>

          {/* Login Form */}

          <form
            onSubmit={handleSubmit}
            className="mt-7 space-y-5"
          >

            <div>

              <label
                htmlFor="login-identifier"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                {isTutor
                  ? 'Địa chỉ email'
                  : 'Tên đăng nhập'}
              </label>

              <input
                id="login-identifier"
                type={isTutor ? 'email' : 'text'}
                required
                disabled={loading}
                value={identifier}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(event) =>
                  setIdentifier(event.target.value)
                }
                placeholder={
                  isTutor
                    ? 'Nhập email của gia sư'
                    : role === 'student'
                      ? 'Ví dụ: an12'
                      : 'Ví dụ: ph_an12'
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />

            </div>

            {/* Password */}

            <div>

              <label
                htmlFor="login-password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                {isTutor
                  ? 'Mật khẩu'
                  : 'Mã truy cập'}
              </label>

              <div className="relative">

                <input
                  id="login-password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  required
                  disabled={loading}
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder={
                    isTutor
                      ? 'Nhập mật khẩu'
                      : 'Nhập mã được gia sư cấp'
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-4 pr-12 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
                />

                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? 'Ẩn mật khẩu'
                      : 'Hiện mật khẩu'
                  }
                  aria-pressed={showPassword}
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>

              </div>

            </div>

            {/* Error */}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-700"
              >
                <AlertCircle
                  size={19}
                  className="mt-0.5 shrink-0"
                />

                <p>{error}</p>
              </div>
            )}

            {/* Submit */}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />

                  Đang đăng nhập...
                </>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight size={18} />
                </>
              )}
            </button>

          </form>

          {/* Account Information */}

          <div className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-5">

            <ShieldCheck
              size={19}
              className="mt-0.5 shrink-0 text-primary"
            />

            <p className="text-xs leading-5 text-slate-500">
              Tài khoản được cấp bởi LST Learning.
              Nếu quên thông tin đăng nhập, vui lòng
              liên hệ gia sư.
            </p>

          </div>

        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} LST Learning
        </p>

      </div>

    </main>
  )
}

export default LoginPage

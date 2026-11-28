import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Trophy,
  Gift,
  Users,
  MessageCircle,
  Settings,
  Bell,
  Flame,
  GraduationCap,
} from 'lucide-react'

type AppLayoutProps = {
  children: ReactNode
  name: string
}

// Menu trên máy tính.
// to: null nghĩa là mục đó chưa có trang riêng.
const navigationItems = [
  {
    label: 'Tổng quan',
    icon: LayoutDashboard,
    to: '/',
  },
  {
    label: 'Bài tập của tôi',
    icon: ClipboardList,
    to: '/assignments',
  },
  {
    label: 'Môn học',
    icon: BookOpen,
    to: null,
  },
  {
    label: 'Bảng xếp hạng',
    icon: Trophy,
    to: null,
  },
  {
    label: 'Cửa hàng phần thưởng',
    icon: Gift,
    to: null,
  },
  {
    label: 'Cộng đồng',
    icon: Users,
    to: null,
  },
]

// Menu trên điện thoại.
const mobileNavigationItems = [
  {
    label: 'Tổng quan',
    icon: LayoutDashboard,
    to: '/',
  },
  {
    label: 'Bài tập',
    icon: ClipboardList,
    to: '/assignments',
  },
  {
    label: 'Môn học',
    icon: BookOpen,
    to: null,
  },
  {
    label: 'Xếp hạng',
    icon: Trophy,
    to: null,
  },
  {
    label: 'Cộng đồng',
    icon: MessageCircle,
    to: null,
  },
]

function AppLayout({ children, name }: AppLayoutProps) {
  const initials = name.trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase()
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-white lg:flex">
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
            <GraduationCap size={24} />
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
              LST Learning
            </h1>

            <p className="text-xs leading-tight text-slate-500">
              Never stop learning because life never stops teaching
            </p>
          </div>
        </div>

        {/* Student profile */}
        <div className="mx-4 mt-6 flex items-center gap-3 rounded-[11px] bg-blue-50 p-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">
              {name}
            </p>

            <p className="text-xs text-slate-500">
              Học sinh
            </p>
          </div>
        </div>

        {/* Desktop navigation */}
        <nav
          aria-label="Menu học tập trên máy tính"
          className="flex-1 space-y-2 overflow-y-auto px-4 py-6"
        >
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Menu học tập
          </p>

          {navigationItems.map((item) => {
            const Icon = item.icon

            // Giữ nguyên cách hiển thị của các mục chưa có trang.
            if (item.to === null) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-500"
                >
                  <Icon size={19} aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
              )
            }

            // NavLink tự xác định mục đang được chọn theo URL.
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                    isActive
                      ? 'bg-blue-50 text-primary'
                      : 'text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={19} aria-hidden="true" />

                    <span>{item.label}</span>

                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="ml-auto h-2 w-2 rounded-full bg-primary"
                      />
                    )}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Sidebar bottom */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-500">
            <Settings size={19} />
            <span>Cài đặt</span>
          </div>

          <div className="mt-3 rounded-[11px] bg-blue-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Flame size={18} />

              <span className="text-sm font-bold">
                Giữ vững streak!
              </span>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              Học tập mỗi ngày để duy trì chuỗi thành tích của bạn.
            </p>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="min-h-screen lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-white/95 px-4 backdrop-blur-md sm:px-6 lg:h-20 lg:px-8">
          <div>
            <p className="text-xs text-slate-400 sm:text-sm">
              Thứ hai, ngày học mới
            </p>

            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
              Khu vực học tập
            </h2>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* XP */}
            <div className="hidden items-center gap-2 rounded-full bg-blue-50 px-3 py-2 sm:flex">
              <Trophy
                size={17}
                className="text-primary"
              />

              <span className="text-sm font-bold text-primary">
                1.250 XP
              </span>
            </div>

            {/* Streak */}
            <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-2">
              <Flame
                size={17}
                className="text-amber-700"
              />

              <span className="text-sm font-bold text-amber-700">
                7
              </span>
            </div>

            {/* Notification */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600">
              <Bell size={19} />

              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-600" />
            </div>

            {/* Avatar */}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Menu học tập trên điện thoại"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-2 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {mobileNavigationItems.map((item) => {
            const Icon = item.icon

            // Các mục chưa có trang tiếp tục hiển thị như trước.
            if (item.to === null) {
              return (
                <div
                  key={item.label}
                  className="flex min-w-0 flex-col items-center gap-1 px-2 py-2 text-[10px] font-semibold text-slate-400"
                >
                  <Icon size={21} aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
              )
            }

            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-w-0 flex-col items-center gap-1 px-2 py-2 text-[10px] font-semibold ${
                    isActive
                      ? 'text-primary'
                      : 'text-slate-400'
                  }`
                }
              >
                <Icon size={21} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export default AppLayout
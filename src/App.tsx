import {
  AlertCircle,
  Atom,
  CalendarDays,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Clock,
  Gift,
  Languages,
  ClipboardList,
} from 'lucide-react'

import AppLayout from './components/layout/AppLayout'

const assignments = [
  {
    subject: 'Toán học',
    title: 'Bài tập phương trình bậc hai',
    deadline: 'Hôm nay, 20:00',
    status: 'Hạn hôm nay',
    tone: 'urgent',
    icon: Calculator,
  },
  {
    subject: 'Tiếng Anh',
    title: 'IELTS Writing Task 1',
    deadline: 'Ngày mai, 21:00',
    status: 'Đang thực hiện',
    tone: 'warning',
    icon: Languages,
  },
  {
    subject: 'Vật lý',
    title: 'Bài tập chương Điện học',
    deadline: 'Thứ sáu, 20:00',
    status: 'Chưa bắt đầu',
    tone: 'neutral',
    icon: Atom,
  },
] as const

const assignmentTones = {
  urgent: {
    row: 'border-red-200 bg-red-50/40',
    deadline: 'text-red-600',
    status: 'bg-red-50 text-red-700',
  },
  warning: {
    row: 'border-amber-200',
    deadline: 'text-amber-700',
    status: 'bg-amber-50 text-amber-700',
  },
  neutral: {
    row: 'border-slate-200',
    deadline: 'text-slate-500',
    status: 'bg-slate-100 text-slate-600',
  },
  complete: {
    row: 'border-green-200',
    deadline: 'text-green-700',
    status: 'bg-green-50 text-green-700',
  },
}

function App() {
  return (
    <AppLayout>
      <div className="space-y-8">

        {/* Welcome section */}
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-sm font-medium text-primary">
              Thứ hai · Chào buổi học mới!
            </p>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Xin chào, An.
            </h1>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Cùng ưu tiên các hạn nộp hôm nay để giữ nhịp học tập của bạn.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-[11px] bg-red-50 px-4 py-3">
            <CalendarDays className="text-red-600" size={20} />
            <div>
              <p className="text-xs text-red-700">Hạn nộp hôm nay</p>
              <p className="text-sm font-bold text-red-700">
                1 bài tập · 20:00
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">

          <div className="rounded-[11px] border border-border bg-white p-4 sm:p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <ClipboardList size={21} />
            </div>
            <p className="text-sm text-slate-500">Chưa nộp</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">3</p>
            <p className="mt-2 text-xs font-medium text-slate-500">Bài tập đang chờ nộp</p>
          </div>

          <div className="rounded-[11px] border border-border bg-white p-4 sm:p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock size={21} />
            </div>
            <p className="text-sm text-slate-500">Hạn hôm nay</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">1</p>
            <p className="mt-2 text-xs font-medium text-amber-700">Cần nộp trước 20:00</p>
          </div>

          <div className="rounded-[11px] border border-border bg-white p-4 sm:p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertCircle size={21} />
            </div>
            <p className="text-sm text-slate-500">Quá hạn</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">0</p>
            <p className="mt-2 text-xs font-medium text-slate-500">Không có bài quá hạn</p>
          </div>

          <div className="rounded-[11px] border border-border bg-white p-4 sm:p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <CheckCircle2 size={21} />
            </div>
            <p className="text-sm text-slate-500">Đã hoàn thành</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">18</p>
            <p className="mt-2 text-xs font-medium text-green-700">Trong tháng này</p>
          </div>

        </section>

        {/* Assignments */}
        <section className="rounded-[11px] border border-border bg-white p-5 sm:p-6">

          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Bài tập sắp đến hạn
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Danh sách và số liệu dưới đây chỉ mang tính minh họa.
              </p>
            </div>

            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              1 hạn hôm nay
            </span>
          </div>

          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.title}
                className={`flex flex-col gap-3 rounded-[11px] border p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between ${assignmentTones[assignment.tone].row}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <assignment.icon size={19} aria-hidden="true" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">
                      {assignment.title}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {assignment.subject}
                    </p>
                    <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${assignmentTones[assignment.tone].deadline}`}>
                      <CalendarDays size={14} />
                      {assignment.deadline}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${assignmentTones[assignment.tone].status}`}>
                    {assignment.status}
                  </span>

                  <ArrowRight size={18} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-blue-50"
            >
              Xem tất cả bài tập
              <ArrowRight size={16} />
            </button>
          </div>

        </section>

        {/* Learning progress */}
        <section className="grid gap-5 lg:grid-cols-2">

          <div className="rounded-[11px] border border-border bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Tiến độ học tập
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Hành trình chinh phục mục tiêu của bạn
            </p>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Level 5
              </span>
              <span className="text-sm font-bold text-primary">
                1.250 / 2.000 XP
              </span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[62.5%] rounded-full bg-primary" />
            </div>

            <p className="mt-3 text-xs text-slate-500">
              Còn 750 XP để đạt Level 6!
            </p>
          </div>

          <div className="rounded-[11px] border border-border bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">
                  Phần thưởng tiếp theo
                </p>
                <h2 className="mt-2 text-xl font-extrabold text-slate-900">
                  Voucher học tập
                </h2>
              </div>

              <GiftIcon />
            </div>

            <p className="mt-5 text-sm text-slate-500">
              Hoàn thành thử thách để nhận thêm điểm đổi thưởng.
            </p>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-[70%] rounded-full bg-primary" />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              70% hoàn thành
            </p>
          </div>

        </section>
      </div>
    </AppLayout>
  )
}

function GiftIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-primary">
      <Gift size={24} aria-hidden="true" />
    </div>
  )
}

export default App
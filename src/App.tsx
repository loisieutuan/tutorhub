import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileImage,
  FileText,
  FileType,
  Gift,
  ClipboardList,
} from 'lucide-react'

import AppLayout from './components/layout/AppLayout'
import {
  assignments,
  type Assignment,
} from './data/assignments'
import {
  formatDeadline,
  getAssignmentStats,
  getCountdownLabel,
  getDeadlineStatus,
  isSubmittedOnTime,
  type DeadlineStatus,
} from './lib/deadline'

type AssignmentFilter = 'pending' | 'today' | 'overdue' | 'submitted' | 'all'

const deadlineTones: Record<DeadlineStatus, {
  row: string
  deadline: string
  status: string
}> = {
  overdue: {
    row: 'border-red-200 bg-red-50/40',
    deadline: 'text-red-600',
    status: 'bg-red-50 text-red-700',
  },
  today: {
    row: 'border-amber-200',
    deadline: 'text-amber-700',
    status: 'bg-amber-50 text-amber-700',
  },
  upcoming: {
    row: 'border-slate-200',
    deadline: 'text-slate-500',
    status: 'bg-slate-100 text-slate-600',
  },
  submitted: {
    row: 'border-green-200',
    deadline: 'text-green-700',
    status: 'bg-green-50 text-green-700',
  },
}

const filterTitles: Record<AssignmentFilter, string> = {
  pending: 'Bài tập chưa nộp',
  today: 'Bài tập hạn hôm nay',
  overdue: 'Bài tập quá hạn',
  submitted: 'Bài tập đã nộp',
  all: 'Tất cả bài tập',
}

const emptyMessages: Record<AssignmentFilter, string> = {
  pending: 'Bạn không có bài tập nào đang chờ nộp.',
  today: 'Hôm nay không có bài tập đến hạn.',
  overdue: 'Tuyệt vời! Bạn không có bài tập quá hạn.',
  submitted: 'Bạn chưa có bài tập nào đã nộp.',
  all: 'Chưa có bài tập nào.',
}

function App() {
  const [now, setNow] = useState(() => Date.now())
  const [filter, setFilter] = useState<AssignmentFilter>('pending')

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const stats = getAssignmentStats(assignments, now)
  const displayedAssignments = assignments
    .filter((assignment) => {
      const status = getDeadlineStatus(assignment, now)

      switch (filter) {
        case 'pending':
          return assignment.submittedAt === null
        case 'today':
          return status === 'today'
        case 'overdue':
          return status === 'overdue'
        case 'submitted':
          return status === 'submitted'
        case 'all':
          return true
      }
    })
    .slice()
    .sort((first, second) => {
      const firstStatus = getDeadlineStatus(first, now)
      const secondStatus = getDeadlineStatus(second, now)

      if (firstStatus === 'submitted' && secondStatus !== 'submitted') {
        return 1
      }
      if (firstStatus !== 'submitted' && secondStatus === 'submitted') {
        return -1
      }

      return new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime()
    })

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
                {stats.today} bài tập đến hạn hôm nay
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">

          <button
            type="button"
            aria-pressed={filter === 'pending'}
            onClick={() => setFilter('pending')}
            className="w-full rounded-[11px] border border-border bg-white p-4 text-left sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <ClipboardList size={21} />
            </div>
            <p className="text-sm text-slate-500">Chưa nộp</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.pending}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">Bài tập đang chờ nộp</p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'today'}
            onClick={() => setFilter('today')}
            className="w-full rounded-[11px] border border-border bg-white p-4 text-left sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
              <Clock size={21} />
            </div>
            <p className="text-sm text-slate-500">Hạn hôm nay</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.today}</p>
            <p className="mt-2 text-xs font-medium text-amber-700">Bài tập cần nộp hôm nay</p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'overdue'}
            onClick={() => setFilter('overdue')}
            className="w-full rounded-[11px] border border-border bg-white p-4 text-left sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertCircle size={21} />
            </div>
            <p className="text-sm text-slate-500">Quá hạn</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.overdue}</p>
            <p className="mt-2 text-xs font-medium text-slate-500">Bài tập chưa nộp quá hạn</p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'submitted'}
            onClick={() => setFilter('submitted')}
            className="w-full rounded-[11px] border border-border bg-white p-4 text-left sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
              <CheckCircle2 size={21} />
            </div>
            <p className="text-sm text-slate-500">Đã nộp</p>
            <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.submitted}</p>
            <p className="mt-2 text-xs font-medium text-green-700">Bài tập đã gửi</p>
          </button>

        </section>

        {/* Assignments */}
        <section className="rounded-[11px] border border-border bg-white p-5 sm:p-6">

          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {filterTitles[filter]}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Danh sách bài tập và hạn nộp của bạn
              </p>
            </div>

            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
              {displayedAssignments.length} bài tập
            </span>
          </div>

          <div className="space-y-3">
            {displayedAssignments.length > 0 ? (
              displayedAssignments.map((assignment) => {
                const status = getDeadlineStatus(assignment, now)
                const tone = deadlineTones[status]
                const FileIcon = getFileIcon(assignment.fileType)

                return (
                  <div
                    key={assignment.id}
                    className={`flex flex-col gap-3 rounded-[11px] border p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between ${tone.row}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <FileIcon size={19} aria-hidden="true" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                          {assignment.title}
                        </h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {assignment.subject}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                          <FileIcon size={13} aria-hidden="true" />
                          {assignment.fileName}
                        </p>
                        <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${tone.deadline}`}>
                          <CalendarDays size={14} />
                          Hạn nộp: {formatDeadline(assignment.dueAt)}
                        </div>
                        <div className={`mt-1 flex items-center gap-1.5 text-xs font-medium ${tone.deadline}`}>
                          <Clock size={14} />
                          {getCountdownLabel(assignment, now)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone.status}`}>
                        {getAssignmentStatusLabel(assignment, status)}
                      </span>

                      <ArrowRight size={18} className="text-slate-400" />
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="rounded-[11px] border border-dashed border-border px-4 py-8 text-center text-sm text-slate-500">
                {emptyMessages[filter]}
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setFilter('all')}
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

function getFileIcon(fileType: Assignment['fileType']) {
  switch (fileType) {
    case 'image':
      return FileImage
    case 'pdf':
      return FileText
    case 'word':
      return FileType
  }
}

function getAssignmentStatusLabel(
  assignment: Assignment,
  status: DeadlineStatus,
) {
  if (status === 'submitted') {
    return isSubmittedOnTime(assignment) === true
      ? 'Đã nộp đúng hạn'
      : 'Đã nộp trễ'
  }

  if (status === 'overdue') {
    return 'Quá hạn'
  }

  if (status === 'today') {
    return 'Hạn hôm nay'
  }

  return 'Chưa đến hạn'
}

function GiftIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-primary">
      <Gift size={24} aria-hidden="true" />
    </div>
  )
}

export default App
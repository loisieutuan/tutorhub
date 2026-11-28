import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowRight,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileImage,
  FileText,
  FileType,
  Gift,
  ClipboardList,
  ClipboardCheck,
} from 'lucide-react'

import type { Assignment } from '../data/assignments'

import {
  attemptLabel, withdrawalLabel, formatDeadline,
  getAssignmentStats,
  getCountdownLabel,
  getDeadlineStatus,
  getDeadlineUrgency,
  type DeadlineUrgency,
} from '../lib/deadline'

type AssignmentFilter =
  | 'pending'
  | 'today'
  | 'overdue'
  | 'upcoming'
  | 'submitted'
  | 'graded'
  | 'all'

const urgencyTones: Record<
  DeadlineUrgency,
  {
    indicator: string
    icon: string
    countdown: string
    status: string
  }
> = {
  overdue: {
    indicator: 'border-l-red-700',
    icon: 'bg-red-50 text-red-700',
    countdown: 'text-red-700',
    status: 'bg-red-50 text-red-800',
  },
  critical: {
    indicator: 'border-l-red-600',
    icon: 'bg-red-50 text-red-600',
    countdown: 'text-red-600',
    status: 'bg-red-50 text-red-700',
  },
  approaching: {
    indicator: 'border-l-amber-700',
    icon: 'bg-amber-50 text-amber-700',
    countdown: 'text-amber-700',
    status: 'bg-amber-50 text-amber-700',
  },
  upcoming: {
    indicator: 'border-l-primary',
    icon: 'bg-blue-50 text-primary',
    countdown: 'text-primary',
    status: 'bg-blue-50 text-primary',
  },
  submitted: {
    indicator: 'border-l-green-700',
    icon: 'bg-green-50 text-green-700',
    countdown: 'text-green-700',
    status: 'bg-green-50 text-green-700',
  },
}

const quickFilters: {
  value: AssignmentFilter
  label: string
}[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'today', label: 'Hôm nay' },
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'submitted', label: 'Đã nộp' },
  { value: 'graded', label: 'Đã chấm bài' },
]

const emptyMessages: Record<AssignmentFilter, string> = {
  pending: 'Bạn không có bài tập nào đang chờ nộp.',
  today: 'Hôm nay không có bài tập đến hạn.',
  overdue: 'Tuyệt vời! Bạn không có bài tập quá hạn.',
  upcoming: 'Bạn không có bài tập sắp tới.',
  graded: 'Chưa có bài nào được gia sư trả kết quả.',
  submitted: 'Bạn chưa có bài tập nào đã nộp.',
  all: 'Chưa có bài tập nào.',
}

function StudentDashboard({ assignments, name }: { assignments: Assignment[]; name: string }) {
  const [now, setNow] = useState(() => Date.now())

  const [filter, setFilter] =
    useState<AssignmentFilter>('pending')

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

        case 'upcoming':
          return status === 'upcoming'

        case 'graded':
          return Boolean(assignment.returnedAt)

        case 'submitted':
          return status === 'submitted'

        case 'all':
          return true
      }
    })
    .slice()
    .sort((first, second) => {
      if (filter === 'graded' && first.returnedAt && second.returnedAt) {
        return Date.parse(second.returnedAt) - Date.parse(first.returnedAt)
      }
      const firstStatus = getDeadlineStatus(first, now)
      const secondStatus = getDeadlineStatus(second, now)

      if (
        firstStatus === 'submitted' &&
        secondStatus !== 'submitted'
      ) {
        return 1
      }

      if (
        firstStatus !== 'submitted' &&
        secondStatus === 'submitted'
      ) {
        return -1
      }

      return (
        new Date(first.dueAt).getTime() -
        new Date(second.dueAt).getTime()
      )
    })

  return (
    <>
      <div className="space-y-8">
        {/* Welcome section */}
        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-sm font-medium text-primary">
              Deadline Center
            </p>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Xin chào, {name}.
            </h1>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Cùng ưu tiên các hạn nộp hôm nay để giữ nhịp học
              tập của bạn.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-[11px] bg-red-50 px-4 py-3">
            <CalendarDays
              className="text-red-600"
              size={20}
            />

            <div>
              <p className="text-xs text-red-700">
                Hạn nộp hôm nay
              </p>

              <p className="text-sm font-bold text-red-700">
                {stats.today} bài tập đến hạn hôm nay
              </p>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <button
            type="button"
            aria-pressed={filter === 'pending'}
            onClick={() => setFilter('pending')}
            className="w-full rounded-[11px] border border-blue-200 bg-blue-50 p-4 text-left transition-colors hover:bg-blue-100 aria-pressed:border-blue-600 aria-pressed:ring-2 aria-pressed:ring-blue-600 focus-visible:outline-2 focus-visible:outline-offset-4 sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
              <ClipboardList size={21} />
            </div>

            <p className="text-sm font-semibold text-blue-900">
              Chưa nộp
            </p>

            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {stats.pending}
            </p>

            <p className="mt-2 text-xs font-medium text-blue-800">
              Bài tập đang chờ nộp
            </p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'today'}
            onClick={() => setFilter('today')}
            className="w-full rounded-[11px] border border-amber-200 bg-amber-50 p-4 text-left transition-colors hover:bg-amber-100 aria-pressed:border-amber-600 aria-pressed:ring-2 aria-pressed:ring-amber-600 focus-visible:outline-2 focus-visible:outline-offset-4 sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <Clock size={21} />
            </div>

            <p className="text-sm font-semibold text-amber-900">
              Hạn hôm nay
            </p>

            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {stats.today}
            </p>

            <p className="mt-2 text-xs font-medium text-amber-800">
              Bài tập cần nộp hôm nay
            </p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'overdue'}
            onClick={() => setFilter('overdue')}
            className="w-full rounded-[11px] border border-red-200 bg-red-50 p-4 text-left transition-colors hover:bg-red-100 aria-pressed:border-red-600 aria-pressed:ring-2 aria-pressed:ring-red-600 focus-visible:outline-2 focus-visible:outline-offset-4 sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-800">
              <AlertCircle size={21} />
            </div>

            <p className="text-sm font-semibold text-red-900">
              Quá hạn
            </p>

            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {stats.overdue}
            </p>

            <p className="mt-2 text-xs font-medium text-red-800">
              Bài tập chưa nộp quá hạn
            </p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'submitted'}
            onClick={() => setFilter('submitted')}
            className="w-full rounded-[11px] border border-green-200 bg-green-50 p-4 text-left transition-colors hover:bg-green-100 aria-pressed:border-green-600 aria-pressed:ring-2 aria-pressed:ring-green-600 focus-visible:outline-2 focus-visible:outline-offset-4 sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-800">
              <CheckCircle2 size={21} />
            </div>

            <p className="text-sm font-semibold text-green-900">
              Đã nộp
            </p>

            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {stats.submitted}
            </p>

            <p className="mt-2 text-xs font-medium text-green-800">
              Bài tập đã gửi
            </p>
          </button>

          <button
            type="button"
            aria-pressed={filter === 'graded'}
            onClick={() => setFilter('graded')}
            className="w-full rounded-[11px] border border-cyan-200 bg-cyan-50 p-4 text-left transition-colors hover:bg-cyan-100 aria-pressed:border-cyan-600 aria-pressed:ring-2 aria-pressed:ring-cyan-600 focus-visible:outline-2 focus-visible:outline-offset-4 sm:p-5"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-800">
              <ClipboardCheck size={21} />
            </div>

            <p className="text-sm font-semibold text-cyan-900">
              Đã chấm bài
            </p>

            <p className="mt-1 text-2xl font-extrabold text-slate-900">
              {assignments.filter(a => a.returnedAt).length}
            </p>

            <p className="mt-2 text-xs font-medium text-cyan-800">
              Gia sư đã trả kết quả
            </p>
          </button>
        </section>

        {/* Assignments */}
        <section className="rounded-[11px] border border-border bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <CalendarDays
                  size={20}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Deadline Center
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Quản lý thời hạn nộp bài của bạn
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              {displayedAssignments.length} bài tập
            </span>
          </div>

          {/* Quick filters */}
          <div
            className="mb-5 flex flex-wrap gap-2"
            role="group"
            aria-label="Lọc bài tập"
          >
            {quickFilters.map((quickFilter) => (
              <button
                key={quickFilter.value}
                type="button"
                aria-pressed={filter === quickFilter.value}
                onClick={() => setFilter(quickFilter.value)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                  filter === quickFilter.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {quickFilter.label}
              </button>
            ))}
          </div>

          {/* Assignment cards */}
          <div className="space-y-3">
            {displayedAssignments.length > 0 ? (
              displayedAssignments.map((assignment) => {
                const urgency = getDeadlineUrgency(
                  assignment,
                  now,
                )

                const tone = assignment.returnedAt
                  ? { ...urgencyTones[urgency], indicator: 'border-l-cyan-600', icon: 'bg-cyan-50 text-cyan-800', countdown: 'text-cyan-800' }
                  : urgencyTones[urgency]

                const FileIcon = getFileIcon(
                  assignment.fileType,
                )

                return (
                  <div
                    key={assignment.id}
                    className={`flex flex-col gap-3 rounded-[11px] border border-l-4 border-border bg-white p-4 transition-colors duration-200 hover:bg-slate-50 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between ${tone.indicator}`}
                  >
                    {/* Assignment information */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}
                      >
                        <FileIcon
                          size={19}
                          aria-hidden="true"
                        />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold leading-5 text-slate-900">
                          <Link to={`/assignments/${assignment.id}`}>{assignment.title}</Link>
                        </h3>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                          <span>{assignment.subject}</span>

                          <span aria-hidden="true">·</span>

                          <span className="inline-flex items-center gap-1">
                            <FileIcon
                              size={13}
                              aria-hidden="true"
                            />

                            {getFileTypeLabel(
                              assignment.fileType,
                            )}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
                          <CalendarDays size={14} />

                          <span>Hạn nộp:</span>

                          <time dateTime={assignment.dueAt}>
                            {formatDeadline(assignment.dueAt)}
                          </time>
                        </div>
                      </div>
                    </div>

                    {/* Countdown and submission status */}
                    <div className="flex min-w-0 flex-col items-start gap-2 border-t border-border pt-3 sm:min-w-[180px] sm:items-end sm:border-t-0 sm:pt-0">
                      {urgency === 'submitted' ? (
                        <p
                          className={`text-sm font-semibold tabular-nums ${tone.countdown}`}
                        >
                          {assignment.returnedAt ? 'Đã chấm bài' : 'Đã nộp'}
                          {(assignment.returnedAt || assignment.submittedAt)
                            ? ` · ${formatDeadline(
                                (assignment.returnedAt ?? assignment.submittedAt)!,
                              )}`
                            : ''}
                        </p>
                      ) : (
                        <p
                          className={`text-2xl font-bold leading-tight tracking-tight tabular-nums sm:text-3xl ${tone.countdown}`}
                        >
                          <Clock
                            className="mr-1 inline-block align-[-2px]"
                            size={18}
                            aria-hidden="true"
                          />

                          {getCountdownLabel(assignment, now)}
                        </p>
                      )}

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone.status}`}
                      >
                        {getAssignmentStatusLabel(
                          assignment,
                          urgency,
                        )}
                      </span>
                      {assignment.returnedAt && (
                        <Link to={`/assignments/${assignment.id}`}
                          className="rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-100">
                          Xem kết quả chấm
                        </Link>
                      )}
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

          {/* Navigate to Assignment Center */}
          <div className="mt-5 flex justify-center">
  <Link
    to="/assignments"
    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-blue-50"
  >
    Xem tất cả bài tập
    <ArrowRight size={16} />
  </Link>
</div>
        </section>

        {/* Learning progress */}
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[11px] border border-border bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Tiến độ học tập (minh họa)
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

          {/* Reward */}
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
              Hoàn thành thử thách để nhận thêm điểm đổi
              thưởng.
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
    </>
  )
}

function getFileIcon(fileType: Assignment['fileType']) {
  switch (fileType) {
    case 'image':
      return FileImage

    case 'pdf':
      return FileText

    case 'other':
      return FileText

    case 'word':
      return FileType
  }
}

function getFileTypeLabel(fileType: Assignment['fileType']) {
  switch (fileType) {
    case 'image':
      return 'Hình ảnh'

    case 'pdf':
      return 'PDF'

    case 'other':
      return 'Tệp đề'

    case 'word':
      return 'Word'
  }
}

function getAssignmentStatusLabel(
  assignment: Assignment,
  urgency: DeadlineUrgency,
) {
  if (urgency === 'submitted') {
    return attemptLabel(assignment.submittedAt!, assignment.submissionDeadline ?? assignment.dueAt)
  }

  const withdrawn = withdrawalLabel(assignment, urgency === 'overdue')
  if (withdrawn) return withdrawn

  if (urgency === 'overdue') {
    return 'Quá hạn'
  }

  if (urgency === 'critical') {
    return 'Sắp hết hạn'
  }

  if (urgency === 'approaching') {
    return 'Sắp đến hạn'
  }

  return 'Sắp tới'
}

function GiftIcon() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-primary">
      <Gift size={24} aria-hidden="true" />
    </div>
  )
}

export default StudentDashboard
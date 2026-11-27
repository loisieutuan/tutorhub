import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  Search,
  ClipboardList,
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  FileImage,
  FileText,
  FileType,
} from 'lucide-react'

import {
  assignments,
  type Assignment,
} from '../data/assignments'

import {
  formatDeadline,
  getAssignmentStats,
  getCountdownLabel,
  getDeadlineStatus,
  getDeadlineUrgency,
  isSubmittedOnTime,
  type DeadlineUrgency,
} from '../lib/deadline'

type StatusFilter =
  | 'all'
  | 'pending'
  | 'overdue'
  | 'today'
  | 'upcoming'
  | 'submitted'

type SortOption =
  | 'priority'
  | 'due-asc'
  | 'due-desc'
  | 'newest'

const statusFilters: {
  value: StatusFilter
  label: string
}[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chưa nộp' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'today', label: 'Hạn hôm nay' },
  { value: 'upcoming', label: 'Sắp tới' },
  { value: 'submitted', label: 'Đã nộp' },
]

const fileLabels: Record<Assignment['fileType'], string> = {
  image: 'Hình ảnh',
  pdf: 'PDF',
  word: 'Word',
}

const fileIcons = {
  image: FileImage,
  pdf: FileText,
  word: FileType,
}

const urgencyStyles: Record<
  DeadlineUrgency,
  {
    border: string
    text: string
    badge: string
    label: string
  }
> = {
  overdue: {
    border: 'border-l-red-700',
    text: 'text-red-700',
    badge: 'bg-red-50 text-red-800',
    label: 'Quá hạn',
  },
  critical: {
    border: 'border-l-red-600',
    text: 'text-red-600',
    badge: 'bg-red-50 text-red-700',
    label: 'Sắp hết hạn',
  },
  approaching: {
    border: 'border-l-amber-700',
    text: 'text-amber-700',
    badge: 'bg-amber-50 text-amber-800',
    label: 'Sắp đến hạn',
  },
  upcoming: {
    border: 'border-l-primary',
    text: 'text-primary',
    badge: 'bg-blue-50 text-primary',
    label: 'Sắp tới',
  },
  submitted: {
    border: 'border-l-green-700',
    text: 'text-green-700',
    badge: 'bg-green-50 text-green-700',
    label: 'Đã nộp',
  },
}

// Chuẩn hóa văn bản để tìm kiếm không phân biệt dấu và chữ hoa.
function normalizeSearch(value: string): string {
  return value
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

// Kiểm tra bài tập có thuộc nhóm trạng thái đang chọn hay không.
function matchesStatus(
  assignment: Assignment,
  filter: StatusFilter,
  now: number,
): boolean {
  if (filter === 'all') return true

  if (filter === 'pending') {
    return assignment.submittedAt === null
  }

  return getDeadlineStatus(assignment, now) === filter
}

// So sánh hai bài tập để xác định thứ tự hiển thị.
function compareAssignments(
  first: Assignment,
  second: Assignment,
  sort: SortOption,
): number {
  if (sort === 'priority') {
    const groupDifference =
      Number(first.submittedAt !== null) -
      Number(second.submittedAt !== null)

    if (groupDifference !== 0) {
      return groupDifference
    }
  }

  let difference: number

  if (sort === 'newest') {
    difference =
      Date.parse(second.assignedAt) -
      Date.parse(first.assignedAt)
  } else if (sort === 'due-desc') {
    difference =
      Date.parse(second.dueAt) -
      Date.parse(first.dueAt)
  } else {
    difference =
      Date.parse(first.dueAt) -
      Date.parse(second.dueAt)
  }

  return difference || first.id.localeCompare(second.id)
}

function AssignmentsPage() {
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')

  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all')

  const [sort, setSort] =
    useState<SortOption>('priority')

  const [now, setNow] = useState(() => Date.now())

  // Cập nhật thời gian và làm mới khi người dùng quay lại cửa sổ.
  useEffect(() => {
    function refreshTime() {
      setNow(Date.now())
    }

    const intervalId = window.setInterval(
      refreshTime,
      30_000,
    )

    window.addEventListener('focus', refreshTime)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshTime)
    }
  }, [])

  // Thống kê trên toàn bộ dữ liệu bài tập.
  const stats = getAssignmentStats(assignments, now)

  // Danh sách môn học được lấy từ dữ liệu, không đặt cứng.
  const subjects = [
    ...new Set(assignments.map((item) => item.subject)),
  ].sort((first, second) =>
    first.localeCompare(second, 'vi-VN')
  )

  const normalizedQuery = normalizeSearch(query)

  // Bước 1: lọc theo từ khóa và môn học.
  const matchingAssignments = assignments.filter(
    (assignment) => {
      const searchableText = normalizeSearch(
        [
          assignment.id,
          assignment.title,
          assignment.subject,
          assignment.fileName,
          fileLabels[assignment.fileType],
        ].join(' '),
      )

      const matchesQuery =
        searchableText.includes(normalizedQuery)

      const matchesSubject =
        subject === '' || assignment.subject === subject

      return matchesQuery && matchesSubject
    },
  )

  // Bước 2: lọc trạng thái rồi sắp xếp kết quả.
  // filter() tạo mảng mới, nên sort() không thay đổi dữ liệu gốc.
  const visibleAssignments = matchingAssignments
    .filter((assignment) =>
      matchesStatus(assignment, statusFilter, now)
    )
    .sort((first, second) =>
      compareAssignments(first, second, sort)
    )

  const canReset =
    query !== '' ||
    subject !== '' ||
    statusFilter !== 'all' ||
    sort !== 'priority'

  function resetFilters() {
    setQuery('')
    setSubject('')
    setStatusFilter('all')
    setSort('priority')
  }

  const summaryItems = [
    {
      label: 'Tổng số bài',
      value: assignments.length,
      icon: ClipboardList,
    },
    {
      label: 'Chưa nộp',
      value: stats.pending,
      icon: Clock,
    },
    {
      label: 'Quá hạn',
      value: stats.overdue,
      icon: AlertCircle,
    },
    {
      label: 'Đã nộp',
      value: stats.submitted,
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <section>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Quay lại tổng quan
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Assignment Center
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Tìm bài tập, theo dõi deadline và kiểm tra tình
          trạng nộp bài.
        </p>
      </section>

      {/* Thống kê toàn bộ bài tập */}
      <section
        aria-label="Thống kê toàn bộ bài tập"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        {summaryItems.map((item) => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="rounded-[11px] border border-border bg-white p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-500">
                  {item.label}
                </p>

                <Icon
                  size={19}
                  className="text-primary"
                  aria-hidden="true"
                />
              </div>

              <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
                {item.value}
              </p>
            </div>
          )
        })}
      </section>

      {/* Search and filters */}
      <section
        aria-label="Tìm kiếm và lọc bài tập"
        className="rounded-[11px] border border-border bg-white p-4 sm:p-6"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          {/* Search */}
          <div className="min-w-0 md:col-span-2 xl:col-span-1">
            <label
              htmlFor="assignment-search"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Tìm kiếm bài tập
            </label>

            <div className="relative">
              <Search
                size={18}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                id="assignment-search"
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Tên bài, môn học hoặc tên tệp..."
                autoComplete="off"
                className="h-11 w-full min-w-0 rounded-lg border border-input bg-white pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Subject */}
          <div className="min-w-0">
            <label
              htmlFor="assignment-subject"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Môn học
            </label>

            <select
              id="assignment-subject"
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value)
              }
              className="h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả môn học</option>

              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting */}
          <div className="min-w-0">
            <label
              htmlFor="assignment-sort"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Sắp xếp
            </label>

            <select
              id="assignment-sort"
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as SortOption)
              }
              className="h-11 w-full min-w-0 rounded-lg border border-input bg-white px-3 text-sm text-slate-900"
            >
              <option value="priority">
                Ưu tiên cần nộp
              </option>

              <option value="due-asc">
                Hạn nộp gần nhất
              </option>

              <option value="due-desc">
                Hạn nộp xa nhất
              </option>

              <option value="newest">
                Mới giao gần đây
              </option>
            </select>
          </div>
        </div>

        {/* Reset */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Số lượng theo tìm kiếm và môn học đang chọn.
          </p>

          <button
            type="button"
            onClick={resetFilters}
            disabled={!canReset}
            className="min-h-11 rounded-lg px-3 text-sm font-medium text-primary hover:bg-blue-50 disabled:cursor-default disabled:opacity-40"
          >
            Đặt lại
          </button>
        </div>

        {/* Status filters */}
        <div
          className="mt-2 flex flex-wrap gap-2"
          role="group"
          aria-label="Lọc theo trạng thái"
        >
          {statusFilters.map((item) => {
            const count = matchingAssignments.filter(
              (assignment) =>
                matchesStatus(assignment, item.value, now)
            ).length

            return (
              <button
                key={item.value}
                type="button"
                aria-pressed={statusFilter === item.value}
                onClick={() => setStatusFilter(item.value)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
                  statusFilter === item.value
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {item.label}

                <span className="tabular-nums opacity-80">
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Results */}
      <section
        aria-labelledby="assignment-results-heading"
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="assignment-results-heading"
            className="text-lg font-semibold text-slate-900"
          >
            Danh sách bài tập
          </h2>

          <p
            role="status"
            className="text-sm text-slate-500"
          >
            Hiển thị {visibleAssignments.length}/
            {assignments.length} bài tập
          </p>
        </div>

        {visibleAssignments.map((assignment) => {
          const urgency = getDeadlineUrgency(
            assignment,
            now,
          )

          const style = urgencyStyles[urgency]
          const FileIcon = fileIcons[assignment.fileType]

          const submitted =
            assignment.submittedAt !== null

          const onTime = isSubmittedOnTime(assignment)

          const submittedLate =
            submitted && onTime === false

          const statusLabel = submitted
            ? onTime === true
              ? 'Đã nộp đúng hạn'
              : 'Đã nộp trễ'
            : style.label

          return (
            <article
              key={assignment.id}
              className={`flex flex-col gap-4 rounded-[11px] border border-border border-l-4 bg-white p-4 sm:flex-row sm:items-start sm:justify-between ${style.border}`}
            >
              {/* Assignment information */}
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                  <FileIcon
                    size={21}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">
                    {assignment.subject} ·{' '}
                    {fileLabels[assignment.fileType]}
                  </p>

                  <h3 className="mt-1 break-words font-semibold text-slate-900">
                    {assignment.title}
                  </h3>

                  <p className="mt-1 break-all text-xs text-slate-500">
                    Đề bài: {assignment.fileName}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <CalendarDays
                      size={14}
                      aria-hidden="true"
                    />

                    <span>Hạn nộp:</span>

                    <time dateTime={assignment.dueAt}>
                      {formatDeadline(assignment.dueAt)}
                    </time>
                  </div>
                </div>
              </div>

              {/* Status and countdown */}
              <div className="min-w-0 border-t border-border pt-3 sm:w-56 sm:shrink-0 sm:border-t-0 sm:pt-0 sm:text-right">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    submittedLate
                      ? 'bg-amber-50 text-amber-800'
                      : style.badge
                  }`}
                >
                  {statusLabel}
                </span>

                {assignment.submittedAt !== null ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Đã gửi:{' '}
                    <time dateTime={assignment.submittedAt}>
                      {formatDeadline(
                        assignment.submittedAt,
                      )}
                    </time>
                  </p>
                ) : (
                  <p
                    className={`mt-2 text-xl font-bold tabular-nums ${style.text}`}
                  >
                    {getCountdownLabel(assignment, now)}
                  </p>
                )}
              </div>
            </article>
          )
        })}

        {/* Empty state */}
        {visibleAssignments.length === 0 && (
          <div className="rounded-[11px] border border-dashed border-border bg-white px-4 py-10 text-center">
            <ClipboardList
              size={30}
              className="mx-auto text-slate-400"
              aria-hidden="true"
            />

            <h3 className="mt-3 font-semibold text-slate-800">
              {assignments.length === 0
                ? 'Chưa có bài tập nào.'
                : 'Không tìm thấy bài tập phù hợp.'}
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              {assignments.length === 0
                ? 'Bài tập được giao sẽ xuất hiện tại đây.'
                : 'Thử từ khóa khác hoặc đặt lại bộ lọc.'}
            </p>

            {canReset && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white"
              >
                Đặt lại
              </button>
            )}
          </div>
        )}
      </section>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        Dữ liệu minh họa · Chức năng mở đề và nộp tệp sẽ
        được bổ sung ở bước sau.
      </p>
    </div>
  )
}

export default AssignmentsPage
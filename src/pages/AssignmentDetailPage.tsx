import ReturnedReview from '../components/assignments/ReturnedReview'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  History, RotateCcw, ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
} from 'lucide-react'

import type { Assignment } from '../data/assignments'

import {
  attemptLabel, withdrawalLabel, formatDeadline,
  getCountdownLabel,
  getDeadlineUrgency,
  isSubmittedOnTime,
  type DeadlineUrgency,
} from '../lib/deadline'

import AssignmentAttachments from '../components/assignments/AssignmentAttachments'
import WithdrawButton from '../components/assignments/WithdrawButton'
import SubmitFiles from '../components/assignments/SubmitFiles'

// ==========================================
// 1. FILE CONFIGURATION
// ==========================================

// ==========================================
// 2. DEADLINE STYLES
// ==========================================

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

// ==========================================
// 3. MAIN PAGE
// ==========================================

function AssignmentDetailPage({ assignments, onChanged, onDraft }: { assignments: Assignment[]; onDraft: (id: string, draft: string) => void; onChanged: () => void }) {
  const { assignmentId } = useParams<{
    assignmentId: string
  }>()

  const [now, setNow] = useState(() => Date.now())

  // Update deadline countdown
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

  // Scroll to top when changing assignments
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [assignmentId])

  const assignment = assignments.find(
    (item) => item.id === assignmentId,
  )

  // ==========================================
  // 4. ASSIGNMENT NOT FOUND
  // ==========================================

  if (!assignment) {
    return (
      <section className="rounded-xl border border-border bg-white p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Không tìm thấy bài tập
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Mã bài tập trong đường dẫn không có trong
          danh sách hiện tại.
        </p>

        <Link
          to="/assignments"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white"
        >
          <ArrowLeft size={17} />
          Quay lại bài tập của tôi
        </Link>
      </section>
    )
  }

  // ==========================================
  // 5. ASSIGNMENT INFORMATION
  // ==========================================

  const urgency = getDeadlineUrgency(
    assignment,
    now,
  )

  const graded = Boolean(assignment.returnedAt)
  const heading = graded ? 'Đã chấm bài' : 'Đã nộp bài'
  const style = graded
    ? { ...urgencyStyles[urgency], border: 'border-l-cyan-600', text: 'text-cyan-800' }
    : urgencyStyles[urgency]

  const hasSubmitted =
    assignment.submittedAt !== null

  const submittedOnTime =
    isSubmittedOnTime(assignment)


  const statusLabel = hasSubmitted
    ? attemptLabel(assignment.submittedAt!, assignment.submissionDeadline ?? assignment.dueAt)
    : withdrawalLabel(assignment, urgency === 'overdue') || style.label

  const statusBadge =
    hasSubmitted && submittedOnTime === false
      ? 'bg-amber-50 text-amber-800'
      : style.badge

  return (
    <div className="space-y-6">

      {/* ======================================
          6. BACK NAVIGATION
      ====================================== */}

      <Link
        to="/assignments"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Quay lại bài tập của tôi
      </Link>

      {/* ======================================
          7. PAGE HEADING
      ====================================== */}

      <header>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-primary">
            {assignment.subject}
          </span>

          <span className="break-all text-slate-500">
            Mã bài: {assignment.id}
          </span>
        </div>

        <h1 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {assignment.title}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Xem yêu cầu, thời hạn và tình trạng nộp
          bài của bạn.
        </p>
      </header>

      {/* ======================================
          8. DEADLINE CENTER
      ====================================== */}

      <section
        aria-labelledby="deadline-heading"
        className={`rounded-xl border border-border border-l-4 bg-white p-5 sm:p-6 ${style.border}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              id="deadline-heading"
              className="flex items-center gap-2 text-sm font-semibold text-slate-600"
            >
              <Clock size={18} aria-hidden="true" />

              Hạn nộp bài tập
            </h2>

            <p
              className={`mt-3 text-2xl font-bold tabular-nums sm:text-3xl ${style.text}`}
            >
              {hasSubmitted
                ? heading
                : getCountdownLabel(assignment, now)}
            </p>
          </div>

          <span
            className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadge}`}
          >
            {statusLabel}
          </span>
        </div>

        <dl className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">

          <div>
            <dt className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays
                size={16}
                aria-hidden="true"
              />
              Hạn nộp
            </dt>

            <dd className="mt-2 font-semibold text-slate-900">
              <time dateTime={assignment.dueAt}>
                {formatDeadline(assignment.dueAt)}
              </time>
            </dd>
          </div>

          <div>
            <dt className="text-sm text-slate-500">
              Ngày giao bài
            </dt>

            <dd className="mt-2 font-semibold text-slate-900">
              <time dateTime={assignment.assignedAt}>
                {formatDeadline(assignment.assignedAt)}
              </time>
            </dd>
          </div>

        </dl>

        <p className="mt-4 text-xs text-slate-500">
          Thời gian hiển thị theo giờ Việt Nam.
        </p>
      </section>

      {/* ======================================
          9. REQUIREMENTS & ATTACHMENTS
          Two columns on desktop
      ====================================== */}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

        {/* Tutor requirements */}

        <section
          aria-labelledby="requirements-heading"
          className="min-w-0 rounded-xl border border-border bg-white p-5 sm:p-6"
        >
          <h2
            id="requirements-heading"
            className="flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <ClipboardList
              size={20}
              className="text-primary"
              aria-hidden="true"
            />

            Yêu cầu của gia sư
          </h2>

          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {assignment.description.trim() ||
              'Gia sư chưa thêm hướng dẫn cho bài tập này.'}
          </p>
        </section>

        {/* Assignment attachment */}

        <section
          aria-labelledby="attachment-heading"
          className="min-w-0 rounded-xl border border-border bg-white p-5 sm:p-6"
        >
          <h2
            id="attachment-heading"
            className="flex items-center gap-2 text-lg font-bold text-slate-900"
          >
            <FileText
              size={20}
              className="text-primary"
              aria-hidden="true"
            />

            Tệp đề bài
          </h2>

          <AssignmentAttachments key={assignment.id} files={assignment.attachments} />
        </section>

      </div>

      {/* ======================================
          10. CENTERED SUBMISSION WORKSPACE
      ====================================== */}

      <section
  aria-labelledby="submission-heading"
  className="w-full rounded-2xl border border-slate-200 border-t-4 border-t-blue-700 bg-white p-5 shadow-sm sm:p-7"
>

        {/* Submission heading */}

        <div className="flex flex-wrap items-center justify-between gap-3">

          <h2
            id="submission-heading"
            className="flex items-center gap-2 text-xl font-bold text-slate-900"
          >
            <ClipboardList
              size={22}
              className="text-primary"
              aria-hidden="true"
            />

            Bài nộp của bạn
          </h2>

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              hasSubmitted
                ? statusBadge
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {hasSubmitted
              ? statusLabel
              : withdrawalLabel(assignment, urgency === 'overdue') || 'Chưa nộp bài'}
          </span>

        </div>

        {/* Submitted assignment */}

        {assignment.submittedAt !== null ? (
          <div className={`mt-6 space-y-4 rounded-xl border p-5 ${graded ? 'border-cyan-200 bg-cyan-50' : 'border-green-200 bg-green-50'}`}>

            <div className={`flex items-center gap-2 font-semibold ${graded ? 'text-cyan-800' : 'text-green-700'}`}>
              <CheckCircle2
                size={21}
                aria-hidden="true"
              />

              {heading}
            </div>

            <dl>
              <dt className="text-sm text-slate-500">
                Thời điểm nộp
              </dt>

              <dd className="mt-1 text-sm font-semibold text-slate-800">
                <time dateTime={assignment.submittedAt}>
                  {formatDeadline(
                    assignment.submittedAt,
                  )}
                </time>
              </dd>
            </dl>

            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadge}`}
            >
              {statusLabel}
            </span>

            {!graded && assignment.submissionId && (
              <WithdrawButton key={assignment.submissionId} assignmentId={assignment.id}
                submissionId={assignment.submissionId} onChanged={onChanged} />
            )}
            {assignment.submissionId && <ReturnedReview key={assignment.submissionId}
              id={assignment.submissionId} time={assignment.submittedAt} />}

          </div>
        ) : (
          <div className="mt-6 space-y-5">

            {/* Overdue notice */}

            {urgency === 'overdue' && (
              <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4">
                <Clock
                  size={19}
                  className="mt-0.5 shrink-0 text-red-700"
                  aria-hidden="true"
                />

                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Bài tập đã quá hạn
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-700">
                    {assignment.allowLate ? 'Gia sư cho phép nộp trễ.' : 'Gia sư đã đóng nhận bài trễ.'}
                  </p>
                </div>
              </div>
            )}

            {/* File selection and preview */}

            {(urgency !== 'overdue' || assignment.allowLate) && (
              <SubmitFiles onDraft={onDraft} initialDraftId={assignment.submissionId} key={assignment.id} assignmentId={assignment.id} resubmitting={assignment.history.length > 0} onSubmitted={onChanged} />
            )}

          </div>
        )}

      </section>
      {assignment.history.length > 0 && (
        <section aria-labelledby="attempt-history" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 id="attempt-history" className="flex items-center gap-3 text-lg font-bold text-slate-900">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><History size={21} /></span>
            Lịch sử các lần đã rút
          </h2>
          <ol className="mt-5">
            {assignment.history.map((h, index) => {
              const late = Date.parse(h.submitted_at) > Date.parse(h.due_at)
              return (
                <li key={h.withdrawn_at} className="relative ml-4 border-l-2 border-indigo-100 pb-3 pl-5 last:border-transparent last:pb-0 sm:pl-7">
                  <span aria-hidden="true" className="absolute -left-[7px] top-5 size-3 rounded-full border-2 border-white bg-indigo-500 ring-2 ring-indigo-100" />
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900">Lần nộp {assignment.history.length - index}</h3>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${late ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                        {attemptLabel(h.submitted_at, h.due_at)}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="flex items-center gap-1.5 text-slate-600"><CheckCircle2 size={15} />Đã nộp</dt>
                        <dd className="mt-1 font-medium tabular-nums"><time dateTime={h.submitted_at}>{formatDeadline(h.submitted_at)}</time></dd></div>
                      <div><dt className="flex items-center gap-1.5 text-slate-600"><RotateCcw size={15} />Đã rút</dt>
                        <dd className="mt-1 font-medium tabular-nums"><time dateTime={h.withdrawn_at}>{formatDeadline(h.withdrawn_at)}</time></dd></div>
                    </dl>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}
    </div>
  )
}

export default AssignmentDetailPage
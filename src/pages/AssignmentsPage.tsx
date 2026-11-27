import { useEffect, useState } from 'react'
import { ClipboardList, CalendarDays } from 'lucide-react'
import { Link } from 'react-router'

import { assignments } from '../data/assignments'

import {
  getDeadlineStatus,
  getCountdownLabel,
  formatDeadline,
  isSubmittedOnTime,
} from '../lib/deadline'

function AssignmentsPage() {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 30000)

    return () => window.clearInterval(timer)
  }, [])

  const sortedAssignments = [...assignments].sort((a, b) => {
    const aSubmitted = a.submittedAt !== null
    const bSubmitted = b.submittedAt !== null

    if (aSubmitted !== bSubmitted) {
      return aSubmitted ? 1 : -1
    }

    return (
      new Date(a.dueAt).getTime() -
      new Date(b.dueAt).getTime()
    )
  })

  return (
    <div className="space-y-6">

      {/* Page heading */}
      <section>
        <Link
          to="/"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← Quay lại tổng quan
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          Assignment Center
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Quản lý bài tập, deadline và lịch sử nộp bài.
        </p>
      </section>

      {/* Assignment list */}
      <section className="rounded-[12px] border border-slate-200 bg-white p-4 sm:p-6">

        <div className="mb-5 flex items-center gap-3">
          <ClipboardList
            size={24}
            className="text-blue-700"
          />

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Bài tập của tôi
            </h2>

            <p className="text-sm text-slate-500">
              Tổng cộng {assignments.length} bài tập
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {sortedAssignments.map((assignment) => {
            const status = getDeadlineStatus(assignment, now)

            const statusColor =
              status === 'overdue'
                ? 'text-red-700'
                : status === 'today'
                  ? 'text-amber-700'
                  : status === 'submitted'
                    ? 'text-green-700'
                    : 'text-blue-700'

            const statusLabel =
              status === 'submitted'
                ? isSubmittedOnTime(assignment)
                  ? 'Nộp đúng hạn'
                  : 'Nộp trễ hạn'
                : getCountdownLabel(assignment, now)

            return (
              <article
                key={assignment.id}
                className="flex flex-col gap-4 rounded-[10px] border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">
                    {assignment.subject}
                  </p>

                  <h3 className="mt-1 font-semibold text-slate-900">
                    {assignment.title}
                  </h3>

                  <p className="mt-1 break-all text-xs text-slate-500">
                    {assignment.fileName}
                  </p>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <CalendarDays size={15} />

                    Hạn nộp: {formatDeadline(assignment.dueAt)}
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="text-xs text-slate-500">
                    Trạng thái
                  </p>

                  <p className={`mt-1 font-bold ${statusColor}`}>
                    {statusLabel}
                  </p>
                </div>
              </article>
            )
          })}

          {sortedAssignments.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              Chưa có bài tập nào được giao.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

export default AssignmentsPage
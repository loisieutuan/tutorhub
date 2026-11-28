import type { Assignment } from '../data/assignments'

export type DeadlineStatus =
  | 'submitted'
  | 'overdue'
  | 'today'
  | 'upcoming'

export type DeadlineUrgency =
  | 'submitted'
  | 'overdue'
  | 'critical'
  | 'approaching'
  | 'upcoming'

const criticalDeadlineMs = 3 * 60 * 60 * 1000
const approachingDeadlineMs = 24 * 60 * 60 * 1000

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// Determine assignment status
export function getDeadlineStatus(
  assignment: Assignment,
  now: number
): DeadlineStatus {
  if (assignment.submittedAt !== null) {
    return 'submitted'
  }

  const dueTime = new Date(assignment.dueAt).getTime()

  if (dueTime <= now) {
    return 'overdue'
  }

  if (
    dateFormatter.format(dueTime) ===
    dateFormatter.format(now)
  ) {
    return 'today'
  }

  return 'upcoming'
}

// Classify urgency by elapsed time without changing calendar-day status.
export function getDeadlineUrgency(
  assignment: Assignment,
  now: number
): DeadlineUrgency {
  if (assignment.submittedAt !== null) {
    return 'submitted'
  }

  const remaining = new Date(assignment.dueAt).getTime() - now

  if (remaining <= 0) {
    return 'overdue'
  }

  if (remaining <= criticalDeadlineMs) {
    return 'critical'
  }

  if (remaining <= approachingDeadlineMs) {
    return 'approaching'
  }

  return 'upcoming'
}

// Calculate remaining time
export function getCountdownLabel(
  assignment: Assignment,
  now: number
): string {
  const status = getDeadlineStatus(assignment, now)

  if (status === 'submitted') {
    return 'Đã nộp'
  }

  if (status === 'overdue') {
    return 'Đã quá hạn'
  }

  const dueTime = new Date(assignment.dueAt).getTime()
  const remaining = dueTime - now

  const totalMinutes = Math.ceil(remaining / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `Còn ${days} ngày ${hours} giờ`
  }

  if (hours > 0) {
    return `Còn ${hours} giờ ${minutes} phút`
  }

  return `Còn ${minutes} phút`
}

// Format deadline
export function formatDeadline(date: string): string {
  return dateTimeFormatter.format(new Date(date))
}

// Calculate dashboard statistics
export function getAssignmentStats(
  assignments: Assignment[],
  now: number
) {
  const pending = assignments.filter(
    (item) => item.submittedAt === null
  ).length

  const today = assignments.filter(
    (item) => getDeadlineStatus(item, now) === 'today'
  ).length

  const overdue = assignments.filter(
    (item) => getDeadlineStatus(item, now) === 'overdue'
  ).length

  const submitted = assignments.filter(
    (item) => item.submittedAt !== null
  ).length

  return {
    pending,
    today,
    overdue,
    submitted,
  }
}

// Calculate on-time submission
export function isSubmittedOnTime(
  assignment: Assignment
): boolean | null {
  if (assignment.submittedAt === null) {
    return null
  }

  return (
    new Date(assignment.submittedAt).getTime() <=
    new Date(assignment.submissionDeadline ?? assignment.dueAt).getTime()
  )
}

export function attemptLabel(submitted: string, due: string) {
  const lateMs = Date.parse(submitted) - Date.parse(due)
  if (lateMs <= 0) return 'Đã nộp đúng hạn'
  if (lateMs < 60000) return 'Nộp trễ dưới 1 phút'
  return `Nộp trễ ${Math.floor(lateMs / 60000)} phút`
}

export function withdrawalLabel(a: Assignment, overdue: boolean) {
  if (a.submittedAt || !a.history.length) return ''
  return overdue ? 'Quá hạn · Chưa nộp lại' : 'Đã rút · Chờ nộp lại'
}

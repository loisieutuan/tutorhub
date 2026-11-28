import ImageReview, { type ImagePin } from '../components/assignments/ImageReview'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { attemptLabel, formatDeadline } from '../lib/deadline'
import { messageOf } from '../lib/submission'

type WorkFile = {
  original_name: string
  storage_path: string
  sort_order: number
}

type Grade = {
  completion_percent: number | null
  score: number | null
  feedback: string
  revision_requested: boolean
  returned_at: string | null
}

type Work = {
  id: string
  assignmentId: string
  title: string
  studentName: string
  submittedAt: string
  deadline: string
  files: WorkFile[]
  pins: ImagePin[]
  grade: Grade | null
}

const field =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50'

async function loadWork(tutorId: string): Promise<Work[]> {
  const result = await supabase
    .from('assignments')
    .select(`
      id, title, student_id, due_at,
      submissions (
        id, submitted_at, due_at_when_submitted,
        submission_files (original_name, storage_path, sort_order),
        grades (completion_percent, score, feedback, revision_requested, returned_at)
      )
    `)
    .eq('tutor_id', tutorId)
    .eq('is_archived', false)

  if (result.error) throw result.error

  const work = (result.data ?? []).flatMap(assignment =>
    [assignment.submissions].flat().flatMap(submission => {
      if (!submission?.submitted_at) return []

      return [{
        id: submission.id,
        assignmentId: assignment.id,
        title: assignment.title,
        studentId: assignment.student_id,
        submittedAt: submission.submitted_at,
        deadline: submission.due_at_when_submitted ?? assignment.due_at,
        files: [...(submission.submission_files ?? [])]
          .sort((a, b) => a.sort_order - b.sort_order),
        grade: [submission.grades].flat()[0] ?? null,
      }]
    }),
  )

  if (!work.length) return []

  const reviews = await supabase.from('submission_image_reviews')
    .select('submission_id, submitted_at, pins').in('submission_id', work.map(row => row.id))
  if (reviews.error) throw reviews.error
  const reviewsById = new Map((reviews.data ?? []).map(r => [r.submission_id, r]))

  const profiles = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [...new Set(work.map(row => row.studentId))])

  if (profiles.error) throw profiles.error

  const names = new Map(
    (profiles.data ?? []).map(profile => [profile.id, profile.full_name]),
  )

  return work
    .map(row => ({
      ...row,
      pins: (reviewsById.get(row.id)?.pins ?? []) as ImagePin[],
      studentName: names.get(row.studentId) ?? 'Học sinh',
    }))
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))
}

function GradeEditor({ work, onSaved }: {
  work: Work
  onSaved: (message: string) => void
}) {
  const [completion, setCompletion] = useState(
    work.grade?.completion_percent?.toString() ?? '',
  )
  const [score, setScore] = useState(work.grade?.score?.toString() ?? '')
  const [feedback, setFeedback] = useState(work.grade?.feedback ?? '')
  const [revision, setRevision] = useState(work.grade?.revision_requested ?? false)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const [pins, setPins] = useState<ImagePin[]>(work.pins)
  const [editing, setEditing] = useState(false)
  const returnedAt = work.grade?.returned_at

  const readOnly = Boolean(returnedAt) && !editing

  function cancelChanges() {
    setCompletion(work.grade?.completion_percent?.toString() ?? '')
    setScore(work.grade?.score?.toString() ?? '')
    setFeedback(work.grade?.feedback ?? '')
    setRevision(work.grade?.revision_requested ?? false)
    setPins(work.pins)
    setError('')
    setEditing(false)
  }

  async function download(file: WorkFile) {
    setError('')
    setDownloading(file.storage_path)
    try {
      const result = await supabase.storage
        .from('submission-files')
        .download(
          file.storage_path,
          { cacheNonce: crypto.randomUUID() },
          { cache: 'no-store' },
        )
      if (result.error) throw result.error

      const url = URL.createObjectURL(result.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_name
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) {
      setError(`Không tải được ${file.original_name}. ${messageOf(cause)}`)
    } finally {
      setDownloading('')
    }
  }

  async function save(returnNow: boolean) {
    if (lock.current || readOnly || (editing && !returnNow)) return
    setError('')

    const percent = completion.trim() === '' ? null : Number(completion)
    const points = score.trim() === '' ? null : Number(score)

    if (percent !== null && (
      !Number.isInteger(percent) || percent < 0 || percent > 100
    )) {
      setError('Tỷ lệ hoàn thành phải là số nguyên từ 0 đến 100.')
      return
    }
    if (points !== null && (
      !Number.isFinite(points) || points < 0 || points > 10
    )) {
      setError('Điểm số phải từ 0 đến 10.')
      return
    }
    if (returnNow && percent === null) {
      setError('Hãy nhập tỷ lệ hoàn thành trước khi trả kết quả.')
      return
    }
    if (revision && !feedback.trim()) {
      setError('Hãy ghi rõ phần học sinh cần sửa trong ô nhận xét.')
      return
    }

    if (pins.some(pin => !pin.text.trim())) {
      setError('Có nhận xét trên ảnh còn trống. Hãy nhập nội dung hoặc xoá nhận xét đó.')
      return
    }

    if (returnNow && !window.confirm(
      editing ? `Cập nhật kết quả bài “${work.title}” cho ${work.studentName}?` : `Trả kết quả bài “${work.title}” cho ${work.studentName}?`,
    )) return

    lock.current = true
    setSaving(true)
    try {
      const result = await supabase.rpc(editing ? 'tutor_correct_returned_grade' : 'tutor_grade_with_image_pins', {
        ...(editing ? { p_previous_return: returnedAt } : {}),
        p_assignment_id: work.assignmentId,
        p_expected_submission_id: work.id,
        p_completion_percent: percent,
        p_score: points,
        p_feedback: feedback.trim(),
        p_revision_requested: revision,
        p_return_now: returnNow,
        p_pins: pins,
        p_reviewed_at: work.submittedAt,
      })

      if (result.error) throw result.error
      onSaved(editing ? 'Đã cập nhật kết quả cho học sinh.' : returnNow ? 'Đã trả kết quả.' : 'Đã lưu bản chấm nháp.')
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      lock.current = false
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      {readOnly && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
        <span className="text-sm font-bold text-teal-900">Kết quả đã trả cho {work.studentName}</span>
        <button type="button" onClick={() => setEditing(true)} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white hover:bg-teal-900">Chỉnh sửa kết quả</button>
      </div>}
      {editing && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">Đang chỉnh sửa. Học sinh sẽ thấy thay đổi sau khi bạn lưu.</p>}
      <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          Tải tệp gốc ({work.files.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {work.files.map(file => (
            <li key={file.storage_path}>
              <button
                type="button"
                disabled={Boolean(downloading)}
                onClick={() => download(file)}
                className="break-all py-1 text-left text-sm font-semibold text-blue-700 hover:underline disabled:opacity-60"
              >
                {downloading === file.storage_path
                  ? 'Đang tải…'
                  : `Tải ${file.original_name}`}
              </button>
            </li>
          ))}
        </ul>
      </details>

      <ImageReview files={work.files} pins={pins} onChange={readOnly || saving ? undefined : setPins} />

      <fieldset disabled={saving || readOnly} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <legend className="rounded-lg bg-slate-800 px-3 py-1 text-sm font-bold text-white">Đánh giá tổng thể</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Mức độ hoàn thành (%)
            <input
              className={field} type="number" min="0" max="100" step="1"
              value={completion} onChange={e => setCompletion(e.target.value)}
              placeholder="Ví dụ: 80"
            />
          </label>
          <label className="text-sm font-semibold">
            Điểm số (/10) · tùy chọn
            <input
              className={field} type="number" min="0" max="10" step="0.01"
              value={score} onChange={e => setScore(e.target.value)}
              placeholder="Ví dụ: 7.5"
            />
          </label>
        </div>

        <label className="block text-sm font-semibold">
          Nhận xét của gia sư
          <textarea
            className={field} rows={3} maxLength={10000}
            value={feedback} onChange={e => setFeedback(e.target.value)}
            placeholder="Phần làm tốt, lỗi cần sửa và hướng cải thiện…"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox" checked={revision}
            onChange={e => setRevision(e.target.checked)}
          />
          Yêu cầu học sinh sửa bài
        </label>
      </fieldset>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {readOnly && returnedAt ? (
        <p className="text-sm font-semibold text-teal-800">Đã trả kết quả lúc {formatDeadline(returnedAt)}</p>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <button type="button" disabled={saving} onClick={editing ? cancelChanges : () => save(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {editing ? 'Huỷ chỉnh sửa' : 'Lưu nháp'}
          </button>
          <button
            type="button" disabled={saving} onClick={() => save(true)}
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Đang lưu…' : editing ? 'Lưu kết quả đã sửa' : 'Trả kết quả'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function TutorGrading({ tutorId }: { tutorId: string }) {
  const [rows, setRows] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')

    void loadWork(tutorId)
      .then(data => { if (active) setRows(data) })
      .catch(cause => { if (active) setError(messageOf(cause)) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [tutorId, version])

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-5 py-4">
        <h2 className="text-xl font-bold text-white">Chấm bài</h2>
        <button
          type="button" disabled={loading}
          onClick={() => { setNotice(''); setVersion(v => v + 1) }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Làm mới
        </button>
      </div>

      {notice && <p role="status" className="mt-3 text-sm text-emerald-700">{notice}</p>}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Đang tải bài học sinh đã nộp…</p>
      ) : error ? (
        <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Chưa có bài đã nộp để chấm.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map(work => (
            <li key={work.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900">{work.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {work.studentName} · {formatDeadline(work.submittedAt)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {attemptLabel(work.submittedAt, work.deadline)}
                    {' · '}
                    {work.grade?.returned_at
                      ? 'Đã trả kết quả'
                      : work.grade ? 'Đang chấm' : 'Chờ chấm'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={openId === work.id}
                  onClick={() => {
                    setNotice('')
                    setOpenId(openId === work.id ? null : work.id)
                  }}
                  className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800"
                >
                  {openId === work.id
                    ? 'Thu gọn'
                    : work.grade?.returned_at ? 'Xem kết quả' : 'Mở bài chấm'}
                </button>
              </div>

              {openId === work.id && (
                <GradeEditor
                  work={work}
                  onSaved={message => {
                    setNotice(message)
                    setVersion(v => v + 1)
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { messageOf } from '../../lib/submission'
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardPenLine,
  FileText,
  LoaderCircle,
  Paperclip,
  Send,
} from 'lucide-react'
type Option = { id: string; name: string }

type PendingAssignment = {
  assignmentId: string
  fileId?: string
}

const field =
  'mt-2 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50'
const acceptedFiles = '.jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.doc,.docx'

export default function TutorAssignmentForm({ tutorId }: { tutorId: string }) {
  const [students, setStudents] = useState<Option[]>([])
  const [subjects, setSubjects] = useState<Option[]>([])
  const [studentId, setStudentId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState<PendingAssignment | null>(null)
  const lock = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true

    async function loadOptions() {
      const [links, subjectRows] = await Promise.all([
        supabase.from('tutor_students')
          .select('student_id')
          .eq('tutor_id', tutorId)
          .eq('is_active', true),
        supabase.from('subjects')
          .select('id,name')
          .eq('tutor_id', tutorId)
          .eq('is_active', true)
          .order('name'),
      ])

      if (links.error) throw links.error
      if (subjectRows.error) throw subjectRows.error

      const ids = (links.data ?? []).map(row => row.student_id)
      let studentOptions: Option[] = []

      if (ids.length) {
        const profiles = await supabase.from('profiles')
          .select('id,full_name')
          .in('id', ids)
          .eq('role', 'student')
          .eq('is_active', true)
          .order('full_name')

        if (profiles.error) throw profiles.error
        studentOptions = (profiles.data ?? []).map(row => ({
          id: row.id,
          name: row.full_name,
        }))
      }

      if (!active) return
      setStudents(studentOptions)
      setSubjects(subjectRows.data ?? [])
      if (studentOptions.length === 1) setStudentId(studentOptions[0].id)
      if (subjectRows.data?.length === 1) setSubjectId(subjectRows.data[0].id)
    }

    void loadOptions()
      .catch(cause => { if (active) setError(messageOf(cause)) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [tutorId])

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    setError('')
    setNotice('')

    if (!studentId || !subjectId || !title.trim() || !deadline || !file) {
      setError('Hãy chọn học sinh, môn học, tên bài, hạn nộp và tệp đề.')
      return
    }

    // Tutor nhập giờ Việt Nam. Gửi thời điểm có múi giờ rõ ràng cho server.
    const due = new Date(`${deadline}:00+07:00`)
    if (!Number.isFinite(due.getTime()) || (!pending && due.getTime() <= Date.now())) {
      setError('Hạn nộp của bài mới phải ở tương lai, theo giờ Việt Nam.')
      return
    }

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (!file.size || !acceptedFiles.split(',').includes(extension)) {
      setError('Hãy chọn một tệp ảnh, PDF hoặc Word có nội dung.')
      return
    }

    lock.current = true
    setBusy(true)
    let attempt = pending

    try {
      if (!attempt) {
        const created = await supabase.rpc('tutor_create_assignment', {
          p_student_id: studentId,
          p_subject_id: subjectId,
          p_title: title.trim(),
          p_description: description.trim(),
          p_due_at: due.toISOString(),
          p_allow_late_submission: true,
        })

        if (created.error) throw created.error
        if (typeof created.data !== 'string') throw new Error('Chưa nhận được mã bài tập.')
        attempt = { assignmentId: created.data }
        setPending(attempt)
      }

      if (!attempt.fileId) {
        const registered = await supabase.rpc('tutor_register_assignment_file', {
          p_assignment_id: attempt.assignmentId,
          p_original_name: file.name,
          p_size_bytes: file.size,
        })

        if (registered.error) throw registered.error
        if (typeof registered.data !== 'string') throw new Error('Chưa nhận được mã tệp đề.')
        attempt = { ...attempt, fileId: registered.data }
        setPending(attempt)
      }

      const metadata = await supabase.from('assignment_files')
        .select('storage_path')
        .eq('id', attempt.fileId)
        .single()

      if (metadata.error) throw metadata.error

      const storage = supabase.storage.from('assignment-files')
      const path = metadata.data.storage_path
      const uploaded = await storage.upload(path, file, {
        upsert: false,
        cacheControl: '0',
      })

      if (uploaded.error) {
        // Có thể lần trước đã tải xong nhưng trình duyệt bị mất phản hồi.
        const existing = await storage.download(path)
        if (existing.error || !existing.data || existing.data.size !== file.size) {
          throw uploaded.error
        }

        const [remote, local] = await Promise.all([
          existing.data.arrayBuffer(),
          file.arrayBuffer(),
        ])
        const selected = new Uint8Array(local)
        if (!new Uint8Array(remote).every((byte, i) => byte === selected[i])) {
          throw uploaded.error
        }
      }

      const student = students.find(item => item.id === studentId)?.name ?? 'học sinh'
      setNotice(`Đã giao “${title.trim()}” cho ${student} và tải lên tệp đề “${file.name}”.`)
      setPending(null)
      setTitle('')
      setDescription('')
      setDeadline('')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
    } catch (cause) {
      const detail = messageOf(cause)
      setError(attempt
        ? `Bài đã được tạo nhưng chưa xác nhận tệp đề. Giữ trang này và bấm “Thử lại tệp đề”. ${detail}`
        : detail)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

   const selectedStudent = students.find(student => student.id === studentId)
  const selectedSubject = subjects.find(subject => subject.id === subjectId)
  const locked = busy || Boolean(pending)
  const canAssign = !loading && !busy && students.length > 0 && subjects.length > 0

  const fileSizeLabel = file
    ? file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`
    : ''

  return (
    <section
      aria-labelledby="assign-heading"
      className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-5 sm:px-7">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-700 text-white">
          <ClipboardPenLine size={23} aria-hidden="true" />
        </div>

        <h2
          id="assign-heading"
          className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl"
        >
          Giao bài tập
        </h2>
      </header>

      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 px-5 py-6 text-sm text-slate-600"
        >
          <LoaderCircle size={17} className="motion-safe:animate-spin" />
          Đang tải học sinh và môn học…
        </p>
      ) : (
        <form
          onSubmit={handleAssign}
          className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)]"
        >
          <fieldset
            disabled={locked}
            className="min-w-0 space-y-5 p-5 sm:p-7"
          >
            <legend className="sr-only">Nội dung bài giao</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block min-w-0 text-sm font-semibold text-slate-800">
                Học sinh
                <select
                  required
                  className={field}
                  value={studentId}
                  onChange={event => setStudentId(event.target.value)}
                >
                  <option value="">Chọn học sinh</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block min-w-0 text-sm font-semibold text-slate-800">
                Môn học
                <select
                  required
                  className={field}
                  value={subjectId}
                  onChange={event => setSubjectId(event.target.value)}
                >
                  <option value="">Chọn môn học</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block text-sm font-semibold text-slate-800">
              Tên bài tập
              <input
                className={field}
                required
                maxLength={200}
                value={title}
                placeholder="Ví dụ: IELTS Writing Task 1 – Biểu đồ đường"
                onChange={event => setTitle(event.target.value)}
              />
            </label>

            <label className="block text-sm font-semibold text-slate-800">
              Yêu cầu của gia sư
              <textarea
                className={`${field} min-h-32 resize-y leading-6`}
                rows={5}
                value={description}
                placeholder="Ví dụ: Viết ít nhất 150 từ. Gạch chân câu overview và nộp bài dưới dạng PDF."
                onChange={event => setDescription(event.target.value)}
              />
            </label>
          </fieldset>

          <div className="min-w-0 space-y-5 border-t border-slate-200 bg-slate-50/80 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <fieldset disabled={locked} className="min-w-0 space-y-5">
              <legend className="sr-only">Hạn nộp và tệp đề</legend>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <label
                  htmlFor="tutor-assignment-deadline"
                  className="flex items-center gap-2 text-sm font-bold text-amber-950"
                >
                  <CalendarClock size={18} aria-hidden="true" />
                  Hạn nộp bài
                </label>

                <input
                  id="tutor-assignment-deadline"
                  className={`${field} min-w-0`}
                  type="datetime-local"
                  required
                  aria-describedby="assignment-timezone"
                  value={deadline}
                  onChange={event => setDeadline(event.target.value)}
                />

                <p id="assignment-timezone" className="mt-2 text-xs text-amber-900">
                  Theo giờ Việt Nam (GMT+7)
                </p>
              </div>

              <div>
                <label
                  htmlFor="tutor-assignment-file"
                  className="text-sm font-semibold text-slate-800"
                >
                  Tệp đề bài
                </label>

                <div className="relative mt-2">
                  <input
                    id="tutor-assignment-file"
                    ref={fileInput}
                    className="peer sr-only"
                    type="file"
                    required
                    accept={acceptedFiles}
                    onChange={event => {
                      const selected = event.target.files?.[0]
                      if (selected) setFile(selected)
                    }}
                  />

                  <label
                    htmlFor="tutor-assignment-file"
                    className={`flex min-h-20 items-center gap-3 rounded-xl border border-dashed bg-white px-4 py-3 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 ${
                      locked
                        ? 'cursor-default border-slate-200'
                        : 'cursor-pointer border-blue-300 hover:border-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">
                      {file
                        ? <FileText size={19} aria-hidden="true" />
                        : <Paperclip size={19} aria-hidden="true" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block break-all text-sm font-semibold text-slate-900">
                        {file ? file.name : 'Chọn tệp đề bài'}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {file ? fileSizeLabel : 'Ảnh, PDF hoặc Word'}
                      </span>
                    </span>

                    {file && !locked && (
                      <span className="shrink-0 text-xs font-semibold text-blue-700">
                        Đổi tệp
                      </span>
                    )}
                  </label>
                </div>
              </div>
            </fieldset>

            {selectedStudent && selectedSubject && (
              <p className="flex items-start gap-2 text-sm text-slate-600">
                <BookOpen size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Giao cho <strong className="text-slate-900">{selectedStudent.name}</strong>
                  {' · '}{selectedSubject.name}
                </span>
              </p>
            )}

            <button
              type="submit"
              disabled={!canAssign}
              aria-busy={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-bold text-white shadow-sm transition-colors enabled:hover:bg-blue-800 enabled:active:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-default disabled:opacity-60"
            >
              {busy
                ? <LoaderCircle size={18} className="motion-safe:animate-spin" aria-hidden="true" />
                : <Send size={17} aria-hidden="true" />}
              {busy ? 'Đang giao bài…' : pending ? 'Thử lại tệp đề' : 'Giao bài tập'}
            </button>

            {!students.length && !error && (
              <p className="text-sm text-amber-800">
                Tài khoản gia sư này chưa có học sinh đang hoạt động.
              </p>
            )}
            {!subjects.length && !error && (
              <p className="text-sm text-amber-800">
                Tài khoản gia sư này chưa có môn học đang hoạt động.
              </p>
            )}
          </div>
        </form>
      )}

      {error && (
        <p
          role="alert"
          className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-7"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800 sm:px-7"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
    </section>
  )
}
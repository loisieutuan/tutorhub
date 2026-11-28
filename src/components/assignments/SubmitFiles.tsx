import { useRef, useState } from 'react'
import { FileUp, Plus, Eye, Upload, LoaderCircle, X } from 'lucide-react'
import { messageOf, prepareFiles, submitWork, uploadWork } from '../../lib/submission'
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, PreviewDialog } from './SubmissionDraft'

type Props = {
  onDraft: (assignmentId: string, draftId: string) => void
  initialDraftId: string | null
  assignmentId: string
  onSubmitted: () => void
  resubmitting: boolean
}

type Item = { file: File; id: string; bytes: number; status: 'Sẵn sàng' | 'Chờ lượt tải' | 'Đang tải' | 'Chờ lưu tệp' | 'Đã tải' | 'Lỗi tải tệp' }

export default function SubmitFiles({ onDraft, initialDraftId, assignmentId, onSubmitted, }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState('')
  const current = useRef(initialDraftId)
  const request = useRef('')
  const targets = useRef<Awaited<ReturnType<typeof prepareFiles>>>([])
  const completed = useRef(new Set<string>())
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)

  function change(next: Item[]) {
    request.current = crypto.randomUUID()
    targets.current = []
    completed.current.clear()
    setPhase('')
    setItems(next.map(item => ({ ...item, status: 'Sẵn sàng', bytes: 0 })))
  }

  function add(files: FileList | null) {
    if (lock.current || !files?.length) return
    const next = [...items]
    const issues: string[] = []
    for (const file of Array.from(files)) {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext) || !file.size || file.size > MAX_FILE_SIZE) {
        issues.push(`${file.name}: định dạng hoặc dung lượng không hợp lệ.`)
        continue
      }
      if (next.some(i => i.file.name === file.name && i.file.size === file.size && i.file.lastModified === file.lastModified)) continue
      if (next.length === 50) { issues.push('Chỉ được chọn tối đa 50 tệp.'); break }
      next.push({ file, id: crypto.randomUUID(), status: 'Sẵn sàng', bytes: 0 })
    }
    if (next.length !== items.length) change(next)
    setError(issues.join(' '))
  }

  function mark(id: string, status: Item['status'], bytes?: number) {
    setItems(rows => rows.map(row => row.id === id ? { ...row, status, bytes: bytes ?? row.bytes } : row))
  }

  async function send() {
    if (!items.length || lock.current) return
    lock.current = true
    setBusy(true)
    setItems(rows => rows.map(row => completed.current.has(row.id) ? row : { ...row, status: 'Chờ lượt tải' }))
    setError('')
    try {
      if (!targets.current.length) {
        setPhase('Đang chuẩn bị bài nộp…')
        targets.current = await prepareFiles(assignmentId, current.current, request.current, items.map(i => i.file))
        current.current = targets.current[0]!.draft_id
        onDraft(assignmentId, current.current)
      }
      const errors: string[] = []
      const pending = items.map((item, index) => ({ item, index }))
        .filter(({ item }) => !completed.current.has(item.id))
      let cursor = 0
      async function uploadNext() {
        while (cursor < pending.length) {
          const { item, index } = pending[cursor++]!
          mark(item.id, 'Đang tải', 0)
          try {
            await uploadWork(targets.current[index]!.object_path, item.file, bytes =>
              mark(item.id, bytes === item.file.size ? 'Chờ lưu tệp' : 'Đang tải', bytes))
            completed.current.add(item.id)
            mark(item.id, 'Đã tải', item.file.size)
          } catch (reason) {
            mark(item.id, 'Lỗi tải tệp')
            errors.push(`${item.file.name}: ${messageOf(reason)}`)
          }
        }
      }
      setPhase('Đang tải bài làm…')
      await Promise.all(Array.from({ length: Math.min(3, pending.length) }, uploadNext))
      if (errors.length) throw new Error(errors.join('\n'))
      setPhase('Đang xác nhận nộp bài…')
      await submitWork(assignmentId, targets.current[0]!.draft_id)
      onSubmitted()
    } catch (reason) {
      setPhase('Chưa nhận được xác nhận nộp bài.')
      setError(messageOf(reason))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0)
  const sentBytes = items.reduce((sum, item) => sum + item.bytes, 0)
  const totalPercent = totalBytes ? Math.floor(100 * sentBytes / totalBytes) : 0
  const savedCount = items.filter(item => item.status === 'Đã tải').length

  return (
    <section aria-label="Nộp bài làm" className="space-y-3">
      <input hidden multiple ref={input} type="file" accept={ALLOWED_EXTENSIONS.join(',')}
        aria-label="Chọn các tệp bài làm" disabled={busy}
        onChange={event => { add(event.currentTarget.files); event.currentTarget.value = '' }} />
      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <button type="button" disabled={busy || items.length >= 50}
          onClick={() => input.current?.click()}
          onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }}
          onDrop={event => { event.preventDefault(); setDragging(false); add(event.dataTransfer.files) }}
          className={`group flex min-w-0 items-center gap-3 rounded-xl border border-dashed px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60 sm:px-4 ${dragging ? 'border-indigo-700 bg-indigo-100' : 'border-indigo-300 bg-gradient-to-r from-indigo-50 to-white hover:border-indigo-600 hover:from-indigo-100'}`}>
          <span aria-hidden="true" className="relative isolate grid size-10 shrink-0 place-items-center">
            <span className="absolute inset-1 -z-10 -rotate-12 rounded-lg bg-indigo-200" />
            <span className="grid size-9 place-items-center rounded-lg border border-indigo-200 bg-white text-indigo-700 shadow-sm"><FileUp size={21} /></span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-indigo-950">{dragging ? 'Thả tệp vào đây' : items.length ? 'Thêm tệp bài làm' : 'Chọn hoặc kéo thả tệp bài làm'}</span>
            <span className="mt-0.5 block text-xs text-slate-600">Ảnh, PDF, Word · 10 MB/tệp · {items.length ? `${items.length}/50 tệp` : 'Tối đa 50 tệp'}</span>
          </span>
          <Plus aria-hidden="true" size={18} className="shrink-0 text-indigo-600" />
        </button>
        <button type="button" onClick={send} disabled={busy || !items.length} aria-busy={busy}
          title={!items.length ? 'Chọn tệp bài làm để nộp' : undefined}
          className={`relative isolate inline-flex min-h-12 w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl border px-5 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-800 sm:w-auto ${items.length
            ? 'border-amber-500 bg-amber-400 text-slate-950 shadow-sm enabled:hover:bg-amber-300 enabled:active:bg-amber-500'
            : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {busy ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" size={18} />
            : <Upload aria-hidden="true" size={18} strokeWidth={2.2} />}
          <span>{busy ? (phase === 'Đang xác nhận nộp bài…' ? 'Đang xác nhận' : 'Đang gửi') : 'Tải lên và nộp'}</span>
          {(busy || items.length > 0) && <span className="border-l border-amber-900/30 pl-2.5 text-xs font-semibold tabular-nums">
            {busy ? `${totalPercent}%` : `${items.length} tệp`}
          </span>}
          {busy && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-amber-200">
            <span className="block h-full bg-amber-900" style={{ width: `${totalPercent}%` }} />
          </span>}
        </button>
      </div>
      {error && <p role="alert" className="whitespace-pre-line rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {items.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:px-4">
          <h3 className="font-semibold text-slate-800">Tiến độ tải</h3>
          <span className="text-slate-600">{savedCount}/{items.length} tệp đã lưu</span>
          <div className="ml-auto flex items-center gap-2">
            <progress aria-label="Tổng dung lượng đã gửi" value={totalPercent} max={100}
              className="h-1.5 w-12 overflow-hidden rounded-full sm:w-24 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600" />
            <strong className="tabular-nums text-blue-800">{totalPercent}%</strong>
          </div>
          {phase && <p role="status" className="basis-full text-blue-800">{phase}</p>}
        </div>
        <ol aria-label="Danh sách tệp bài làm" className="max-h-72 overflow-y-auto divide-y divide-slate-100 overscroll-contain">{items.map(item => {
          const percent = Math.floor(100 * item.bytes / item.file.size)
          const label = item.status === 'Đã tải' && phase === 'Đang xác nhận nộp bài…' ? 'Chờ xác nhận nộp' : item.status
          const tone = (item.status === 'Sẵn sàng' || item.status === 'Chờ lượt tải') ? 'bg-amber-100 text-amber-900' :
            item.status === 'Lỗi tải tệp' ? 'bg-red-100 text-red-800' :
            item.status === 'Đã tải' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
          return <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 px-3 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto_8rem_auto] sm:px-4">
            <p title={item.file.name} className="min-w-0 break-all text-sm font-medium leading-tight sm:truncate">{item.file.name}</p>
            <span className={`col-start-1 row-start-2 w-fit rounded-full px-2 py-0.5 text-xs font-semibold sm:col-auto sm:row-auto ${tone}`}>{label}</span>
            <div className="col-start-2 row-start-2 flex items-center justify-end gap-2 sm:col-auto sm:row-auto">
              <progress aria-label={`Tiến độ tải ${item.file.name}`} value={item.bytes} max={item.file.size}
                className="h-1 w-10 overflow-hidden rounded-full sm:w-16 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600" />
              <span className="w-8 text-right text-xs tabular-nums text-slate-700">{percent}%</span>
            </div>
            <div className="col-start-2 row-start-1 flex justify-end sm:col-auto sm:row-auto">
              <button type="button" aria-label={`Xem trước ${item.file.name}`} onClick={() => setPreview(item.file)} className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"><Eye size={16} /></button>
              <button type="button" aria-label={`Bỏ ${item.file.name}`} disabled={busy} onClick={() => { change(items.filter(i => i.id !== item.id)); setError('') }} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X size={16} /></button>
            </div>
          </li>
        })}</ol>
      </section>}
      {preview && <PreviewDialog file={preview} onClose={() => setPreview(null)} />}


    </section>
  )
}

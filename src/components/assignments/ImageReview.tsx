import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { messageOf } from '../../lib/submission'

export type ImagePin = { id: string; path: string; x: number; y: number; text: string }
type ReviewFile = { original_name: string; storage_path: string }

export function isReviewImage(name: string) {
  return /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(name)
}

const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50'

function Canvas({ file, pins, onChange }: {
  file: ReviewFile
  pins: ImagePin[]
  onChange?: (next: ImagePin[]) => void
}) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [active, setActive] = useState('')
  const [placing, setPlacing] = useState<'add' | 'move' | null>(null)
  const [zoom, setZoom] = useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const list = pins.filter(p => p.path === file.storage_path)
  const selected = list.find(p => p.id === active)

  useEffect(() => {
    let live = true
    let objectUrl = ''
    setError('')
    setUrl('')
    async function open() {
      try {
        const result = await supabase.storage.from('submission-files').download(file.storage_path)
        if (result.error) throw result.error
        if (!live) return
        objectUrl = URL.createObjectURL(result.data)
        setUrl(objectUrl)
      } catch (e) {
        if (live) setError(messageOf(e))
      }
    }
    void open()
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [file.storage_path, retry])

  function place(x: number, y: number) {
    if (!placing || !onChange) return
    if (placing === 'move' && selected) {
      onChange(pins.map(p => p.id === selected.id ? { ...p, x, y } : p))
    } else {
      const id = crypto.randomUUID()
      onChange([...pins, { id, path: file.storage_path, x, y, text: '' }])
      setActive(id)
    }
    setPlacing(null)
    requestAnimationFrame(() => editor.current?.focus())
  }

  return <div className="grid overflow-hidden rounded-xl border border-slate-200 lg:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="min-w-0 bg-slate-100 p-3">
      {error ? <div role="alert">{error} <button type="button" className={button} onClick={() => setRetry(n => n+1)}>Thử lại</button></div>
        : !url ? <p role="status">Đang mở ảnh…</p> : <>
          <div className="mb-3 flex flex-wrap gap-2">
            {onChange && <button type="button" className={button} onClick={() => setPlacing(placing ? null : 'add')}>
              {placing ? 'Huỷ đặt nhận xét' : '+ Thêm nhận xét'}</button>}
            <button type="button" className={button} onClick={() => setZoom(!zoom)}>{zoom ? 'Thu nhỏ' : 'Phóng to'}</button>
          </div>
          {placing && onChange && <p className="mb-2 text-sm font-semibold text-blue-800">Bấm vào chỗ cần góp ý trên ảnh.</p>}
          <div className="max-h-[70vh] overflow-auto">
            <div className="relative" style={{ width: zoom ? '160%' : '100%' }}>
              <img src={url} alt={file.original_name} className="block h-auto w-full"
                onError={() => setError('Trình duyệt không đọc được ảnh này.')} />
              {placing && onChange && <button type="button" aria-label="Đặt nhận xét" className="absolute inset-0 cursor-crosshair"
                onClick={e => {
                  const box = e.currentTarget.getBoundingClientRect()
                  const clamp = (v: number) => Math.min(1, Math.max(0, v))
                  place(e.detail ? clamp((e.clientX-box.left)/box.width) : 0.5,
                    e.detail ? clamp((e.clientY-box.top)/box.height) : 0.5)
                }} />}
              {list.map((p, i) => <button key={p.id} type="button" aria-label={'Nhận xét ' + (i+1)}
                aria-pressed={active === p.id} onClick={() => setActive(p.id)}
                style={{ left: p.x*100+'%', top: p.y*100+'%' }}
                className={'absolute grid h-8 min-w-8 px-1 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-slate-950 text-sm font-black tabular-nums text-slate-950 shadow-[0_0_0_2px_white,0_2px_7px_3px_#0008] ' +
                  (active === p.id ? 'z-10 scale-110 bg-white outline-4 outline-offset-2 outline-indigo-600 ' : 'bg-yellow-300 ') + (placing ? 'pointer-events-none' : '')}>{i+1}</button>)}
            </div>
          </div>
        </>}
    </div>
    <aside className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 lg:max-h-[80vh] lg:overflow-auto lg:border-l lg:border-t-0">
      <h4 className="font-bold">Nhận xét trên ảnh ({list.length})</h4>
      {!list.length && <p className="text-sm text-slate-600">{onChange ? 'Chọn “Thêm nhận xét”, rồi bấm vào chỗ cần sửa.' : 'Ảnh này chưa có nhận xét.'}</p>}
      {list.map((p,i) => <button type="button" key={p.id} aria-pressed={active === p.id}
        className={'block w-full rounded-lg border p-2 text-left text-sm '+(active === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white')}
        onClick={() => { setActive(p.id); setPlacing(null) }}>
        <strong className="inline-flex items-center gap-2"><span aria-hidden="true" className="grid h-6 min-w-6 place-items-center rounded-full border-2 border-slate-900 bg-yellow-300 text-xs font-black text-slate-950">{i+1}</span>Nhận xét {i+1}</strong><span className="block whitespace-pre-wrap break-words">{p.text || 'Chưa nhập góp ý'}</span>
      </button>)}
      {selected && onChange && <>
        <label className="block text-sm font-semibold">Nội dung nhận xét {list.indexOf(selected)+1}
          <textarea ref={editor} rows={3} maxLength={2000} value={selected.text}
            className="mt-1 w-full rounded-lg border p-2" onChange={e => onChange(pins.map(p =>
              p.id === selected.id ? {...p, text:e.target.value} : p))} />
        </label>
        <button type="button" className={button} onClick={() => setPlacing('move')}>Di chuyển</button>{' '}
        <button type="button" className={button} onClick={() => {
          onChange(pins.filter(p => p.id !== active)); setActive(''); setPlacing(null)
        }}>Xoá nhận xét</button>
      </>}
    </aside>
  </div>
}

export default function ImageReview({files, pins, onChange}: {
  files: ReviewFile[]; pins: ImagePin[]; onChange?: (next: ImagePin[]) => void
}) {
  const images = files.filter(f => isReviewImage(f.original_name))
  const [path, setPath] = useState('')
  const file = images.find(f => f.storage_path === path) ?? images[0]
  if (!file) return null
  return <section className="space-y-3">
    <label className="block text-sm font-semibold">Ảnh bài làm
      <select value={file.storage_path} onChange={e => setPath(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2">
        {images.map((f,i) => <option key={f.storage_path} value={f.storage_path}>Ảnh {i+1} · {f.original_name}</option>)}
      </select>
    </label>
    <Canvas key={file.storage_path} file={file} pins={pins} onChange={onChange} />
  </section>
}

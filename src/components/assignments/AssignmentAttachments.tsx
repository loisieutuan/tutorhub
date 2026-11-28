import { useState } from 'react'
import type { Assignment } from '../../data/assignments'
import { supabase } from '../../lib/supabase'
import { messageOf } from '../../lib/submission'

export default function AssignmentAttachments({ files }: { files: Assignment['attachments'] }) {
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  async function download(file: Assignment['attachments'][number]) {
    setPending(file.storage_path)
    setError('')
    try {
      const result = await supabase.storage.from('assignment-files').download(file.storage_path)
      if (result.error) throw result.error
      const url = URL.createObjectURL(result.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.original_name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setPending('')
    }
  }
  return <div className="mt-4 space-y-2">
    {files.length === 0 && <p>Gia sư chưa đính kèm tệp.</p>}
    {files.map(file => <button key={file.storage_path} type="button" disabled={!!pending}
      onClick={() => download(file)} className="block break-all text-sm font-semibold text-primary underline">
      {pending === file.storage_path ? 'Đang tải…' : file.original_name}
    </button>)}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </div>
}

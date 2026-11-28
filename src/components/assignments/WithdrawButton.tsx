import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { messageOf } from '../../lib/submission'

export default function WithdrawButton({ assignmentId, submissionId, onChanged }: {
  assignmentId: string; submissionId: string; onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function withdraw() {
    if (busy || !window.confirm('Rút bài đã nộp? Bạn sẽ cần chọn tệp và nộp lại. Thời gian nộp mới được dùng để tính trễ hạn.')) return
    setError('')
    setBusy(true)
    try {
      const result = await supabase.rpc('student_withdraw_submission', {
        p_assignment_id: assignmentId, p_expected_id: submissionId,
      })
      if (result.error) throw result.error
      onChanged()
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setBusy(false)
    }
  }
  return <div>
    <button type="button" onClick={withdraw} disabled={busy}
      className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-semibold">
      {busy ? 'Đang rút bài…' : 'Rút bài'}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>
}

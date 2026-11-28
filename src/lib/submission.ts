import { supabase } from './supabase'

export function messageOf(error: unknown) {
  if (typeof error === 'object' && error && 'message' in error) return String(error.message)
  return 'Không thể hoàn tất. Vui lòng kiểm tra kết nối và thử lại.'
}

const bucket = () => supabase.storage.from('submission-files')

type UploadTarget = { draft_id: string; object_path: string; position_in_list: number }

async function withDeadline<T>(label: string, run: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(label + ': máy chủ chưa phản hồi. Hãy bấm Thử lại.'))
        controller.abort()
      }, 30000)
    })
    return await Promise.race([deadline, run(controller.signal)])
  } finally {
    clearTimeout(timer)
  }
}

export async function prepareFiles(assignmentId: string, expectedId: string | null, requestId: string, files: File[]) {
  const { data, error } = await withDeadline('Chuẩn bị bài', signal => supabase.rpc('student_prepare_submission_files', {
    p_assignment_id: assignmentId, p_expected_id: expectedId, p_request_id: requestId,
    p_files: files.map(file => ({ original_name: file.name.trim(), size_bytes: file.size })),
  }).abortSignal(signal))
  if (error) throw new Error('Chuẩn bị bài: ' + error.message)
  if (!Array.isArray(data)) throw new Error('Không nhận được danh sách tệp từ máy chủ.')
  const targets: UploadTarget[] = data.sort((a, b) => a.position_in_list - b.position_in_list)
  if (targets.length !== files.length || targets.some((t,i) =>
    t.position_in_list !== i + 1 || !t.object_path || !t.draft_id || t.draft_id !== targets[0]?.draft_id)) {
    throw new Error('Máy chủ chưa xác nhận đủ danh sách tệp.')
  }
  return targets
}

// Mirror the SDK multipart upload while exposing real browser transfer progress.
export async function uploadWork(path: string, file: File, progress: (bytes: number) => void) {
  const { data, error } = await withDeadline('Xác thực phiên', () => supabase.auth.getSession())
  if (error || !data.session) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  const objectPath = path.split('/').map(encodeURIComponent).join('/')
  const base = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')
  const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let watchdog: ReturnType<typeof setTimeout>
    function renewTimeout() {
      clearTimeout(watchdog)
      watchdog = setTimeout(() => xhr.abort(), 45000)
    }
    xhr.onloadend = () => clearTimeout(watchdog)
    xhr.upload.onprogress = event => {
      renewTimeout()
      if (event.lengthComputable && event.total > 0) progress(Math.floor(file.size * event.loaded / event.total))
    }
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText })
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải tệp. Bạn có thể thử lại.'))
    xhr.onabort = () => reject(new Error('Tải tệp bị gián đoạn hoặc không có phản hồi trong 45 giây. Hãy thử lại.'))
    xhr.open('POST', base + '/storage/v1/object/submission-files/' + objectPath)
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
    xhr.setRequestHeader('Authorization', 'Bearer ' + data.session.access_token)
    xhr.setRequestHeader('x-upsert', 'false')
    const form = new FormData()
    form.append('cacheControl', '0')
    form.append('', file, file.name)
    xhr.send(form)
    renewTimeout()
  })
  if (response.status >= 200 && response.status < 300) return
  const failure = new Error(`Tải tệp thất bại (HTTP ${response.status}).`)
  if (response.status !== 409 && !/duplicate|already exists/i.test(response.text)) throw failure
  // A retry after a lost response can encounter an already-stored file.
  const existing = await withDeadline('Kiểm tra tệp đã tải', signal => bucket().download(path, { cacheNonce: crypto.randomUUID() }, { cache: 'no-store', signal }))
  if (existing.error || !existing.data) throw failure
  const [stored, selected] = await Promise.all([existing.data.arrayBuffer(), file.arrayBuffer()])
  const local = new Uint8Array(selected)
  if (stored.byteLength !== selected.byteLength || !new Uint8Array(stored).every((b, i) => b === local[i])) {
    throw new Error('Nội dung tệp khác bản đã tải lên. Hãy chọn lại tệp gốc.')
  }
}

export async function submitWork(assignmentId: string, submissionId: string) {
  const { data, error } = await withDeadline('Xác nhận nộp bài', signal => supabase.rpc('student_submit_current_work', { p_assignment_id: assignmentId, p_expected_id: submissionId }).abortSignal(signal))
  if (error) throw error
  if (typeof data !== 'string' || !Number.isFinite(Date.parse(data))) {
    throw new Error('Chưa nhận được thời điểm nộp hợp lệ. Hãy tải lại để kiểm tra.')
  }
  return data
}

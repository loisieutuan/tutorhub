import { supabase } from './supabase'
import { getOwnProfile } from './auth'

// LST Learning - 8E Storage security smoke test
const KEY = 'lst-storage-test-v1'
const ASSIGNMENTS = 'assignment-files'
const SUBMISSIONS = 'submission-files'

type TestState = {
  assignmentId: string
  studentId: string
  assignmentPath: string
  submissionPath?: string
  submissionSize?: number
}

type ApiError = {
  message: string
  status?: unknown
  statusCode?: unknown
  code?: unknown
  error?: unknown
}

type ApiResult<T> = {
  data: T | null
  error: ApiError | null
}

type DenialOptions = {
  allowNotFound?: boolean
  allowAnonymous?: boolean
}

// Check API errors and null values at runtime.
function must<T>(result: ApiResult<T>): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(result.error?.message ?? 'No data returned')
  }
  return result.data
}

// Do not infer database row types from untyped Supabase queries.
function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid or missing ${label}`)
  }
  return value
}

function readStringField(result: ApiResult<unknown>, field: string): string {
  const row = must<unknown>(result)
  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    throw new Error(`Expected one database row for ${field}`)
  }
  return requiredString((row as Record<string, unknown>)[field], field)
}

function denied(
  result: { error: ApiError | null },
  label: string,
  options: DenialOptions = {},
) {
  if (!result.error) throw new Error(`FAIL: ${label}`)
  const error = result.error
  const status = Number(error.statusCode ?? error.status ?? NaN)
  const details = [error.message, String(error.code ?? ''), String(error.error ?? '')].join(' ')

  if (status >= 500 || status === 429 || /failed to fetch|network|timeout|internal server error|database error/i.test(details)) {
    console.error(error)
    throw new Error(`INCONCLUSIVE: ${label}. Network or server error.`)
  }
  if (status === 401 && !options.allowAnonymous) {
    console.error(error)
    throw new Error(`INCONCLUSIVE: ${label}. Check login session.`)
  }

  const accessDenied = status === 403 || /row.level security|permission denied|access.?denied|unauthorized|not authorized|forbidden|insufficient privilege|42501/i.test(details)
  const notFound = status === 404 || /not.?found|no.?such.?key/i.test(details)
  if (/bucket.?not.?found|no.?such.?bucket/i.test(details)) {
    throw new Error(`INCONCLUSIVE: ${label}. Check bucket configuration.`)
  }
  const anonymousDenied = options.allowAnonymous === true && status === 401
  if (!accessDenied && !(options.allowNotFound && notFound) && !anonymousDenied) {
    console.error(error)
    throw new Error(`INCONCLUSIVE: ${label}. Unexpected error: ${error.message}`)
  }
  console.log(`DENIED: ${label}`, error)
}

function save(state: TestState) {
  sessionStorage.setItem(KEY, JSON.stringify(state))
}

function load(): TestState {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) throw new Error('Run tutorSetup() first in this browser tab.')
  return JSON.parse(raw) as TestState
}

function submissionPath(state: TestState): string {
  if (!state.submissionPath) throw new Error('Run studentPrepare() first.')
  return state.submissionPath
}

async function currentProfile() {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Please sign in first.')
  return getOwnProfile(data.user.id)
}

async function sampleFile(): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 480
  canvas.height = 240
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 480, 240)
  ctx.fillStyle = '#315CCB'
  ctx.font = '24px sans-serif'
  ctx.fillText('LST Learning', 30, 80)
  ctx.fillStyle = '#334155'
  ctx.font = '18px sans-serif'
  ctx.fillText('Storage security test', 30, 130)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value)
      else reject(new Error('PNG creation failed'))
    }, 'image/png')
  })
  return new File([blob], 'storage-test.png', { type: 'image/png' })
}

async function download(bucket: string, path: string) {
  return await supabase.storage.from(bucket).download(
    path,
    { cacheNonce: crypto.randomUUID() },
    { cache: 'no-store' },
  )
}

async function upload(bucket: string, path: string, file: File, upsert = false) {
  return await supabase.storage.from(bucket).upload(path, file, {
    contentType: 'image/png',
    cacheControl: '0',
    upsert,
  })
}

async function assertSameFile(before: Blob, after: Blob) {
  if (before.size !== after.size) throw new Error('FAIL: File size changed.')
  const beforeBytes = new Uint8Array(await before.arrayBuffer())
  const afterBytes = new Uint8Array(await after.arrayBuffer())
  for (let i = 0; i < beforeBytes.length; i++) {
    if (beforeBytes[i] !== afterBytes[i]) throw new Error('FAIL: File content changed.')
  }
}

// 1. Tutor creates assignment, registers file and uploads it.
export async function tutorSetup() {
  const profile = await currentProfile()
  if (profile.role !== 'tutor') throw new Error('Sign in as Tutor.')
  console.log('Starting Tutor storage test...')

  const studentId = readStringField(
    await supabase.from('profiles').select('id')
      .eq('username', 'an12').eq('role', 'student').single(),
    'id',
  )

  const subjects = must<unknown>(
    await supabase.from('subjects').select('id').eq('is_active', true).limit(1),
  )
  if (!Array.isArray(subjects)) throw new Error('Expected a list of subjects.')

  let subjectId: string
  if (subjects.length > 0) {
    subjectId = readStringField({ data: subjects[0], error: null }, 'id')
  } else {
    subjectId = requiredString(must<unknown>(
      await supabase.rpc('tutor_save_subject', {
        p_subject_id: null,
        p_name: 'Storage Test',
        p_description: 'Temporary test subject',
        p_color: '#315CCB',
        p_is_active: true,
      }),
    ), 'subject ID')
  }

  const assignmentId = requiredString(must<unknown>(
    await supabase.rpc('tutor_create_assignment', {
      p_student_id: studentId,
      p_subject_id: subjectId,
      p_title: `Storage Test ${Date.now()}`,
      p_description: 'Test files only',
      p_due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      p_allow_late_submission: true,
    }),
  ), 'assignment ID')
  console.log('Test assignment created:', assignmentId)

  const file = await sampleFile()
  const fileId = requiredString(must<unknown>(
    await supabase.rpc('tutor_register_assignment_file', {
      p_assignment_id: assignmentId,
      p_original_name: file.name,
      p_size_bytes: file.size,
    }),
  ), 'file ID')
  const path = readStringField(
    await supabase.from('assignment_files').select('storage_path').eq('id', fileId).single(),
    'storage_path',
  )
  save({ assignmentId, assignmentPath: path, studentId })

  denied(await upload(ASSIGNMENTS, `${crypto.randomUUID()}/unknown.png`, file), 'Unregistered assignment path')
  denied(await supabase.storage.from(ASSIGNMENTS).createSignedUploadUrl(path), 'Signed upload URL')
  must<unknown>(await upload(ASSIGNMENTS, path, file))
  must<unknown>(await supabase.rpc('tutor_confirm_assignment_file', {
    p_assignment_id: assignmentId,
    p_file_id: fileId,
  }))
  await assertSameFile(file, must<Blob>(await download(ASSIGNMENTS, path)))
  console.log('PASS: Tutor setup and upload')
  console.log('Assignment ID:', assignmentId)
  console.log('Assignment path:', path)
}

// 2. Student reads the assignment and prepares a sealed draft.
export async function studentPrepare() {
  const state = load()
  const profile = await currentProfile()
  if (profile.role !== 'student' || profile.id !== state.studentId) throw new Error('Sign in as an12.')
  console.log('Starting Student draft test...')
  must<Blob>(await download(ASSIGNMENTS, state.assignmentPath))
  console.log('PASS: Student reads assignment file')

  const file = await sampleFile()
  const submissionId = requiredString(must<unknown>(
    await supabase.rpc('student_save_draft', {
      p_assignment_id: state.assignmentId,
      p_files: [{ original_name: file.name, size_bytes: file.size }],
    }),
  ), 'submission ID')
  const path = readStringField(
    await supabase.from('submission_files').select('storage_path').eq('submission_id', submissionId).single(),
    'storage_path',
  )
  denied(await upload(SUBMISSIONS, path, file), 'Upload before start_upload')
  must<unknown>(await supabase.rpc('student_start_upload', { p_assignment_id: state.assignmentId }))
  save({ ...state, submissionPath: path, submissionSize: file.size })
  console.log('PASS: Student draft and upload state')
  console.log('Submission ID:', submissionId)
  console.log('Submission path:', path)
}

// 3. Another account must not upload the student's file.
export async function blockedUpload() {
  const state = load()
  const profile = await currentProfile()
  if (profile.id === state.studentId) throw new Error('Use Tutor, Parent or another student.')
  denied(await upload(SUBMISSIONS, submissionPath(state), await sampleFile()), 'Upload into another student submission')
  console.log('PASS: Unauthorized upload blocked')
}

// 4. Student uploads and verifies actual file content.
export async function studentUpload() {
  const state = load()
  const profile = await currentProfile()
  if (profile.role !== 'student' || profile.id !== state.studentId) throw new Error('Sign in as an12.')
  const file = await sampleFile()
  if (file.size !== state.submissionSize) throw new Error('Test file size changed.')
  const path = submissionPath(state)
  denied(await supabase.storage.from(SUBMISSIONS).createSignedUploadUrl(path), 'Student signed upload URL')
  must<unknown>(await upload(SUBMISSIONS, path, file))
  await assertSameFile(file, must<Blob>(await download(SUBMISSIONS, path)))
  console.log('PASS: Student uploaded draft')
  console.log('Uploaded bytes:', file.size)
}

// 5. Tutor must not read the unsubmitted draft.
export async function tutorBeforeSubmit() {
  const profile = await currentProfile()
  const state = load()
  if (profile.role !== 'tutor') throw new Error('Sign in as Tutor.')
  denied(await download(SUBMISSIONS, submissionPath(state)), 'Tutor reading unsubmitted work', { allowNotFound: true })
  console.log('PASS: Draft remains private')
}

// 6. Submit, retry and confirm the object cannot be overwritten or deleted.
export async function studentSubmit() {
  const state = load()
  const profile = await currentProfile()
  if (profile.role !== 'student' || profile.id !== state.studentId) throw new Error('Sign in as an12.')
  const submittedAt = requiredString(must<unknown>(await supabase.rpc('student_submit_assignment', {
    p_assignment_id: state.assignmentId,
  })), 'submission time')
  const retry = requiredString(must<unknown>(await supabase.rpc('student_submit_assignment', {
    p_assignment_id: state.assignmentId,
  })), 'submission time')
  if (submittedAt !== retry) throw new Error('FAIL: Submission time changed.')
  console.log('PASS: Submission time is protected')

  const path = submissionPath(state)
  const originalFile = must<Blob>(await download(SUBMISSIONS, path))
  denied(await upload(SUBMISSIONS, path, await sampleFile(), true), 'Overwrite submitted file')

  const deletion = await supabase.storage.from(SUBMISSIONS).remove([path])
  if (deletion.data?.length) throw new Error('FAIL: File was deleted.')
  if (deletion.error) {
    denied(deletion, 'Delete submitted file', { allowNotFound: true })
  } else if (!Array.isArray(deletion.data)) {
    throw new Error('INCONCLUSIVE: Unexpected deletion result.')
  } else {
    console.log('PASS: No file was deleted')
  }

  await assertSameFile(originalFile, must<Blob>(await download(SUBMISSIONS, path)))
  console.log('PASS: Submitted file remains intact')
  console.log('Submitted at:', submittedAt)
}

// 7. Tutor can read submitted work.
export async function tutorAfterSubmit() {
  const profile = await currentProfile()
  const state = load()
  if (profile.role !== 'tutor') throw new Error('Sign in as Tutor.')
  must<Blob>(await download(ASSIGNMENTS, state.assignmentPath))
  const file = must<Blob>(await download(SUBMISSIONS, submissionPath(state)))
  if (file.size !== state.submissionSize) throw new Error('FAIL: Downloaded file size mismatch.')
  console.log('PASS: Tutor reads submitted work')
  console.log('Downloaded bytes:', file.size)
}

// 8. Parent, unrelated student or anonymous user cannot download.
export async function blockedRead() {
  const state = load()
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  const allowAnonymous = data.session === null
  if (data.session?.user.id === state.studentId) throw new Error('Use Parent, unrelated student or signed-out browser.')
  denied(await download(ASSIGNMENTS, state.assignmentPath), 'Unauthorized assignment download', { allowNotFound: true, allowAnonymous })
  denied(await download(SUBMISSIONS, submissionPath(state)), 'Unauthorized submission download', { allowNotFound: true, allowAnonymous })
  console.log('PASS: Unauthorized download blocked')
}

// 9. Public object URLs must not expose private content.
export async function publicUrlTest() {
  const state = load()
  const files = [
    { bucket: ASSIGNMENTS, path: state.assignmentPath },
    { bucket: SUBMISSIONS, path: submissionPath(state) },
  ]
  for (const file of files) {
    const { data } = supabase.storage.from(file.bucket).getPublicUrl(file.path)
    const url = new URL(data.publicUrl)
    url.searchParams.set('test', crypto.randomUUID())
    const response = await fetch(url.toString(), { cache: 'no-store', credentials: 'omit' })
    if (response.ok) throw new Error(`FAIL: ${file.bucket} is publicly accessible.`)
    // Private bucket public endpoints may report that the bucket is not found.
    if (response.status === 404) {
      console.log(`PASS: ${file.bucket} public URL blocked`, response.status)
      continue
    }
    const body = await response.text()
    if (response.status === 400 && /bucket.?not.?found|no.?such.?bucket/i.test(body)) {
      console.log(`PASS: ${file.bucket} public URL blocked`, response.status)
      continue
    }
    denied({ error: { message: body, status: response.status } }, `${file.bucket} public URL`, { allowNotFound: true, allowAnonymous: true })
    console.log(`PASS: ${file.bucket} public URL blocked`, response.status)
  }
}
import { supabase } from '../lib/supabase'

export type Assignment = {
  id: string
  title: string
  subject: string
  description: string
  fileName: string
  fileType: 'image' | 'pdf' | 'word' | 'other'
  attachments: { original_name: string; storage_path: string }[]
  assignedAt: string
  dueAt: string
  allowLate: boolean
  submissionId: string | null
  submissionDeadline: string | null
  history: { submitted_at: string; due_at: string; withdrawn_at: string }[]
  returnedAt: string | null
  submittedAt: string | null
}

export async function loadAssignments(studentId: string): Promise<Assignment[]> {
  const { data, error } = await supabase.from('assignments')
    .select('*, subjects(name), assignment_files(original_name,storage_path), submissions(id,submitted_at,due_at_when_submitted,grades(returned_at)), withdrawn_submissions(submitted_at,due_at,withdrawn_at)')
    .eq('student_id', studentId).order('due_at')
  if (error) throw error

  return (data ?? []).filter(row => !row.is_archived && !row.archived_at).map(row => {
    const attachments: Assignment['attachments'] = row.assignment_files ?? []
    const name = attachments[0]?.original_name ?? ''
    const extension = name.split('.').pop()?.toLowerCase() ?? ''
    const current = [row.submissions].flat()[0]
    const history: Assignment['history'] = row.withdrawn_submissions ?? []
    history.sort((a,b) => Date.parse(b.withdrawn_at) - Date.parse(a.withdrawn_at))
    return {
      id: row.id, title: row.title, subject: row.subjects?.name ?? 'Chưa có môn học',
      description: row.description ?? '', attachments,
      fileName: name || 'Chưa có tệp đề',
      fileType: /^(png|jpe?g|webp|heic|heif)$/.test(extension) ? 'image'
        : extension === 'pdf' ? 'pdf' : /^docx?$/.test(extension) ? 'word' : 'other',
      assignedAt: row.assigned_at ?? row.created_at, dueAt: row.due_at,
      allowLate: row.allow_late_submission === true, submissionId: current?.id ?? null,
      returnedAt: current?.submitted_at ? [current.grades].flat()[0]?.returned_at ?? null : null,
      submittedAt: current?.submitted_at ?? null, submissionDeadline: current?.due_at_when_submitted ?? null, history,
    }
  })
}

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { messageOf } from '../../lib/submission'
import ImageReview, { type ImagePin } from './ImageReview'

async function load(id: string, time: string) {
  const grade = await supabase.from('grades')
    .select('score,completion_percent,feedback,revision_requested')
    .eq('submission_id',id).not('returned_at','is',null).maybeSingle()
  if (grade.error) throw grade.error
  if (!grade.data) return null
  const [review, files] = await Promise.all([
    supabase.from('submission_image_reviews').select('pins').eq('submission_id',id).eq('submitted_at',time).maybeSingle(),
    supabase.from('submission_files').select('storage_path,original_name').eq('submission_id',id).order('sort_order'),
  ])
  if (review.error) throw review.error
  if (files.error) throw files.error
  return {grade: grade.data, pins: (review.data?.pins ?? []) as ImagePin[], files: files.data ?? []}
}

export default function ReturnedReview({id, time}: {id:string; time:string}) {
  const [result,setResult] = useState<Awaited<ReturnType<typeof load>>>()
  const [error,setError] = useState('')
  const [version,setVersion] = useState(0)
  useEffect(() => {
    let active = true
    setError('')
    setResult(undefined)
    void load(id,time).then(value => { if (active) setResult(value) })
      .catch(e => { if (active) setError(messageOf(e)) })
    return () => { active = false }
  },[id,time,version])
  if (error) return <p role="alert">{error} <button type="button" onClick={() => setVersion(v=>v+1)}>Thử lại</button></p>
  if (!result) return <p className="text-sm text-slate-600">{result === null ? 'Đang chờ gia sư trả kết quả.' : 'Đang mở kết quả…'}</p>
  const {grade, files, pins} = result
  return <section className="space-y-3 rounded-xl border border-green-200 bg-white p-4">
    <h3 className="font-bold">Kết quả của gia sư</h3>
    <p>Hoàn thành {grade.completion_percent}%{grade.score != null && ' · Điểm '+grade.score+'/10'}</p>
    {grade.revision_requested && <strong>Gia sư yêu cầu sửa bài</strong>}
    {grade.feedback && <p className="whitespace-pre-wrap">{grade.feedback}</p>}
    <ImageReview files={files} pins={pins}/>
  </section>
}

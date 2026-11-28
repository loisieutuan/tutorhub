begin;
create or replace function public.tutor_correct_returned_grade(
  p_assignment_id uuid, p_expected_submission_id uuid, p_completion_percent integer,
  p_score numeric, p_feedback text, p_revision_requested boolean, p_return_now boolean,
  p_pins jsonb, p_reviewed_at timestamptz, p_previous_return timestamptz
) returns void language plpgsql security definer set search_path='' as $$
begin
  perform lst_private.lock_tutor_assignment(p_assignment_id, lst_private.require_tutor_for_write());
  if p_return_now is distinct from true or p_previous_return is null then
    raise exception 'Hãy mở lại kết quả đã trả.';
  end if;

  -- Only the current published version can be corrected. The temporary transition
  -- and republication share one transaction and the same assignment lock as withdrawal.
  update public.grades g set returned_at=null
  from public.submissions s
  where s.assignment_id=p_assignment_id and s.id=p_expected_submission_id
    and s.submitted_at=p_reviewed_at and g.submission_id=s.id
    and g.returned_at=p_previous_return;
  if not found then
    raise exception 'Kết quả đã thay đổi. Hãy làm mới trước khi sửa.';
  end if;

  perform public.tutor_grade_with_image_pins(p_assignment_id,p_expected_submission_id,
    p_completion_percent,p_score,p_feedback,p_revision_requested,true,p_pins,p_reviewed_at);
end;
$$;
revoke all on function public.tutor_correct_returned_grade(uuid,uuid,integer,numeric,text,boolean,boolean,jsonb,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.tutor_correct_returned_grade(uuid,uuid,integer,numeric,text,boolean,boolean,jsonb,timestamptz,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;

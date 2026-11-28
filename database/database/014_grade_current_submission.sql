begin;

create or replace function lst_private.grade_current_submission(
  p_assignment_id uuid,
  p_expected_submission_id uuid,
  p_completion_percent integer,
  p_score numeric,
  p_feedback text,
  p_revision_requested boolean,
  p_return_now boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor_id uuid;
begin
  v_tutor_id := lst_private.require_tutor_for_write();

  -- Dùng cùng khóa với quy trình chấm và rút bài của dự án.
  perform lst_private.lock_tutor_assignment(p_assignment_id, v_tutor_id);

  if not exists (
    select 1
    from public.submissions s
    where s.assignment_id = p_assignment_id
      and s.id = p_expected_submission_id
      and s.submitted_at is not null
  ) then
    raise exception 'Học sinh đã rút hoặc thay bài nộp. Hãy làm mới danh sách trước khi chấm.';
  end if;

  return lst_private.tutor_save_grade(
    p_assignment_id,
    p_completion_percent,
    p_score,
    p_feedback,
    p_revision_requested,
    p_return_now
  );
end;
$$;

create or replace function public.tutor_grade_current_submission(
  p_assignment_id uuid,
  p_expected_submission_id uuid,
  p_completion_percent integer,
  p_score numeric,
  p_feedback text,
  p_revision_requested boolean,
  p_return_now boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.grade_current_submission(
    p_assignment_id,
    p_expected_submission_id,
    p_completion_percent,
    p_score,
    p_feedback,
    p_revision_requested,
    p_return_now
  );
$$;

revoke all on function
  lst_private.grade_current_submission(uuid, uuid, integer, numeric, text, boolean, boolean),
  public.tutor_grade_current_submission(uuid, uuid, integer, numeric, text, boolean, boolean)
from public, anon, authenticated;

grant execute on function
  lst_private.grade_current_submission(uuid, uuid, integer, numeric, text, boolean, boolean),
  public.tutor_grade_current_submission(uuid, uuid, integer, numeric, text, boolean, boolean)
to authenticated;

notify pgrst, 'reload schema';

commit;
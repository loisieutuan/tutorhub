begin;
create or replace function lst_private.withdraw_submission(p_assignment_id uuid, p_expected_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  a public.assignments;
  s public.submissions;
  t timestamptz;
begin
  a := lst_private.lock_student_assignment(p_assignment_id);
  -- A retry acts only on the exact attempt displayed by the client.
  select h.withdrawn_at into t from public.withdrawn_submissions h
    where h.id = p_expected_id and h.assignment_id = a.id;
  if found then return t; end if;
  if a.is_archived then raise exception 'Bài tập đã lưu trữ.'; end if;
  select * into s from public.submissions where id = p_expected_id and assignment_id = a.id for update;
  if not found or s.submitted_at is null then raise exception 'Bài nộp đã thay đổi. Hãy tải lại trang.'; end if;
  if exists (
    select 1 from public.grades g where g.submission_id = s.id and g.returned_at is not null
  ) then
    raise exception 'Gia sư đã trả kết quả. Bạn không thể rút bài đã chấm.';
  end if;
  insert into public.withdrawn_submissions(id,assignment_id,submitted_at,due_at,file_records,grade_record)
  values (s.id,a.id,s.submitted_at,s.due_at_when_submitted,
    (select coalesce(jsonb_agg(to_jsonb(f) order by f.sort_order),'[]'::jsonb)
     from public.submission_files f where f.submission_id = s.id),
    (select to_jsonb(g) from public.grades g where g.submission_id = s.id))
  returning withdrawn_at into t;
  delete from public.grades where submission_id = s.id;
  delete from public.submission_files where submission_id = s.id;
  delete from public.submissions where id = s.id;
  return t;
end;
$$;
commit;

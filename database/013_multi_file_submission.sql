begin;

create function lst_private.prepare_submission_files(
  p_assignment_id uuid, p_expected_id uuid, p_request_id uuid, p_files jsonb
) returns table(draft_id uuid, object_path text, position_in_list smallint)
language plpgsql security definer set search_path = '' as $$
declare
  a public.assignments;
  s public.submissions;
  new_id uuid;
begin
  a := lst_private.lock_student_assignment(p_assignment_id);
  if a.is_archived or p_request_id is null then
    raise exception 'Bài tập hoặc yêu cầu tải tệp không hợp lệ.';
  end if;
  select * into s from public.submissions where assignment_id = a.id for update;
  if s.submitted_at is not null then
    raise exception 'Bài đã nộp. Hãy tải lại trang và rút bài trước khi đổi tệp.';
  end if;
  if jsonb_typeof(p_files) is distinct from 'array' then raise exception 'Danh sách tệp không hợp lệ.'; end if;
  if jsonb_array_length(p_files) not between 1 and 50 then raise exception 'Chọn từ 1 đến 50 tệp.'; end if;
  if s.draft_request_id = p_request_id then
    if p_files is distinct from (
      select jsonb_agg(jsonb_build_object('original_name',f.original_name,'size_bytes',f.size_bytes) order by f.sort_order)
      from public.submission_files f where f.submission_id=s.id
    ) then raise exception 'Danh sách tệp đã thay đổi.'; end if;
    return query select s.id, f.storage_path, f.sort_order from public.submission_files f
      where f.submission_id=s.id order by f.sort_order;
    return;
  end if;
  if s.id is distinct from p_expected_id then
    raise exception 'Bản nháp đã thay đổi ở một phiên khác. Hãy tải lại trang.';
  end if;
  if s.id is not null then
    insert into lst_private.replaced_draft_files(storage_path)
      select f.storage_path from public.submission_files f where f.submission_id = s.id;
    delete from public.submission_files where submission_id = s.id;
    delete from public.submissions where id = s.id;
  end if;
  new_id := lst_private.student_save_draft(a.id,p_files);
  perform lst_private.student_start_upload(a.id);
  update public.submissions set draft_request_id=p_request_id where id=new_id;
  return query select new_id,f.storage_path,f.sort_order from public.submission_files f where f.submission_id=new_id order by f.sort_order;
end;
$$;
create function public.student_prepare_submission_files(
  p_assignment_id uuid, p_expected_id uuid, p_request_id uuid, p_files jsonb
) returns table(draft_id uuid, object_path text, position_in_list smallint)
language sql security invoker set search_path = '' as $$
  select * from lst_private.prepare_submission_files(p_assignment_id,p_expected_id,p_request_id,p_files);
$$;
revoke all on function lst_private.prepare_submission_files(uuid,uuid,uuid,jsonb),
 public.student_prepare_submission_files(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function lst_private.prepare_submission_files(uuid,uuid,uuid,jsonb),
 public.student_prepare_submission_files(uuid,uuid,uuid,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;

begin;

alter table public.submissions add column draft_request_id uuid;
-- Retain the old paths for Storage maintenance without keeping them active.
create table lst_private.replaced_draft_files (
  storage_path text primary key,
  replaced_at timestamptz not null default clock_timestamp()
);
revoke all on lst_private.replaced_draft_files from public, anon, authenticated;

create function lst_private.prepare_single_file(
  p_assignment_id uuid, p_expected_id uuid, p_request_id uuid, p_name text, p_size bigint
) returns table(draft_id uuid, object_path text)
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
  if s.draft_request_id = p_request_id then
    return query select s.id, f.storage_path from public.submission_files f
      where f.submission_id = s.id and f.original_name = p_name and f.size_bytes = p_size;
    if not found then raise exception 'Yêu cầu tải lại không khớp với tệp đã chọn.'; end if;
    return;
  end if;
  if s.id is distinct from p_expected_id then
    raise exception 'Bản nháp đã thay đổi ở một phiên khác. Hãy tải lại trang.';
  end if;
  if s.id is not null then
    if (select count(*) from public.submission_files where submission_id=s.id) > 1 then
      raise exception 'Bản nháp có nhiều tệp. Không thể thay bằng một tệp trong màn hình này.';
    end if;
    insert into lst_private.replaced_draft_files(storage_path)
      select f.storage_path from public.submission_files f where f.submission_id = s.id;
    delete from public.submission_files where submission_id = s.id;
    delete from public.submissions where id = s.id;
  end if;
  new_id := lst_private.student_save_draft(a.id,jsonb_build_array(
    jsonb_build_object('original_name',p_name,'size_bytes',p_size)));
  perform lst_private.student_start_upload(a.id);
  update public.submissions set draft_request_id=p_request_id where id=new_id;
  return query select new_id,f.storage_path from public.submission_files f where f.submission_id=new_id;
end;
$$;
create function public.student_prepare_single_file(
  p_assignment_id uuid, p_expected_id uuid, p_request_id uuid, p_name text, p_size bigint
) returns table(draft_id uuid, object_path text)
language sql security invoker set search_path = '' as $$
  select * from lst_private.prepare_single_file(p_assignment_id,p_expected_id,p_request_id,p_name,p_size);
$$;
revoke all on function lst_private.prepare_single_file(uuid,uuid,uuid,text,bigint),
 public.student_prepare_single_file(uuid,uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function lst_private.prepare_single_file(uuid,uuid,uuid,text,bigint),
 public.student_prepare_single_file(uuid,uuid,uuid,text,bigint) to authenticated;
notify pgrst, 'reload schema';
commit;

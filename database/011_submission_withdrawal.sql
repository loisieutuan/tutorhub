begin;

-- Keep the existing Storage and RPC checks, including the lock on archived work.
create function lst_private.accept_late_work() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.allow_late_submission := true;
  return new;
end;
$$;
revoke all on function lst_private.accept_late_work() from public, anon, authenticated;
create trigger assignments_accept_late_work before insert or update of allow_late_submission
on public.assignments for each row execute function lst_private.accept_late_work();
update public.assignments set allow_late_submission = true where not allow_late_submission;

-- Freeze the applicable deadline when the server timestamps the submission.
alter table public.submissions add column due_at_when_submitted timestamptz;
update public.submissions s set due_at_when_submitted = a.due_at from public.assignments a
where s.assignment_id = a.id and s.submitted_at is not null;
create function lst_private.capture_submission_deadline() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    select a.due_at into strict new.due_at_when_submitted
    from public.assignments a where a.id = new.assignment_id;
  end if;
  return new;
end;
$$;
revoke all on function lst_private.capture_submission_deadline() from public, anon, authenticated;
create trigger capture_submission_deadline before update of submitted_at on public.submissions
for each row execute function lst_private.capture_submission_deadline();

-- Preserve the previous attempt and any assessment. Only timestamps are exposed to the UI.
create table public.withdrawn_submissions (
  id uuid primary key,
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  submitted_at timestamptz not null,
  due_at timestamptz not null,
  withdrawn_at timestamptz not null default clock_timestamp(),
  file_records jsonb not null,
  grade_record jsonb
);
create index withdrawn_submissions_assignment_idx on public.withdrawn_submissions(assignment_id, withdrawn_at desc);
alter table public.withdrawn_submissions enable row level security;
revoke all on public.withdrawn_submissions from public, anon, authenticated;
grant select (id, assignment_id, submitted_at, due_at, withdrawn_at) on public.withdrawn_submissions to authenticated;
create policy withdrawn_read_participant on public.withdrawn_submissions for select to authenticated
using (exists (
  select 1 from public.assignments a where a.id = assignment_id
  and (a.student_id = (select auth.uid()) or a.tutor_id = (select auth.uid()))
));

create function lst_private.withdraw_submission(p_assignment_id uuid, p_expected_id uuid)
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
create function public.student_withdraw_submission(p_assignment_id uuid, p_expected_id uuid)
returns timestamptz language sql security invoker set search_path = '' as $$
  select lst_private.withdraw_submission(p_assignment_id,p_expected_id);
$$;

-- A stale submit button must never finalize another tab's replacement attempt.
create function lst_private.submit_current_work(p_assignment_id uuid,p_expected_id uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
begin
  perform lst_private.lock_student_assignment(p_assignment_id);
  if not exists(select 1 from public.submissions where assignment_id=p_assignment_id and id=p_expected_id)
  then raise exception 'Bản nháp đã thay đổi. Hãy tải lại trang.'; end if;
  return lst_private.student_submit_assignment(p_assignment_id);
end;
$$;
create function public.student_submit_current_work(p_assignment_id uuid,p_expected_id uuid)
returns timestamptz language sql security invoker set search_path = '' as $$
  select lst_private.submit_current_work(p_assignment_id,p_expected_id);
$$;
revoke all on function lst_private.withdraw_submission(uuid,uuid), public.student_withdraw_submission(uuid,uuid),
 lst_private.submit_current_work(uuid,uuid), public.student_submit_current_work(uuid,uuid) from public, anon, authenticated;
grant execute on function lst_private.withdraw_submission(uuid,uuid), public.student_withdraw_submission(uuid,uuid),
 lst_private.submit_current_work(uuid,uuid), public.student_submit_current_work(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

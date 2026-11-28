begin;
create table if not exists public.submission_image_reviews (
  submission_id uuid not null references public.submissions(id) on delete cascade,
  submitted_at timestamptz not null,
  pins jsonb not null check (jsonb_typeof(pins) = 'array'),
  primary key (submission_id, submitted_at)
);
alter table public.submission_image_reviews enable row level security;
revoke all on public.submission_image_reviews from public, anon, authenticated;
grant select on public.submission_image_reviews to authenticated;
drop policy if exists "Participants can read image reviews" on public.submission_image_reviews;
create policy "Participants can read image reviews" on public.submission_image_reviews
for select to authenticated using (exists (
  select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id
  where s.id=submission_image_reviews.submission_id
    and s.submitted_at=submission_image_reviews.submitted_at
    and (a.tutor_id=(select auth.uid()) or
      (a.student_id=(select auth.uid()) and exists (
        select 1 from public.grades g where g.submission_id=s.id and g.returned_at is not null)))
));
create or replace function public.tutor_grade_with_image_pins(
  p_assignment_id uuid, p_expected_submission_id uuid, p_completion_percent integer,
  p_score numeric, p_feedback text, p_revision_requested boolean, p_return_now boolean,
  p_pins jsonb default '[]'::jsonb, p_reviewed_at timestamptz default null
) returns void language plpgsql security definer set search_path='' as $$
declare
  pin jsonb;
begin
  perform lst_private.lock_tutor_assignment(p_assignment_id, lst_private.require_tutor_for_write());
  if not exists(select 1 from public.submissions where id=p_expected_submission_id
    and assignment_id=p_assignment_id and submitted_at=p_reviewed_at) then
    raise exception 'Lần nộp đã thay đổi. Hãy mở lại bài.';
  end if;
  if jsonb_typeof(p_pins) is distinct from 'array' then raise exception 'Danh sách ghim không hợp lệ.'; end if;
  for pin in select value from jsonb_array_elements(p_pins) loop
    if jsonb_typeof(pin->'text') is distinct from 'string'
      or length(trim(pin->>'text')) not between 1 and 2000
      or jsonb_typeof(pin->'id') is distinct from 'string' or length(pin->>'id')=0
      or jsonb_typeof(pin->'x') is distinct from 'number' or (pin->>'x')::numeric not between 0 and 1
      or jsonb_typeof(pin->'y') is distinct from 'number' or (pin->>'y')::numeric not between 0 and 1
      or not exists(select 1 from public.submission_files f where f.submission_id=p_expected_submission_id
        and f.storage_path=pin->>'path') then raise exception 'Kiểm tra nội dung và vị trí của ghim.'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_pins) p group by p->>'id' having count(*)>1)
    then raise exception 'Mã ghim bị trùng.'; end if;
  perform lst_private.grade_current_submission(p_assignment_id,p_expected_submission_id,p_completion_percent,
    p_score,p_feedback,p_revision_requested,p_return_now);
  insert into public.submission_image_reviews values(p_expected_submission_id,p_reviewed_at,p_pins)
    on conflict(submission_id,submitted_at) do update set pins=excluded.pins;
end;
$$;
revoke all on function public.tutor_grade_with_image_pins(uuid,uuid,integer,numeric,text,boolean,boolean,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.tutor_grade_with_image_pins(uuid,uuid,integer,numeric,text,boolean,boolean,jsonb,timestamptz) to authenticated;
notify pgrst,'reload schema';
commit;

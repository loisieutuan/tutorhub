
begin;

-- ==========================================
-- PARENT LEARNING PROGRESS
-- ==========================================

create function lst_private.parent_learning_progress()

returns table (
  student_id uuid,
  student_name text,
  assignment_id uuid,
  subject_name text,
  assignment_title text,
  assigned_at timestamptz,
  due_at timestamptz,
  submitted_at timestamptz,
  completion_percent smallint,
  score numeric,
  revision_requested boolean,
  returned_at timestamptz,
  is_archived boolean
)

language sql
stable
security definer
set search_path = ''

as $$

  select
    s.id,
    s.full_name,
    a.id,
    sub.name,
    a.title,
    a.assigned_at,
    a.due_at,
    sm.submitted_at,
    g.completion_percent,
    g.score,
    g.revision_requested,
    g.returned_at,
    a.is_archived

  from public.parent_students ps

  join public.profiles p
    on p.id = ps.parent_id
    and p.role = 'parent'
    and p.is_active = true

  join public.profiles s
    on s.id = ps.student_id
    and s.role = 'student'
    and s.is_active = true

  join public.assignments a
    on a.student_id = s.id

  join public.tutor_students ts
    on ts.tutor_id = a.tutor_id
    and ts.student_id = a.student_id
    and ts.is_active = true

  join public.profiles t
    on t.id = a.tutor_id
    and t.role = 'tutor'
    and t.is_active = true

  join public.subjects sub
    on sub.id = a.subject_id
    and sub.tutor_id = a.tutor_id

  left join public.submissions sm
    on sm.assignment_id = a.id
    and sm.submitted_at is not null

  left join public.grades g
    on g.submission_id = sm.id
    and g.returned_at is not null

  where ps.parent_id = (select auth.uid())
    and ps.is_active = true

  order by a.due_at, a.id;

$$;


-- ==========================================
-- PUBLIC RPC
-- ==========================================

create function public.get_parent_learning_progress()

returns table (
  student_id uuid,
  student_name text,
  assignment_id uuid,
  subject_name text,
  assignment_title text,
  assigned_at timestamptz,
  due_at timestamptz,
  submitted_at timestamptz,
  completion_percent smallint,
  score numeric,
  revision_requested boolean,
  returned_at timestamptz,
  is_archived boolean
)

language sql
stable
security invoker
set search_path = ''

as $$
  select *
  from lst_private.parent_learning_progress();
$$;


-- ==========================================
-- FUNCTION PERMISSIONS
-- ==========================================

revoke all privileges
on function lst_private.parent_learning_progress()

from public, anon, authenticated;

grant execute
on function lst_private.parent_learning_progress()

to authenticated;


revoke all privileges
on function public.get_parent_learning_progress()

from public, anon, authenticated;

grant execute
on function public.get_parent_learning_progress()

to authenticated;


commit;

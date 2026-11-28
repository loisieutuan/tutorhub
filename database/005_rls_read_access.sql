
begin;

-- ==========================================
-- LST LEARNING
-- PHASE 8D.1 - ROW LEVEL SECURITY
-- ==========================================


-- ==========================================
-- 1. PRIVATE SCHEMA
-- ==========================================

create schema lst_private;

revoke all on schema lst_private
from public, anon, authenticated;

grant usage on schema lst_private
to authenticated;


-- ==========================================
-- 2. ACTIVE ACCOUNT ROLE
-- ==========================================

create function lst_private.active_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active = true;
$$;


-- ==========================================
-- 3. TUTOR - STUDENT ACCESS
-- ==========================================

create function lst_private.can_access_tutor_student(
  p_tutor_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tutor_students ts

    join public.profiles t
      on t.id = ts.tutor_id

    join public.profiles s
      on s.id = ts.student_id

    where ts.tutor_id = p_tutor_id
      and ts.student_id = p_student_id

      and ts.is_active = true

      and t.role = 'tutor'
      and t.is_active = true

      and s.role = 'student'
      and s.is_active = true

      and (
        t.id = (select auth.uid())
        or s.id = (select auth.uid())
      )
  );
$$;


-- ==========================================
-- 4. PARENT - STUDENT ACCESS
-- ==========================================

create function lst_private.can_access_parent_student(
  p_parent_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.parent_students ps

    join public.profiles p
      on p.id = ps.parent_id

    join public.profiles s
      on s.id = ps.student_id

    where ps.parent_id = p_parent_id
      and ps.student_id = p_student_id

      and ps.parent_id = (select auth.uid())

      and ps.is_active = true

      and p.role = 'parent'
      and p.is_active = true

      and s.role = 'student'
      and s.is_active = true
  );
$$;


-- ==========================================
-- 5. ENABLE RLS
-- ==========================================

alter table public.profiles
  enable row level security;

alter table public.tutor_students
  enable row level security;

alter table public.parent_students
  enable row level security;

alter table public.subjects
  enable row level security;

alter table public.assignments
  enable row level security;

alter table public.assignment_files
  enable row level security;

alter table public.submissions
  enable row level security;

alter table public.submission_files
  enable row level security;

alter table public.grades
  enable row level security;


-- ==========================================
-- 6. RESET TABLE PRIVILEGES
-- ==========================================

revoke all privileges on table
  public.profiles,
  public.tutor_students,
  public.parent_students,
  public.subjects,
  public.assignments,
  public.assignment_files,
  public.submissions,
  public.submission_files,
  public.grades

from public, anon, authenticated;


-- ==========================================
-- 7. AUTHENTICATED READ ACCESS
-- ==========================================

grant usage on schema public
to authenticated;

grant select on table
  public.profiles,
  public.tutor_students,
  public.parent_students,
  public.subjects,
  public.assignments,
  public.assignment_files,
  public.submissions,
  public.submission_files,
  public.grades

to authenticated;


-- ==========================================
-- 8. PROFILES POLICY
-- Giu policy profiles_read_own tu buoc 8C
-- ==========================================

create policy profiles_read_related
on public.profiles

for select
to authenticated

using (

  exists (
    select 1
    from public.tutor_students ts
    where (
      ts.tutor_id = (select auth.uid())
      and ts.student_id = profiles.id
    )
    or (
      ts.student_id = (select auth.uid())
      and ts.tutor_id = profiles.id
    )
  )

  or exists (
    select 1
    from public.parent_students ps
    where ps.parent_id = (select auth.uid())
      and ps.student_id = profiles.id
  )

);


-- ==========================================
-- 9. TUTOR STUDENTS POLICY
-- ==========================================

create policy tutor_students_read_related
on public.tutor_students

for select
to authenticated

using (
  lst_private.can_access_tutor_student(
    tutor_id,
    student_id
  )
);


-- ==========================================
-- 10. PARENT STUDENTS POLICY
-- ==========================================

create policy parent_students_read_own
on public.parent_students

for select
to authenticated

using (
  lst_private.can_access_parent_student(
    parent_id,
    student_id
  )
);


-- ==========================================
-- 11. SUBJECTS POLICY
-- ==========================================

create policy subjects_read_related
on public.subjects

for select
to authenticated

using (

  (
    (select lst_private.active_role()) = 'tutor'
    and tutor_id = (select auth.uid())
  )

  or

  (
    (select lst_private.active_role()) = 'student'

    and exists (
      select 1
      from public.assignments a
      where a.subject_id = subjects.id
    )
  )

);


-- ==========================================
-- 12. ASSIGNMENTS POLICY
-- ==========================================

create policy assignments_read_related
on public.assignments

for select
to authenticated

using (
  lst_private.can_access_tutor_student(
    tutor_id,
    student_id
  )
);


-- ==========================================
-- 13. ASSIGNMENT FILES POLICY
-- ==========================================

create policy assignment_files_read_related
on public.assignment_files

for select
to authenticated

using (

  exists (
    select 1
    from public.assignments a
    where a.id = assignment_files.assignment_id
  )

  and (
    (select lst_private.active_role()) = 'tutor'
    or uploaded_at is not null
  )

);


-- ==========================================
-- 14. SUBMISSIONS POLICY
-- ==========================================

create policy submissions_read_related
on public.submissions

for select
to authenticated

using (

  exists (
    select 1
    from public.assignments a
    where a.id = submissions.assignment_id
  )

  and (
    (select lst_private.active_role()) = 'student'
    or submitted_at is not null
  )

);


-- ==========================================
-- 15. SUBMISSION FILES POLICY
-- ==========================================

create policy submission_files_read_related
on public.submission_files

for select
to authenticated

using (

  exists (
    select 1
    from public.submissions s
    where s.id = submission_files.submission_id
  )

  and (
    (select lst_private.active_role()) = 'student'
    or uploaded_at is not null
  )

);


-- ==========================================
-- 16. GRADES POLICY
-- ==========================================

create policy grades_read_related
on public.grades

for select
to authenticated

using (

  exists (
    select 1
    from public.submissions s
    where s.id = grades.submission_id
  )

  and (
    (select lst_private.active_role()) = 'tutor'
    or returned_at is not null
  )

);


-- ==========================================
-- 17. RESTRICT FUNCTION EXECUTION
-- ==========================================

revoke all privileges on all functions
in schema lst_private

from public, anon, authenticated;

grant execute on all functions
in schema lst_private

to authenticated;


-- ==========================================
-- COMPLETE
-- ==========================================

commit;

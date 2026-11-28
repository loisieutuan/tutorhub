
begin;

-- ==========================================
-- LST LEARNING
-- PHASE 8D.2 - TUTOR WRITE ACCESS
-- ==========================================


-- ==========================================
-- 1. REQUIRE ACTIVE TUTOR
-- Kiem tra tai khoan gia su
-- ==========================================

create function lst_private.require_tutor_for_write()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tutor_id uuid;
begin

  select p.id
  into v_tutor_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.role = 'tutor'
    and p.is_active = true
  for share;

  if not found then
    raise exception
      'Tutor access denied.'
      using errcode = '42501';
  end if;

  return v_tutor_id;

end;
$$;


-- ==========================================
-- 2. REQUIRE ACTIVE STUDENT RELATIONSHIP
-- Kiem tra hoc sinh thuoc gia su
-- ==========================================

create function lst_private.require_student_link(
  p_tutor_id uuid,
  p_student_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin

  perform 1
  from public.tutor_students ts
  join public.profiles s
    on s.id = ts.student_id
  where ts.tutor_id = p_tutor_id
    and ts.student_id = p_student_id
    and ts.is_active = true
    and s.role = 'student'
    and s.is_active = true
  for share of ts, s;

  if not found then
    raise exception
      'Student access denied.'
      using errcode = '42501';
  end if;

end;
$$;


-- ==========================================
-- 3. LOCK ASSIGNMENT
-- Kiem tra quyen va khoa bai tap khi sua
-- ==========================================

create function lst_private.lock_tutor_assignment(
  p_assignment_id uuid,
  p_tutor_id uuid
)
returns public.assignments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
begin

  select a.*
  into v_assignment
  from public.assignments a
  where a.id = p_assignment_id
    and a.tutor_id = p_tutor_id
  for update;

  if not found then
    raise exception
      'Assignment access denied.'
      using errcode = '42501';
  end if;

  perform lst_private.require_student_link(
    p_tutor_id,
    v_assignment.student_id
  );

  return v_assignment;

end;
$$;


-- ==========================================
-- 4. SAVE SUBJECT
-- Tao hoac cap nhat mon hoc
-- ==========================================

create function lst_private.tutor_save_subject(
  p_subject_id uuid,
  p_name text,
  p_description text,
  p_color text,
  p_is_active boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor_id uuid;
  v_subject_id uuid;
begin

  v_tutor_id :=
    lst_private.require_tutor_for_write();

  if p_is_active is null then
    raise exception
      'Subject status is required.'
      using errcode = '22023';
  end if;


  -- NULL subject ID: create new subject

  if p_subject_id is null then

    insert into public.subjects (
      tutor_id,
      name,
      description,
      color,
      is_active
    )
    values (
      v_tutor_id,
      trim(p_name),
      coalesce(p_description, ''),
      p_color,
      p_is_active
    )
    returning id into v_subject_id;


  -- Existing subject ID: update subject

  else

    update public.subjects
    set
      name = trim(p_name),
      description = coalesce(p_description, ''),
      color = p_color,
      is_active = p_is_active
    where id = p_subject_id
      and tutor_id = v_tutor_id

    returning id into v_subject_id;

    if not found then
      raise exception
        'Subject access denied.'
        using errcode = '42501';
    end if;

  end if;

  return v_subject_id;

end;
$$;


-- ==========================================
-- 5. CREATE ASSIGNMENT
-- Giao bai tap moi
-- ==========================================

create function lst_private.tutor_create_assignment(
  p_student_id uuid,
  p_subject_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_allow_late_submission boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor_id uuid;
  v_assignment_id uuid;
  v_assigned_at timestamptz;
begin

  v_tutor_id :=
    lst_private.require_tutor_for_write();


  -- Verify student relationship

  perform lst_private.require_student_link(
    v_tutor_id,
    p_student_id
  );


  -- Verify subject ownership and status

  perform 1
  from public.subjects s
  where s.id = p_subject_id
    and s.tutor_id = v_tutor_id
    and s.is_active = true
  for share;

  if not found then
    raise exception
      'Subject is unavailable.'
      using errcode = '42501';
  end if;


  -- Server-generated assignment time

  v_assigned_at := clock_timestamp();

  if p_due_at is null
    or not isfinite(p_due_at)
    or p_due_at <= v_assigned_at then

    raise exception
      'Deadline must be in the future.'
      using errcode = '22023';

  end if;

  if p_allow_late_submission is null then
    raise exception
      'Late submission setting is required.'
      using errcode = '22023';
  end if;


  -- Create assignment

  insert into public.assignments (
    tutor_id,
    student_id,
    subject_id,
    title,
    description,
    assigned_at,
    due_at,
    allow_late_submission,
    is_archived
  )
  values (
    v_tutor_id,
    p_student_id,
    p_subject_id,
    trim(p_title),
    coalesce(p_description, ''),
    v_assigned_at,
    p_due_at,
    p_allow_late_submission,
    false
  )
  returning id into v_assignment_id;

  return v_assignment_id;

end;
$$;


-- ==========================================
-- 6. UPDATE ASSIGNMENT
-- Sua noi dung va deadline
-- ==========================================

create function lst_private.tutor_update_assignment(
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_allow_late_submission boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor_id uuid;
  v_assignment public.assignments%rowtype;
begin

  v_tutor_id :=
    lst_private.require_tutor_for_write();

  v_assignment :=
    lst_private.lock_tutor_assignment(
      p_assignment_id,
      v_tutor_id
    );


  -- Archived assignments cannot be edited

  if v_assignment.is_archived then

    raise exception
      'Restore the archived assignment before editing.'
      using errcode = '55000';

  end if;


  -- Protect submitted assignments

  if exists (
    select 1
    from public.submissions s
    where s.assignment_id = p_assignment_id
      and s.submitted_at is not null
  ) then

    raise exception
      'Submitted assignments cannot be edited.'
      using errcode = '55000';

  end if;


  -- Validate deadline

  if p_due_at is null
    or not isfinite(p_due_at)
    or p_due_at <= v_assignment.assigned_at then

    raise exception
      'Invalid deadline.'
      using errcode = '22023';

  end if;


  -- Changed deadline must be in the future.
  -- An unchanged past deadline can remain.

  if p_due_at is distinct from v_assignment.due_at
    and p_due_at <= clock_timestamp() then

    raise exception
      'New deadline must be in the future.'
      using errcode = '22023';

  end if;

  if p_allow_late_submission is null then
    raise exception
      'Late submission setting is required.'
      using errcode = '22023';
  end if;


  -- Only permitted columns can be changed

  update public.assignments
  set
    title = trim(p_title),
    description = coalesce(p_description, ''),
    due_at = p_due_at,
    allow_late_submission = p_allow_late_submission
  where id = p_assignment_id
    and tutor_id = v_tutor_id;

  return p_assignment_id;

end;
$$;


-- ==========================================
-- 7. ARCHIVE / RESTORE ASSIGNMENT
-- Luu tru hoac khoi phuc bai tap
-- ==========================================

create function lst_private.tutor_set_assignment_archived(
  p_assignment_id uuid,
  p_is_archived boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor_id uuid;
begin

  v_tutor_id :=
    lst_private.require_tutor_for_write();

  perform lst_private.lock_tutor_assignment(
    p_assignment_id,
    v_tutor_id
  );

  if p_is_archived is null then

    raise exception
      'Archive status is required.'
      using errcode = '22023';

  end if;

  update public.assignments
  set is_archived = p_is_archived
  where id = p_assignment_id
    and tutor_id = v_tutor_id;

  return p_assignment_id;

end;
$$;


-- ==========================================
-- 8. PUBLIC RPC WRAPPERS
-- API cho frontend
-- ==========================================

create function public.tutor_save_subject(
  p_subject_id uuid,
  p_name text,
  p_description text,
  p_color text,
  p_is_active boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.tutor_save_subject(
    p_subject_id,
    p_name,
    p_description,
    p_color,
    p_is_active
  );
$$;


create function public.tutor_create_assignment(
  p_student_id uuid,
  p_subject_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_allow_late_submission boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.tutor_create_assignment(
    p_student_id,
    p_subject_id,
    p_title,
    p_description,
    p_due_at,
    p_allow_late_submission
  );
$$;


create function public.tutor_update_assignment(
  p_assignment_id uuid,
  p_title text,
  p_description text,
  p_due_at timestamptz,
  p_allow_late_submission boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.tutor_update_assignment(
    p_assignment_id,
    p_title,
    p_description,
    p_due_at,
    p_allow_late_submission
  );
$$;


create function public.tutor_set_assignment_archived(
  p_assignment_id uuid,
  p_is_archived boolean
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.tutor_set_assignment_archived(
    p_assignment_id,
    p_is_archived
  );
$$;


-- ==========================================
-- 9. PROTECT INTERNAL HELPERS
-- ==========================================

revoke all privileges on function
  lst_private.require_tutor_for_write(),
  lst_private.require_student_link(uuid, uuid),
  lst_private.lock_tutor_assignment(uuid, uuid)

from public, anon, authenticated;


-- ==========================================
-- 10. REVOKE DEFAULT RPC PERMISSIONS
-- ==========================================

revoke all privileges on function

  lst_private.tutor_save_subject(
    uuid, text, text, text, boolean
  ),

  lst_private.tutor_create_assignment(
    uuid, uuid, text, text, timestamptz, boolean
  ),

  lst_private.tutor_update_assignment(
    uuid, text, text, timestamptz, boolean
  ),

  lst_private.tutor_set_assignment_archived(
    uuid, boolean
  ),

  public.tutor_save_subject(
    uuid, text, text, text, boolean
  ),

  public.tutor_create_assignment(
    uuid, uuid, text, text, timestamptz, boolean
  ),

  public.tutor_update_assignment(
    uuid, text, text, timestamptz, boolean
  ),

  public.tutor_set_assignment_archived(
    uuid, boolean
  )

from public, anon, authenticated;


-- ==========================================
-- 11. GRANT RPC EXECUTION
-- Chi tai khoan da xac thuc
-- ==========================================

grant execute on function

  lst_private.tutor_save_subject(
    uuid, text, text, text, boolean
  ),

  lst_private.tutor_create_assignment(
    uuid, uuid, text, text, timestamptz, boolean
  ),

  lst_private.tutor_update_assignment(
    uuid, text, text, timestamptz, boolean
  ),

  lst_private.tutor_set_assignment_archived(
    uuid, boolean
  ),

  public.tutor_save_subject(
    uuid, text, text, text, boolean
  ),

  public.tutor_create_assignment(
    uuid, uuid, text, text, timestamptz, boolean
  ),

  public.tutor_update_assignment(
    uuid, text, text, timestamptz, boolean
  ),

  public.tutor_set_assignment_archived(
    uuid, boolean
  )

to authenticated;


-- ==========================================
-- 12. KEEP DIRECT TABLE WRITES BLOCKED
-- ==========================================

revoke insert, update, delete, truncate
on table public.subjects, public.assignments
from public, anon, authenticated;


-- ==========================================
-- COMPLETE
-- ==========================================

commit;

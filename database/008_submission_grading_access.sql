
begin;

-- ==========================================
-- LST LEARNING
-- PHASE 8D.3 - SUBMISSION & GRADING ACCESS
-- ==========================================


-- 1. ADD UPLOAD STATE

alter table public.submissions
  add column upload_started_at timestamptz;

alter table public.submissions
  add constraint submissions_valid_upload_time
  check (
    upload_started_at is null
    or (
      upload_started_at >= created_at
      and (
        submitted_at is null
        or submitted_at >= upload_started_at
      )
    )
  );


-- 2. VERIFY STUDENT AND LOCK ASSIGNMENT

create function lst_private.lock_student_assignment(
  p_assignment_id uuid
)
returns public.assignments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_student_id uuid := auth.uid();
  v_assignment public.assignments%rowtype;
begin

  perform 1
  from public.profiles p
  where p.id = v_student_id
    and p.role = 'student'
    and p.is_active = true
  for share;

  if not found then
    raise exception 'Student access denied.'
      using errcode = '42501';
  end if;

  select a.*
  into v_assignment
  from public.assignments a
  where a.id = p_assignment_id
    and a.student_id = v_student_id
  for update;

  if not found then
    raise exception 'Assignment access denied.'
      using errcode = '42501';
  end if;

  perform 1
  from public.tutor_students ts
  join public.profiles t
    on t.id = ts.tutor_id
  where ts.tutor_id = v_assignment.tutor_id
    and ts.student_id = v_student_id
    and ts.is_active = true
    and t.role = 'tutor'
    and t.is_active = true
  for share of ts, t;

  if not found then
    raise exception 'Student relationship is inactive.'
      using errcode = '42501';
  end if;

  return v_assignment;

end;
$$;


-- 3. SAVE SUBMISSION DRAFT

create function lst_private.student_save_draft(
  p_assignment_id uuid,
  p_files jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_submission public.submissions%rowtype;
  v_file jsonb;
  v_name text;
  v_extension text;
  v_size bigint;
  v_order integer := 0;
begin

  v_assignment :=
    lst_private.lock_student_assignment(
      p_assignment_id
    );

  if v_assignment.is_archived then
    raise exception 'Assignment is archived.'
      using errcode = '55000';
  end if;


  -- Validate JSON input

  if p_files is null
    or jsonb_typeof(p_files) <> 'array' then
    raise exception 'Files must be an array.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_files) > 50 then
    raise exception 'Maximum 50 files allowed.'
      using errcode = '22023';
  end if;


  -- Find or create submission

  select s.*
  into v_submission
  from public.submissions s
  where s.assignment_id = p_assignment_id;

  if not found then
    insert into public.submissions (
      assignment_id
    )
    values (p_assignment_id)
    returning * into v_submission;
  end if;


  -- Protect submitted or sealed drafts

  if v_submission.submitted_at is not null then
    raise exception 'Assignment already submitted.'
      using errcode = '55000';
  end if;

  if v_submission.upload_started_at is not null then
    raise exception 'File list is locked for upload.'
      using errcode = '55000';
  end if;


  -- Never remove metadata for existing uploads

  if exists (
    select 1
    from public.submission_files f
    where f.submission_id = v_submission.id
      and (
        f.uploaded_at is not null
        or exists (
          select 1
          from storage.objects o
          where o.bucket_id = 'submission-files'
            and o.name = f.storage_path
        )
      )
  ) then
    raise exception 'Draft contains uploaded files.'
      using errcode = '55000';
  end if;


  -- Replace only unsealed draft metadata

  delete from public.submission_files
  where submission_id = v_submission.id;


  -- Save files in array order

  for v_file in
    select value
    from jsonb_array_elements(p_files)
  loop

    if jsonb_typeof(v_file) <> 'object'
      or jsonb_typeof(
        v_file -> 'original_name'
      ) is distinct from 'string'
      or jsonb_typeof(
        v_file -> 'size_bytes'
      ) is distinct from 'number' then

      raise exception 'Invalid file information.'
        using errcode = '22023';

    end if;

    v_name := trim(v_file ->> 'original_name');

    if char_length(v_name) not between 1 and 255
      or position('/' in v_name) > 0
      or position(chr(92) in v_name) > 0 then

      raise exception 'Invalid file name.'
        using errcode = '22023';

    end if;

    v_extension := lower(
      substring(
        v_name from '[.]([a-zA-Z0-9]+)$'
      )
    );

    if v_extension is null
      or v_extension not in (
        'jpg', 'jpeg', 'png', 'webp',
        'heic', 'heif', 'pdf', 'doc', 'docx'
      ) then

      raise exception 'Unsupported file extension.'
        using errcode = '22023';

    end if;

    if (v_file ->> 'size_bytes')
      !~ '^[0-9]{1,8}$' then

      raise exception 'Invalid file size.'
        using errcode = '22023';

    end if;

    v_size := (v_file ->> 'size_bytes')::bigint;

    if v_size not between 1 and 10485760 then
      raise exception 'File must be at most 10 MiB.'
        using errcode = '22023';
    end if;

    v_order := v_order + 1;

    insert into public.submission_files (
      submission_id,
      original_name,
      file_extension,
      size_bytes,
      sort_order
    )
    values (
      v_submission.id,
      v_name,
      v_extension,
      v_size,
      v_order
    );

  end loop;

  return v_submission.id;

end;
$$;


-- 4. START UPLOAD

create function lst_private.student_start_upload(
  p_assignment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_submission public.submissions%rowtype;
  v_file_count integer;
begin

  v_assignment :=
    lst_private.lock_student_assignment(
      p_assignment_id
    );

  if v_assignment.is_archived then
    raise exception 'Assignment is archived.'
      using errcode = '55000';
  end if;

  if not v_assignment.allow_late_submission
    and clock_timestamp() > v_assignment.due_at then

    raise exception 'Submission deadline has passed.'
      using errcode = '55000';

  end if;

  select s.*
  into v_submission
  from public.submissions s
  where s.assignment_id = p_assignment_id;

  if not found then
    raise exception 'Create a draft first.'
      using errcode = '55000';
  end if;

  if v_submission.submitted_at is not null then
    raise exception 'Assignment already submitted.'
      using errcode = '55000';
  end if;

  select count(*)
  into v_file_count
  from public.submission_files f
  where f.submission_id = v_submission.id;

  if v_file_count not between 1 and 50 then
    raise exception 'Select between 1 and 50 files.'
      using errcode = '22023';
  end if;


  -- Repeated calls preserve the original time

  update public.submissions
  set upload_started_at = coalesce(
    upload_started_at,
    clock_timestamp()
  )
  where id = v_submission.id;

  return v_submission.id;

end;
$$;


-- 5. SUBMIT ASSIGNMENT

create function lst_private.student_submit_assignment(
  p_assignment_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.assignments%rowtype;
  v_submission public.submissions%rowtype;
  v_file_count integer;
  v_submitted_at timestamptz;
begin

  v_assignment :=
    lst_private.lock_student_assignment(
      p_assignment_id
    );

  select s.*
  into v_submission
  from public.submissions s
  where s.assignment_id = p_assignment_id;

  if not found then
    raise exception 'Submission draft not found.'
      using errcode = '55000';
  end if;


  -- Retry safely without changing submission time

  if v_submission.submitted_at is not null then
    return v_submission.submitted_at;
  end if;

  if v_assignment.is_archived then
    raise exception 'Assignment is archived.'
      using errcode = '55000';
  end if;

  if not v_assignment.allow_late_submission
    and clock_timestamp() > v_assignment.due_at then

    raise exception 'Submission deadline has passed.'
      using errcode = '55000';

  end if;

  if v_submission.upload_started_at is null then
    raise exception 'Upload has not started.'
      using errcode = '55000';
  end if;

  select count(*)
  into v_file_count
  from public.submission_files f
  where f.submission_id = v_submission.id;

  if v_file_count not between 1 and 50 then
    raise exception 'Invalid number of files.'
      using errcode = '22023';
  end if;


  -- Storage must be configured and private

  if not exists (
    select 1
    from storage.buckets b
    where b.id = 'submission-files'
      and b.public = false
  ) then

    raise exception 'Private submission bucket unavailable.'
      using errcode = '55000';

  end if;


  -- Check Storage records, not client claims

  if exists (
    select 1
    from public.submission_files f
    where f.submission_id = v_submission.id
      and not exists (
        select 1
        from storage.objects o
        where o.bucket_id = 'submission-files'
          and o.name = f.storage_path
          and o.owner_id::text =
            v_assignment.student_id::text
          and (o.metadata ->> 'size') =
            f.size_bytes::text
      )
  ) then

    raise exception 'Some files are missing or invalid.'
      using errcode = '55000';

  end if;


  -- Final server-side deadline check

  v_submitted_at := clock_timestamp();

  if not v_assignment.allow_late_submission
    and v_submitted_at > v_assignment.due_at then

    raise exception 'Submission deadline has passed.'
      using errcode = '55000';

  end if;


  -- Mark files verified and submission completed

  update public.submission_files
  set uploaded_at = v_submitted_at
  where submission_id = v_submission.id;

  update public.submissions
  set submitted_at = v_submitted_at
  where id = v_submission.id;

  return v_submitted_at;

end;
$$;


-- 6. SAVE OR RETURN GRADE

create function lst_private.tutor_save_grade(
  p_assignment_id uuid,
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
  v_assignment public.assignments%rowtype;
  v_submission_id uuid;
  v_grade public.grades%rowtype;
  v_grade_id uuid;
  v_feedback text := coalesce(p_feedback, '');
  v_returned_at timestamptz;
begin

  v_tutor_id :=
    lst_private.require_tutor_for_write();

  v_assignment :=
    lst_private.lock_tutor_assignment(
      p_assignment_id,
      v_tutor_id
    );

  if v_assignment.is_archived then
    raise exception 'Restore assignment before grading.'
      using errcode = '55000';
  end if;

  select s.id
  into v_submission_id
  from public.submissions s
  where s.assignment_id = p_assignment_id
    and s.submitted_at is not null;

  if not found then
    raise exception 'Assignment has not been submitted.'
      using errcode = '55000';
  end if;


  -- Validate grading values

  if p_completion_percent is not null
    and p_completion_percent not between 0 and 100 then

    raise exception 'Completion must be between 0 and 100.'
      using errcode = '22023';

  end if;

  if p_score is not null
    and p_score not between 0 and 10 then

    raise exception 'Score must be between 0 and 10.'
      using errcode = '22023';

  end if;

  if char_length(v_feedback) > 10000 then
    raise exception 'Feedback is too long.'
      using errcode = '22023';
  end if;

  if p_revision_requested is null
    or p_return_now is null then

    raise exception 'Grading options are required.'
      using errcode = '22023';

  end if;


  -- Validate requirements for published grades

  if p_return_now then

    if p_completion_percent is null then
      raise exception 'Completion percentage is required.'
        using errcode = '22023';
    end if;

    if p_revision_requested
      and char_length(trim(v_feedback)) = 0 then

      raise exception 'Revision feedback is required.'
        using errcode = '22023';

    end if;

    v_returned_at := clock_timestamp();

  end if;


  -- Protect already returned grades

  select g.*
  into v_grade
  from public.grades g
  where g.submission_id = v_submission_id;

  if v_grade.returned_at is not null then
    raise exception 'Returned grade is locked.'
      using errcode = '55000';
  end if;


  -- Insert or update draft grade

  if v_grade.id is null then

    insert into public.grades (
      submission_id,
      completion_percent,
      score,
      feedback,
      revision_requested,
      returned_at
    )
    values (
      v_submission_id,
      p_completion_percent::smallint,
      p_score,
      v_feedback,
      p_revision_requested,
      v_returned_at
    )
    returning id into v_grade_id;

  else

    update public.grades
    set
      completion_percent =
        p_completion_percent::smallint,
      score = p_score,
      feedback = v_feedback,
      revision_requested = p_revision_requested,
      returned_at = v_returned_at
    where id = v_grade.id
    returning id into v_grade_id;

  end if;

  return v_grade_id;

end;
$$;


-- 7. PUBLIC RPC WRAPPERS

create function public.student_save_draft(
  p_assignment_id uuid,
  p_files jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.student_save_draft(
    p_assignment_id,
    p_files
  );
$$;


create function public.student_start_upload(
  p_assignment_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select lst_private.student_start_upload(
    p_assignment_id
  );
$$;


create function public.student_submit_assignment(
  p_assignment_id uuid
)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select lst_private.student_submit_assignment(
    p_assignment_id
  );
$$;


create function public.tutor_save_grade(
  p_assignment_id uuid,
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
  select lst_private.tutor_save_grade(
    p_assignment_id,
    p_completion_percent,
    p_score,
    p_feedback,
    p_revision_requested,
    p_return_now
  );
$$;


-- 8. PROTECT INTERNAL HELPER

revoke all privileges on function
  lst_private.lock_student_assignment(uuid)
from public, anon, authenticated;


-- 9. RESET RPC PERMISSIONS

revoke all privileges on function

  lst_private.student_save_draft(uuid, jsonb),
  lst_private.student_start_upload(uuid),
  lst_private.student_submit_assignment(uuid),

  lst_private.tutor_save_grade(
    uuid, integer, numeric, text, boolean, boolean
  ),

  public.student_save_draft(uuid, jsonb),
  public.student_start_upload(uuid),
  public.student_submit_assignment(uuid),

  public.tutor_save_grade(
    uuid, integer, numeric, text, boolean, boolean
  )

from public, anon, authenticated;


-- 10. GRANT AUTHENTICATED EXECUTION

grant execute on function

  lst_private.student_save_draft(uuid, jsonb),
  lst_private.student_start_upload(uuid),
  lst_private.student_submit_assignment(uuid),

  lst_private.tutor_save_grade(
    uuid, integer, numeric, text, boolean, boolean
  ),

  public.student_save_draft(uuid, jsonb),
  public.student_start_upload(uuid),
  public.student_submit_assignment(uuid),

  public.tutor_save_grade(
    uuid, integer, numeric, text, boolean, boolean
  )

to authenticated;


-- 11. KEEP DIRECT WRITES BLOCKED

revoke insert, update, delete, truncate
on table
  public.submissions,
  public.submission_files,
  public.grades
from public, anon, authenticated;


commit;

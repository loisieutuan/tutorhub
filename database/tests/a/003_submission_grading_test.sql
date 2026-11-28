
begin;

-- ==========================================
-- 1. CREATE TEMPORARY TEST DATA
-- ==========================================

do $$
declare
  i integer;
  t_id uuid;
  s_id uuid;
  p_id uuid;
  subject_id uuid;
  assignment_id uuid;
begin

  for i in 1..2 loop

    t_id := gen_random_uuid();
    s_id := gen_random_uuid();
    p_id := gen_random_uuid();

    insert into auth.users (id, email)
    values
      (t_id, 'sub-' || t_id || '@example.com'),
      (s_id, 'sub-' || s_id || '@example.com'),
      (p_id, 'sub-' || p_id || '@example.com');

    insert into public.profiles (
      id, full_name, username, role
    )
    values
      (t_id, 'Test Tutor', null, 'tutor'),
      (
        s_id,
        'Test Student',
        'st_' || left(
          replace(s_id::text, '-', ''), 20
        ),
        'student'
      ),
      (
        p_id,
        'Test Parent',
        'pt_' || left(
          replace(p_id::text, '-', ''), 20
        ),
        'parent'
      );

    insert into public.tutor_students (
      tutor_id, student_id
    )
    values (t_id, s_id);

    insert into public.parent_students (
      parent_id, student_id
    )
    values (p_id, s_id);

    insert into public.subjects (
      tutor_id, name
    )
    values (t_id, 'Test Math')
    returning id into subject_id;

    insert into public.assignments (
      tutor_id, student_id, subject_id,
      title, due_at
    )
    values (
      t_id, s_id, subject_id,
      'Draft Test Assignment',
      now() + interval '1 day'
    )
    returning id into assignment_id;

    perform set_config(
      'lst_submit.tutor_' || i,
      t_id::text, true
    );

    perform set_config(
      'lst_submit.student_' || i,
      s_id::text, true
    );

    perform set_config(
      'lst_submit.parent_' || i,
      p_id::text, true
    );

    perform set_config(
      'lst_submit.assignment_' || i,
      assignment_id::text, true
    );


    if i = 1 then

      -- Submitted fixture for grading tests only

      insert into public.assignments (
        tutor_id, student_id, subject_id,
        title, due_at
      )
      values (
        t_id, s_id, subject_id,
        'Submitted Test Assignment',
        now() + interval '1 day'
      )
      returning id into assignment_id;

      insert into public.submissions (
        assignment_id,
        upload_started_at,
        submitted_at
      )
      values (
        assignment_id,
        now(),
        now()
      );

      perform set_config(
        'lst_submit.graded_assignment',
        assignment_id::text, true
      );


      -- Expired assignment, no late submission

      insert into public.assignments (
        tutor_id, student_id, subject_id,
        title, assigned_at, due_at,
        allow_late_submission
      )
      values (
        t_id, s_id, subject_id,
        'Expired Test Assignment',
        now() - interval '2 days',
        now() - interval '1 day',
        false
      )
      returning id into assignment_id;

      perform set_config(
        'lst_submit.expired_assignment',
        assignment_id::text, true
      );

    end if;

  end loop;

end;
$$;


-- ==========================================
-- 2. STUDENT SUBMISSION TESTS
-- ==========================================

set local role authenticated;

do $$
declare

  v_student uuid :=
    current_setting('lst_submit.student_1')::uuid;

  v_assignment uuid :=
    current_setting('lst_submit.assignment_1')::uuid;

  v_other_assignment uuid :=
    current_setting('lst_submit.assignment_2')::uuid;

  v_expired uuid :=
    current_setting(
      'lst_submit.expired_assignment'
    )::uuid;

  v_submission uuid;
  v_files jsonb;
  v_invalid jsonb;

begin

  perform set_config(
    'request.jwt.claim.sub',
    v_student::text, true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_student,
      'role', 'authenticated'
    )::text,
    true
  );


  -- Empty draft is allowed, upload is not

  v_submission := public.student_save_draft(
    v_assignment,
    '[]'::jsonb
  );

  begin

    perform public.student_start_upload(
      v_assignment
    );

    raise exception 'FAIL: empty draft accepted';

  exception
    when sqlstate '22023' then null;
  end;


  -- Create exactly 50 file records

  select jsonb_agg(
    jsonb_build_object(
      'original_name', 'page-' || g || '.jpg',
      'size_bytes', 1000
    )
    order by g
  )
  into v_files
  from generate_series(1, 50) as x(g);

  perform public.student_save_draft(
    v_assignment,
    v_files
  );

  if (
    select count(*)
    from public.submission_files
    where submission_id = v_submission
  ) <> 50 then
    raise exception 'FAIL: 50 file draft';
  end if;

  if not exists (
    select 1
    from public.submission_files
    where submission_id = v_submission
      and original_name = 'page-50.jpg'
      and sort_order = 50
  ) then
    raise exception 'FAIL: file ordering';
  end if;


  -- Reject 51 files, oversized and unsupported files

  foreach v_invalid in array array[

    v_files || jsonb_build_array(
      jsonb_build_object(
        'original_name', 'extra.jpg',
        'size_bytes', 1000
      )
    ),

    '[{
      "original_name": "large.pdf",
      "size_bytes": 10485761
    }]'::jsonb,

    '[{
      "original_name": "invalid.exe",
      "size_bytes": 1000
    }]'::jsonb,

    '[{
      "original_name": "empty.jpg",
      "size_bytes": 0
    }]'::jsonb

  ]

  loop

    begin

      perform public.student_save_draft(
        v_assignment,
        v_invalid
      );

      raise exception 'FAIL: invalid files accepted';

    exception
      when sqlstate '22023' then null;
    end;

  end loop;


  -- Invalid changes must preserve the valid draft

  if (
    select count(*)
    from public.submission_files
    where submission_id = v_submission
  ) <> 50 then
    raise exception 'FAIL: valid draft was changed';
  end if;


  -- Cannot submit before upload starts

  begin

    perform public.student_submit_assignment(
      v_assignment
    );

    raise exception 'FAIL: unsealed draft submitted';

  exception
    when sqlstate '55000' then null;
  end;


  -- Lock draft for upload

  perform public.student_start_upload(
    v_assignment
  );

  -- Calling start again must remain safe

  perform public.student_start_upload(
    v_assignment
  );

  if not exists (
    select 1
    from public.submissions
    where id = v_submission
      and upload_started_at is not null
      and submitted_at is null
  ) then
    raise exception 'FAIL: upload state';
  end if;


  -- Cannot change the locked file list

  begin

    perform public.student_save_draft(
      v_assignment,
      '[]'::jsonb
    );

    raise exception 'FAIL: sealed draft changed';

  exception
    when sqlstate '55000' then null;
  end;


  -- No actual Storage files: submission must fail

  begin

    perform public.student_submit_assignment(
      v_assignment
    );

    raise exception 'FAIL: missing files accepted';

  exception
    when sqlstate '55000' then null;
  end;

  if exists (
    select 1
    from public.submissions
    where id = v_submission
      and submitted_at is not null
  ) or exists (
    select 1
    from public.submission_files
    where submission_id = v_submission
      and uploaded_at is not null
  ) then
    raise exception 'FAIL: false upload confirmation';
  end if;


  -- Another student's assignment is forbidden

  begin

    perform public.student_save_draft(
      v_other_assignment,
      v_files
    );

    raise exception 'FAIL: cross-student access';

  exception
    when insufficient_privilege then null;
  end;


  -- Expired assignment cannot start upload

  perform public.student_save_draft(
    v_expired,
    v_files
  );

  begin

    perform public.student_start_upload(
      v_expired
    );

    raise exception 'FAIL: expired upload accepted';

  exception
    when sqlstate '55000' then null;
  end;


  -- Student cannot grade

  begin

    perform public.tutor_save_grade(
      v_assignment,
      100,
      10,
      '',
      false,
      true
    );

    raise exception 'FAIL: student can grade';

  exception
    when insufficient_privilege then null;
  end;

end;
$$;


-- ==========================================
-- 3. TUTOR GRADING TESTS
-- ==========================================

do $$
declare

  v_tutor uuid :=
    current_setting('lst_submit.tutor_1')::uuid;

  v_student uuid :=
    current_setting('lst_submit.student_1')::uuid;

  v_parent uuid :=
    current_setting('lst_submit.parent_1')::uuid;

  v_assignment uuid :=
    current_setting('lst_submit.assignment_1')::uuid;

  v_graded uuid :=
    current_setting(
      'lst_submit.graded_assignment'
    )::uuid;

  v_grade uuid;
  v_actor uuid;

begin

  perform set_config(
    'request.jwt.claim.sub',
    v_tutor::text, true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_tutor,
      'role', 'authenticated'
    )::text,
    true
  );


  -- Tutor cannot grade unsubmitted assignment

  begin

    perform public.tutor_save_grade(
      v_assignment, 90, 8, '', false, false
    );

    raise exception 'FAIL: unsubmitted grade';

  exception
    when sqlstate '55000' then null;
  end;


  -- Validate completion percentage

  begin

    perform public.tutor_save_grade(
      v_graded, 101, 8, '', false, true
    );

    raise exception 'FAIL: invalid completion';

  exception
    when sqlstate '22023' then null;
  end;


  -- Validate score

  begin

    perform public.tutor_save_grade(
      v_graded, 90, 11, '', false, true
    );

    raise exception 'FAIL: invalid score';

  exception
    when sqlstate '22023' then null;
  end;


  -- Revision request needs feedback

  begin

    perform public.tutor_save_grade(
      v_graded, 90, 8, '', true, true
    );

    raise exception 'FAIL: missing feedback';

  exception
    when sqlstate '22023' then null;
  end;


  -- Save grading draft

  v_grade := public.tutor_save_grade(
    v_graded,
    85,
    8,
    'Draft feedback',
    true,
    false
  );

  if not exists (
    select 1
    from public.grades
    where id = v_grade
      and returned_at is null
  ) then
    raise exception 'FAIL: grading draft';
  end if;


  -- Student must not see unpublished grade

  perform set_config(
    'request.jwt.claim.sub',
    v_student::text, true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_student,
      'role', 'authenticated'
    )::text,
    true
  );

  if exists (
    select 1 from public.grades
    where id = v_grade
  ) then
    raise exception 'FAIL: unpublished grade visible';
  end if;


  -- Other tutor and parent cannot grade

  foreach v_actor in array array[
    current_setting('lst_submit.tutor_2')::uuid,
    v_parent
  ]

  loop

    perform set_config(
      'request.jwt.claim.sub',
      v_actor::text, true
    );

    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', v_actor,
        'role', 'authenticated'
      )::text,
      true
    );

    begin

      perform public.tutor_save_grade(
        v_graded, 100, 10, '', false, true
      );

      raise exception 'FAIL: unauthorized grading';

    exception
      when insufficient_privilege then null;
    end;

  end loop;


  -- Return grade as the correct tutor

  perform set_config(
    'request.jwt.claim.sub',
    v_tutor::text, true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_tutor,
      'role', 'authenticated'
    )::text,
    true
  );

  perform public.tutor_save_grade(
    v_graded,
    90,
    8.5,
    'Review question 4.',
    true,
    true
  );


  -- Returned grade is immutable

  begin

    perform public.tutor_save_grade(
      v_graded, 100, 10, '', false, true
    );

    raise exception 'FAIL: returned grade changed';

  exception
    when sqlstate '55000' then null;
  end;


  -- Student can now see returned grade

  perform set_config(
    'request.jwt.claim.sub',
    v_student::text, true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_student,
      'role', 'authenticated'
    )::text,
    true
  );

  if not exists (
    select 1 from public.grades
    where id = v_grade
      and completion_percent = 90
      and score = 8.5
      and returned_at is not null
  ) then
    raise exception 'FAIL: returned grade invisible';
  end if;


  -- Parent can see the result through RPC only

  perform set_config(
    'request.jwt.claim.sub',
    v_parent::text, true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', v_parent,
      'role', 'authenticated'
    )::text,
    true
  );

  if not exists (
    select 1
    from public.get_parent_learning_progress()
    where assignment_id = v_graded
      and completion_percent = 90
      and score = 8.5
  ) then
    raise exception 'FAIL: parent progress missing';
  end if;

  if exists (
    select 1 from public.grades
    where id = v_grade
  ) then
    raise exception 'FAIL: parent direct grade access';
  end if;


  -- Parent cannot prepare a student submission

  begin

    perform public.student_save_draft(
      v_assignment,
      '[]'::jsonb
    );

    raise exception 'FAIL: parent submission access';

  exception
    when insufficient_privilege then null;
  end;

end;
$$;


-- ==========================================
-- 4. CHECK ANONYMOUS RPC PERMISSIONS
-- ==========================================

reset role;

do $$
begin

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n
      on n.oid = p.pronamespace
    where n.nspname in ('public', 'lst_private')
      and p.proname in (
        'student_save_draft',
        'student_start_upload',
        'student_submit_assignment',
        'tutor_save_grade'
      )
      and has_function_privilege(
        'anon', p.oid, 'EXECUTE'
      )
  ) then
    raise exception 'FAIL: anonymous RPC access';
  end if;

end;
$$;


-- ==========================================
-- 5. REMOVE TEMPORARY TEST DATA
-- ==========================================

rollback;

select
  'PASS - Submission and grading access tests completed'
  as result;


begin;

-- ==========================================
-- LST LEARNING
-- TUTOR WRITE ACCESS TESTS
-- ==========================================


-- ==========================================
-- 1. TEMPORARY TEST DATA
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
      (t_id, 'write-' || t_id || '@example.com'),
      (s_id, 'write-' || s_id || '@example.com'),
      (p_id, 'write-' || p_id || '@example.com');

    insert into public.profiles (
      id, full_name, username, role
    )
    values
      (
        t_id,
        'Write Test Tutor',
        null,
        'tutor'
      ),
      (
        s_id,
        'Write Test Student',
        'wt_s_' ||
          left(replace(s_id::text, '-', ''), 20),
        'student'
      ),
      (
        p_id,
        'Write Test Parent',
        'wt_p_' ||
          left(replace(p_id::text, '-', ''), 20),
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
    values (
      t_id,
      'Test Subject'
    )
    returning id into subject_id;

    insert into public.assignments (
      tutor_id,
      student_id,
      subject_id,
      title,
      due_at
    )
    values (
      t_id,
      s_id,
      subject_id,
      'Existing Test Assignment',
      now() + interval '1 day'
    )
    returning id into assignment_id;


    -- Group 1 already has a submitted assignment.

    if i = 1 then

      insert into public.submissions (
        assignment_id,
        submitted_at
      )
      values (
        assignment_id,
        now()
      );

    end if;


    -- Save test IDs inside this transaction.

    perform set_config(
      'lst_write.tutor_' || i,
      t_id::text,
      true
    );

    perform set_config(
      'lst_write.student_' || i,
      s_id::text,
      true
    );

    perform set_config(
      'lst_write.parent_' || i,
      p_id::text,
      true
    );

    perform set_config(
      'lst_write.subject_' || i,
      subject_id::text,
      true
    );

    perform set_config(
      'lst_write.assignment_' || i,
      assignment_id::text,
      true
    );

  end loop;

end;
$$;


-- ==========================================
-- 2. SIMULATE AUTHENTICATED TUTOR
-- ==========================================

set local role authenticated;

do $$
declare

  tutor1 uuid :=
    current_setting('lst_write.tutor_1')::uuid;

  student1 uuid :=
    current_setting('lst_write.student_1')::uuid;

  student2 uuid :=
    current_setting('lst_write.student_2')::uuid;

  subject2 uuid :=
    current_setting('lst_write.subject_2')::uuid;

  submitted_assignment uuid :=
    current_setting('lst_write.assignment_1')::uuid;

  other_assignment uuid :=
    current_setting('lst_write.assignment_2')::uuid;

  new_subject uuid;
  new_assignment uuid;

  v_due timestamptz :=
    now() + interval '2 days';

  role_name text;
  actor_id uuid;
  q text;
  test_case record;

begin

  perform set_config(
    'request.jwt.claim.sub',
    tutor1::text,
    true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', tutor1,
      'role', 'authenticated'
    )::text,
    true
  );


  -- ========================================
  -- 3. CREATE AND UPDATE SUBJECT
  -- ========================================

  new_subject := public.tutor_save_subject(
    null,
    'New Math Subject',
    'Test description',
    '#315CCB',
    true
  );

  perform public.tutor_save_subject(
    new_subject,
    'Updated Math Subject',
    'Updated description',
    '#315CCB',
    true
  );

  if not exists (
    select 1
    from public.subjects
    where id = new_subject
      and tutor_id = tutor1
      and name = 'Updated Math Subject'
  ) then
    raise exception 'FAIL: subject save';
  end if;


  -- ========================================
  -- 4. CREATE AND UPDATE ASSIGNMENT
  -- ========================================

  new_assignment :=
    public.tutor_create_assignment(
      student1,
      new_subject,
      'New Assignment',
      'Test instructions',
      v_due,
      true
    );

  perform public.tutor_update_assignment(
    new_assignment,
    'Updated Assignment',
    'Updated instructions',
    v_due + interval '1 day',
    false
  );

  if not exists (
    select 1
    from public.assignments
    where id = new_assignment
      and tutor_id = tutor1
      and student_id = student1
      and subject_id = new_subject
      and title = 'Updated Assignment'
      and due_at = v_due + interval '1 day'
      and allow_late_submission = false
  ) then
    raise exception 'FAIL: assignment update';
  end if;


  -- ========================================
  -- 5. ARCHIVE AND RESTORE
  -- ========================================

  perform public.tutor_set_assignment_archived(
    new_assignment,
    true
  );

  if not exists (
    select 1 from public.assignments
    where id = new_assignment
      and is_archived = true
  ) then
    raise exception 'FAIL: assignment archive';
  end if;


  -- Editing archived assignment must fail.

  begin

    perform public.tutor_update_assignment(
      new_assignment,
      'Forbidden Update',
      '',
      v_due,
      true
    );

    raise exception
      'FAIL: archived assignment was edited';

  exception
    when sqlstate '55000' then null;
  end;


  perform public.tutor_set_assignment_archived(
    new_assignment,
    false
  );

  if not exists (
    select 1 from public.assignments
    where id = new_assignment
      and is_archived = false
  ) then
    raise exception 'FAIL: assignment restore';
  end if;


  -- ========================================
  -- 6. VERIFY FORBIDDEN OPERATIONS
  -- ========================================

  for test_case in

    select *
    from (
      values

        (
          '42501',
          format(
            $q$
              select public.tutor_save_subject(
                %L, 'Forbidden', '', '#315CCB', true
              )
            $q$,
            subject2
          )
        ),

        (
          '42501',
          format(
            $q$
              select public.tutor_create_assignment(
                %L, %L, 'Forbidden', '',
                now() + interval '1 day', true
              )
            $q$,
            student2,
            new_subject
          )
        ),

        (
          '42501',
          format(
            $q$
              select public.tutor_create_assignment(
                %L, %L, 'Forbidden', '',
                now() + interval '1 day', true
              )
            $q$,
            student1,
            subject2
          )
        ),

        (
          '42501',
          format(
            $q$
              select public.tutor_update_assignment(
                %L, 'Forbidden', '',
                now() + interval '2 days', true
              )
            $q$,
            other_assignment
          )
        ),

        (
          '42501',
          format(
            $q$
              select public.tutor_set_assignment_archived(
                %L, true
              )
            $q$,
            other_assignment
          )
        ),

        (
          '22023',
          format(
            $q$
              select public.tutor_create_assignment(
                %L, %L, 'Invalid deadline', '',
                now() - interval '1 day', true
              )
            $q$,
            student1,
            new_subject
          )
        ),

        (
          '22023',
          format(
            $q$
              select public.tutor_update_assignment(
                %L, 'Invalid deadline', '',
                now() - interval '1 day', true
              )
            $q$,
            new_assignment
          )
        ),

        (
          '55000',
          format(
            $q$
              select public.tutor_update_assignment(
                %L, 'Submitted assignment', '',
                now() + interval '3 days', true
              )
            $q$,
            submitted_assignment
          )
        )

    ) as checks(expected_state, statement)

  loop

    begin

      execute test_case.statement;

      raise exception
        'FAIL: forbidden operation succeeded';

    exception
      when others then

        if sqlstate <> test_case.expected_state then
          raise;
        end if;

    end;

  end loop;


  -- ========================================
  -- 7. INACTIVE SUBJECT
  -- ========================================

  perform public.tutor_save_subject(
    new_subject,
    'Updated Math Subject',
    '',
    '#315CCB',
    false
  );

  begin

    perform public.tutor_create_assignment(
      student1,
      new_subject,
      'Inactive Subject Assignment',
      '',
      v_due,
      true
    );

    raise exception
      'FAIL: inactive subject accepted';

  exception
    when insufficient_privilege then null;
  end;


  -- ========================================
  -- 8. STUDENT AND PARENT MUST NOT WRITE
  -- ========================================

  foreach role_name in array
    array['student', 'parent']

  loop

    actor_id := current_setting(
      'lst_write.' || role_name || '_1'
    )::uuid;

    perform set_config(
      'request.jwt.claim.sub',
      actor_id::text,
      true
    );

    perform set_config(
      'request.jwt.claims',
      json_build_object(
        'sub', actor_id,
        'role', 'authenticated'
      )::text,
      true
    );


    foreach q in array array[

      $q$
        select public.tutor_save_subject(
          null, 'Forbidden', '', '#315CCB', true
        )
      $q$,

      format(
        $q$
          select public.tutor_create_assignment(
            %L, %L, 'Forbidden', '',
            now() + interval '1 day', true
          )
        $q$,
        student1,
        new_subject
      ),

      format(
        $q$
          select public.tutor_update_assignment(
            %L, 'Forbidden', '',
            now() + interval '2 days', true
          )
        $q$,
        new_assignment
      ),

      format(
        $q$
          select public.tutor_set_assignment_archived(
            %L, true
          )
        $q$,
        new_assignment
      )

    ]

    loop

      begin

        execute q;

        raise exception
          'FAIL: % gained tutor write access',
          role_name;

      exception
        when insufficient_privilege then null;
      end;

    end loop;

  end loop;

end;
$$;


-- ==========================================
-- 9. DISABLE TEST RELATIONSHIP AND ACCOUNT
-- ==========================================

reset role;

update public.tutor_students
set is_active = false
where tutor_id =
  current_setting('lst_write.tutor_1')::uuid;

update public.profiles
set is_active = false
where id =
  current_setting('lst_write.tutor_2')::uuid;


set local role authenticated;

do $$
declare
  actor_id uuid;
begin

  actor_id :=
    current_setting('lst_write.tutor_1')::uuid;

  perform set_config(
    'request.jwt.claim.sub',
    actor_id::text,
    true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', actor_id,
      'role', 'authenticated'
    )::text,
    true
  );


  -- Inactive relationship must deny assignment.

  begin

    perform public.tutor_create_assignment(
      current_setting('lst_write.student_1')::uuid,
      current_setting('lst_write.subject_1')::uuid,
      'Forbidden',
      '',
      now() + interval '1 day',
      true
    );

    raise exception
      'FAIL: inactive relationship accepted';

  exception
    when insufficient_privilege then null;
  end;


  -- Inactive tutor must deny subject creation.

  actor_id :=
    current_setting('lst_write.tutor_2')::uuid;

  perform set_config(
    'request.jwt.claim.sub',
    actor_id::text,
    true
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', actor_id,
      'role', 'authenticated'
    )::text,
    true
  );

  begin

    perform public.tutor_save_subject(
      null,
      'Forbidden',
      '',
      '#315CCB',
      true
    );

    raise exception
      'FAIL: inactive tutor accepted';

  exception
    when insufficient_privilege then null;
  end;

end;
$$;


-- ==========================================
-- 10. VERIFY ANONYMOUS RPC ACCESS
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
        'tutor_save_subject',
        'tutor_create_assignment',
        'tutor_update_assignment',
        'tutor_set_assignment_archived'
      )
      and has_function_privilege(
        'anon',
        p.oid,
        'EXECUTE'
      )
  ) then

    raise exception
      'FAIL: anonymous RPC execution is allowed';

  end if;

end;
$$;


-- ==========================================
-- 11. REMOVE ALL TEMPORARY DATA
-- ==========================================

rollback;

select
  'PASS - Tutor write access tests completed'
  as result;

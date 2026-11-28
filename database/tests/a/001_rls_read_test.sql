
begin;

-- ==========================================
-- 1. CREATE TEMPORARY TEST DATA
-- ==========================================

do $$
declare

  group_no integer;
  assignment_no integer;

  t_id uuid;
  s_id uuid;
  p_id uuid;
  subject_id uuid;
  assignment_id uuid;
  submission_id uuid;

begin

  for group_no in 1..2 loop

    t_id := gen_random_uuid();
    s_id := gen_random_uuid();
    p_id := gen_random_uuid();

    perform set_config(
      'lst_test.tutor_' || group_no,
      t_id::text,
      true
    );

    perform set_config(
      'lst_test.student_' || group_no,
      s_id::text,
      true
    );

    perform set_config(
      'lst_test.parent_' || group_no,
      p_id::text,
      true
    );


    -- Test identities, no real passwords

    insert into auth.users (id, email)
    values
      (t_id, 'rls-' || t_id || '@example.com'),
      (s_id, 'rls-' || s_id || '@example.com'),
      (p_id, 'rls-' || p_id || '@example.com');


    -- Profiles

    insert into public.profiles (
      id, full_name, username, role
    )
    values
      (
        t_id, 'RLS Test Tutor',
        null, 'tutor'
      ),
      (
        s_id, 'RLS Test Student',
        'rls_s_' ||
          left(replace(s_id::text, '-', ''), 20),
        'student'
      ),
      (
        p_id, 'RLS Test Parent',
        'rls_p_' ||
          left(replace(p_id::text, '-', ''), 20),
        'parent'
      );


    -- Relationships

    insert into public.tutor_students (
      tutor_id, student_id
    )
    values (t_id, s_id);

    insert into public.parent_students (
      parent_id, student_id
    )
    values (p_id, s_id);


    -- Subject

    insert into public.subjects (
      tutor_id, name
    )
    values (
      t_id, 'RLS Test Subject'
    )
    returning id into subject_id;


    -- Three assignments per group

    for assignment_no in 1..3 loop

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
        'RLS Test Assignment ' || assignment_no,
        now() + interval '1 day'
      )
      returning id into assignment_id;


      -- Uploaded assignment file

      insert into public.assignment_files (
        assignment_id,
        original_name,
        file_extension,
        size_bytes,
        sort_order,
        uploaded_at
      )
      values (
        assignment_id,
        'test.pdf',
        'pdf',
        100,
        1,
        now()
      );


      -- Submission 2 remains a draft

      insert into public.submissions (
        assignment_id,
        submitted_at
      )
      values (
        assignment_id,
        case
          when assignment_no = 2 then null
          else now()
        end
      )
      returning id into submission_id;


      insert into public.submission_files (
        submission_id,
        original_name,
        file_extension,
        size_bytes,
        sort_order,
        uploaded_at
      )
      values (
        submission_id,
        'test.jpg',
        'jpg',
        100,
        1,
        case
          when assignment_no = 2 then null
          else now()
        end
      );


      -- Grade 1 is returned
      -- Grade 3 is not returned

      if assignment_no <> 2 then

        insert into public.grades (
          submission_id,
          completion_percent,
          score,
          returned_at
        )
        values (
          submission_id,
          90,
          8,
          case
            when assignment_no = 1 then now()
            else null
          end
        );

      end if;

    end loop;

  end loop;

end;
$$;


-- ==========================================
-- 2. TEST ALL AUTHENTICATED ROLES
-- ==========================================

set local role authenticated;

do $$
declare

  group_no integer;
  role_name text;
  actor_id uuid;
  actual bigint[];
  expected bigint[];
  table_name text;

begin

  for group_no in 1..2 loop

    foreach role_name in array
      array['tutor', 'student', 'parent']

    loop

      actor_id := current_setting(
        'lst_test.' || role_name || '_' || group_no
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


      -- Visible row counts for all tables

      actual := array[
        (select count(*) from public.profiles),
        (select count(*) from public.tutor_students),
        (select count(*) from public.parent_students),
        (select count(*) from public.subjects),
        (select count(*) from public.assignments),
        (select count(*) from public.assignment_files),
        (select count(*) from public.submissions),
        (select count(*) from public.submission_files),
        (select count(*) from public.grades),
        (
          select count(*)
          from public.get_parent_learning_progress()
        )
      ];


      expected := (
        case role_name
          when 'tutor'
            then array[2,1,0,1,3,3,2,2,2,0]

          when 'student'
            then array[2,1,0,1,3,3,3,3,1,0]

          when 'parent'
            then array[2,0,1,0,0,0,0,0,0,3]
        end
      )::bigint[];


      if actual is distinct from expected then

        raise exception
          'RLS FAIL: group %, role %, actual %, expected %',
          group_no,
          role_name,
          actual,
          expected;

      end if;


      -- Prevent cross-group assignment access

      if exists (
        select 1
        from public.assignments a
        where a.student_id <> current_setting(
          'lst_test.student_' || group_no
        )::uuid
      ) then

        raise exception
          'RLS FAIL: cross-group assignment access';

      end if;


      -- Parent can only see their linked child

      if role_name = 'parent' then

        if exists (
          select 1
          from public.get_parent_learning_progress() p
          where p.student_id <> current_setting(
            'lst_test.student_' || group_no
          )::uuid
        ) then

          raise exception
            'RLS FAIL: parent sees another student';

        end if;

        if (
          select count(*)
          from public.get_parent_learning_progress()
          where returned_at is not null
        ) <> 1 then

          raise exception
            'RLS FAIL: parent grade visibility';

        end if;

        if exists (
          select 1
          from public.get_parent_learning_progress()
          where returned_at is null
            and (
              completion_percent is not null
              or score is not null
              or revision_requested is not null
            )
        ) then

          raise exception
            'RLS FAIL: unpublished grade leaked';

        end if;

      end if;

    end loop;

  end loop;


  -- Verify all direct writes remain blocked

  foreach table_name in array array[
    'profiles',
    'tutor_students',
    'parent_students',
    'subjects',
    'assignments',
    'assignment_files',
    'submissions',
    'submission_files',
    'grades'
  ]

  loop

    if has_table_privilege(
      current_user,
      'public.' || table_name,
      'INSERT, UPDATE, DELETE, TRUNCATE'
    ) or has_any_column_privilege(
      current_user,
      'public.' || table_name,
      'INSERT, UPDATE'
    ) then

      raise exception
        'RLS FAIL: unexpected write access on %',
        table_name;

    end if;

  end loop;

end;
$$;


-- ==========================================
-- 3. TEST DISABLED RELATIONSHIPS / ACCOUNTS
-- ==========================================

reset role;

update public.tutor_students
set is_active = false
where tutor_id =
  current_setting('lst_test.tutor_1')::uuid;

update public.profiles
set is_active = false
where id =
  current_setting('lst_test.student_2')::uuid;


set local role authenticated;

do $$
declare
  group_no integer;
  role_name text;
  actor_id uuid;

begin

  for group_no in 1..2 loop

    foreach role_name in array
      array['tutor', 'student', 'parent']

    loop

      actor_id := current_setting(
        'lst_test.' || role_name || '_' || group_no
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


      if exists (
        select 1 from public.assignments
      ) or exists (
        select 1 from public.assignment_files
      ) or exists (
        select 1 from public.submissions
      ) or exists (
        select 1 from public.submission_files
      ) or exists (
        select 1 from public.grades
      ) or exists (
        select 1 from public.tutor_students
      ) or exists (
        select 1
        from public.get_parent_learning_progress()
      ) then

        raise exception
          'RLS FAIL: inactive access, group %, role %',
          group_no,
          role_name;

      end if;

    end loop;

  end loop;

end;
$$;


-- ==========================================
-- 4. TEST ANONYMOUS ACCESS
-- ==========================================

reset role;

set local role anon;

set local request.jwt.claim.sub = '';
set local request.jwt.claims = '{}';

do $$
declare
  table_name text;

begin

  foreach table_name in array array[
    'profiles',
    'tutor_students',
    'parent_students',
    'subjects',
    'assignments',
    'assignment_files',
    'submissions',
    'submission_files',
    'grades'
  ]

  loop

    begin

      execute format(
        'select 1 from public.%I limit 1',
        table_name
      );

      raise exception
        'RLS FAIL: anonymous access on %',
        table_name;

    exception

      when insufficient_privilege then
        null;

    end;

  end loop;


  begin

    perform 1
    from public.get_parent_learning_progress();

    raise exception
      'RLS FAIL: anonymous parent RPC access';

  exception

    when insufficient_privilege then
      null;

  end;

end;
$$;


-- ==========================================
-- 5. REMOVE ALL TEST DATA
-- ==========================================

reset role;

rollback;

select
  'PASS - RLS read access tests completed'
  as result;

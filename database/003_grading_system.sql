
begin;

-- ==========================================
-- LST LEARNING DATABASE
-- PHASE 8B.3 - GRADING SYSTEM
-- ==========================================


-- ==========================================
-- 1. GRADES TABLE
-- Bang cham bai va danh gia hoc sinh
-- ==========================================

create table public.grades (

  id uuid primary key default gen_random_uuid(),

  submission_id uuid not null unique
    references public.submissions(id)
    on delete restrict,

  completion_percent smallint,

  score numeric(4, 2),

  feedback text not null default '',

  revision_requested boolean not null default false,

  returned_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),


  -- Ty le hoan thanh tu 0 den 100

  constraint grades_valid_completion
    check (
      completion_percent between 0 and 100
    ),


  -- Diem chat luong tu 0 den 10

  constraint grades_valid_score
    check (
      score between 0 and 10
    ),


  -- Bat buoc co ty le hoan thanh khi tra bai

  constraint grades_completion_required_on_return
    check (
      returned_at is null
      or completion_percent is not null
    ),


  -- Bat buoc co nhan xet khi yeu cau sua bai

  constraint grades_revision_requires_feedback
    check (
      returned_at is null
      or revision_requested = false
      or char_length(trim(feedback)) > 0
    ),


  -- Khong duoc tra bai truoc khi tao danh gia

  constraint grades_valid_returned_at
    check (
      returned_at is null
      or returned_at >= created_at
    )

);


-- ==========================================
-- 2. GRADE VALIDATION FUNCTION
-- Kiem tra bai nop truoc khi cham
-- ==========================================

create function public.validate_grade()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare

  submission_time timestamptz;

begin

  -- Lay thoi diem hoc sinh nop bai

  select s.submitted_at
  into submission_time
  from public.submissions s
  where s.id = new.submission_id;


  -- Khong cham bai chua nop

  if submission_time is null then

    raise exception
      'Cannot grade a submission that has not been submitted.'
      using errcode = '23514';

  end if;


  -- Khong tra ket qua truoc thoi diem nop bai

  if new.returned_at is not null
    and new.returned_at < submission_time then

    raise exception
      'Return time cannot be earlier than submission time.'
      using errcode = '23514';

  end if;


  -- Tu dong cap nhat thoi gian chinh sua

  new.updated_at := clock_timestamp();

  return new;

end;
$$;


-- ==========================================
-- 3. TRIGGER
-- Tu dong kiem tra khi them hoac sua danh gia
-- ==========================================

create trigger grades_validate_before_write

before insert or update
on public.grades

for each row
execute function public.validate_grade();


-- ==========================================
-- 4. INDEXES
-- Ho tro truy van ket qua da tra
-- ==========================================

create index grades_returned_at_idx
  on public.grades(returned_at)
  where returned_at is not null;


-- ==========================================
-- 5. ROW LEVEL SECURITY
-- Bat bao mat du lieu cham bai
-- ==========================================

alter table public.grades
  enable row level security;


-- ==========================================
-- 6. REVOKE CLIENT ACCESS
-- Chua cho phep frontend truy cap
-- ==========================================

revoke all privileges on table
  public.grades

from public, anon, authenticated;


revoke all privileges on function
  public.validate_grade()

from public, anon, authenticated;


-- ==========================================
-- COMPLETE
-- ==========================================

commit;

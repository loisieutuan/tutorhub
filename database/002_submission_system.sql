
begin;

-- ==========================================
-- LST LEARNING DATABASE
-- PHASE 8B.2 - ASSIGNMENT FILES & SUBMISSIONS
-- ==========================================


-- ==========================================
-- 1. ASSIGNMENT FILES
-- Tep de bai do gia su giao
-- ==========================================

create table public.assignment_files (

  id uuid primary key default gen_random_uuid(),

  assignment_id uuid not null
    references public.assignments(id)
    on delete restrict,

  original_name text not null
    check (
      char_length(trim(original_name))
      between 1 and 255
    ),

  file_extension text not null
    check (
      file_extension in (
        'jpg',
        'jpeg',
        'png',
        'webp',
        'heic',
        'heif',
        'pdf',
        'doc',
        'docx'
      )
    ),

  file_type text generated always as (
    case
      when file_extension in (
        'jpg', 'jpeg', 'png',
        'webp', 'heic', 'heif'
      ) then 'image'
      when file_extension = 'pdf' then 'pdf'
      else 'word'
    end
  ) stored,

  mime_type text,

  size_bytes bigint not null
    check (size_bytes > 0),

  storage_path text generated always as (
    assignment_id::text
    || '/'
    || id::text
    || '.'
    || file_extension
  ) stored unique,

  sort_order integer not null
    check (sort_order >= 1),

  uploaded_at timestamptz,

  created_at timestamptz not null default now(),

  constraint assignment_files_unique_order
    unique (assignment_id, sort_order)
    deferrable initially immediate

);


-- ==========================================
-- 2. SUBMISSIONS
-- Ban nhap va bai nop cua hoc sinh
-- ==========================================

create table public.submissions (

  id uuid primary key default gen_random_uuid(),

  assignment_id uuid not null unique
    references public.assignments(id)
    on delete restrict,

  submitted_at timestamptz,

  created_at timestamptz not null default now(),

  constraint submissions_valid_timestamp
    check (
      submitted_at is null
      or submitted_at >= created_at
    )

);


-- ==========================================
-- 3. SUBMISSION FILES
-- Anh, PDF, Word cua hoc sinh
-- ==========================================

create table public.submission_files (

  id uuid primary key default gen_random_uuid(),

  submission_id uuid not null
    references public.submissions(id)
    on delete restrict,

  original_name text not null
    check (
      char_length(trim(original_name))
      between 1 and 255
    ),

  file_extension text not null
    check (
      file_extension in (
        'jpg',
        'jpeg',
        'png',
        'webp',
        'heic',
        'heif',
        'pdf',
        'doc',
        'docx'
      )
    ),

  file_type text generated always as (
    case
      when file_extension in (
        'jpg', 'jpeg', 'png',
        'webp', 'heic', 'heif'
      ) then 'image'
      when file_extension = 'pdf' then 'pdf'
      else 'word'
    end
  ) stored,

  mime_type text,

  size_bytes bigint not null
    check (
      size_bytes between 1 and 10485760
    ),

  storage_path text generated always as (
    submission_id::text
    || '/'
    || id::text
    || '.'
    || file_extension
  ) stored unique,

  sort_order smallint not null
    check (
      sort_order between 1 and 50
    ),

  uploaded_at timestamptz,

  created_at timestamptz not null default now(),

  constraint submission_files_unique_order
    unique (submission_id, sort_order)
    deferrable initially immediate

);


-- ==========================================
-- 4. INDEXES
-- Ho tro truy van bai nop
-- ==========================================

create index submissions_submitted_at_idx
  on public.submissions(submitted_at);


-- ==========================================
-- 5. ROW LEVEL SECURITY
-- Bat bao mat
-- ==========================================

alter table public.assignment_files
  enable row level security;

alter table public.submissions
  enable row level security;

alter table public.submission_files
  enable row level security;


-- ==========================================
-- 6. REVOKE CLIENT ACCESS
-- Chua cho phep frontend truy cap
-- ==========================================

revoke all privileges on table
  public.assignment_files,
  public.submissions,
  public.submission_files
from public, anon, authenticated;


-- ==========================================
-- COMPLETE
-- ==========================================

commit;

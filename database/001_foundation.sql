
begin;

-- ==========================================
-- LST LEARNING DATABASE
-- PHASE 8B.1 - FOUNDATION
-- ==========================================


-- ==========================================
-- 1. PROFILES
-- Thong tin tai khoan nguoi dung
-- ==========================================

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete restrict,

  full_name text not null
    check (char_length(trim(full_name)) between 1 and 120),

  username text unique
    check (username ~ '^[a-z0-9][a-z0-9_]{2,31}$'),

  role text not null
    check (role in ('tutor', 'student', 'parent')),

  avatar_url text,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  constraint profiles_id_role_unique
    unique (id, role),

  constraint profiles_username_required
    check (role = 'tutor' or username is not null)
);


-- ==========================================
-- 2. TUTOR STUDENTS
-- Quan he giua gia su va hoc sinh
-- ==========================================

create table public.tutor_students (
  tutor_id uuid not null,

  student_id uuid not null,

  tutor_role text
    generated always as ('tutor'::text) stored,

  student_role text
    generated always as ('student'::text) stored,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  primary key (tutor_id, student_id),

  foreign key (tutor_id, tutor_role)
    references public.profiles(id, role)
    on delete restrict,

  foreign key (student_id, student_role)
    references public.profiles(id, role)
    on delete restrict,

  check (tutor_id <> student_id)
);


-- ==========================================
-- 3. PARENT STUDENTS
-- Quan he giua phu huynh va hoc sinh
-- ==========================================

create table public.parent_students (
  parent_id uuid not null,

  student_id uuid not null,

  parent_role text
    generated always as ('parent'::text) stored,

  student_role text
    generated always as ('student'::text) stored,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  primary key (parent_id, student_id),

  foreign key (parent_id, parent_role)
    references public.profiles(id, role)
    on delete restrict,

  foreign key (student_id, student_role)
    references public.profiles(id, role)
    on delete restrict,

  check (parent_id <> student_id)
);


-- ==========================================
-- 4. SUBJECTS
-- Danh sach mon hoc
-- ==========================================

create table public.subjects (
  id uuid primary key default gen_random_uuid(),

  tutor_id uuid not null,

  tutor_role text
    generated always as ('tutor'::text) stored,

  name text not null
    check (char_length(trim(name)) between 1 and 100),

  description text not null default '',

  color text not null default '#315CCB'
    check (color ~ '^#[0-9A-Fa-f]{6}$'),

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  foreign key (tutor_id, tutor_role)
    references public.profiles(id, role)
    on delete restrict,

  constraint subjects_id_tutor_unique
    unique (id, tutor_id)
);

create unique index subjects_unique_name_per_tutor
  on public.subjects (tutor_id, lower(trim(name)));


-- ==========================================
-- 5. ASSIGNMENTS
-- Bai tap va deadline
-- ==========================================

create table public.assignments (
  id uuid primary key default gen_random_uuid(),

  tutor_id uuid not null,

  student_id uuid not null,

  subject_id uuid not null,

  title text not null
    check (char_length(trim(title)) between 1 and 200),

  description text not null default '',

  assigned_at timestamptz not null default now(),

  due_at timestamptz not null,

  allow_late_submission boolean not null default true,

  is_archived boolean not null default false,

  created_at timestamptz not null default now(),

  constraint assignments_valid_deadline
    check (due_at > assigned_at),

  constraint assignments_valid_tutor_student
    foreign key (tutor_id, student_id)
    references public.tutor_students(tutor_id, student_id)
    on delete restrict,

  constraint assignments_valid_subject
    foreign key (subject_id, tutor_id)
    references public.subjects(id, tutor_id)
    on delete restrict
);


-- ==========================================
-- 6. INDEXES
-- Ho tro tim kiem va truy van nhanh
-- ==========================================

create index tutor_students_student_id_idx
  on public.tutor_students(student_id);

create index parent_students_student_id_idx
  on public.parent_students(student_id);

create index assignments_student_deadline_idx
  on public.assignments(student_id, due_at);

create index assignments_tutor_deadline_idx
  on public.assignments(tutor_id, due_at);

create index assignments_tutor_student_idx
  on public.assignments(tutor_id, student_id);

create index assignments_subject_tutor_idx
  on public.assignments(subject_id, tutor_id);


-- ==========================================
-- 7. ROW LEVEL SECURITY
-- Bat bao mat cho tat ca cac bang
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


-- ==========================================
-- 8. DEFAULT CLIENT ACCESS
-- Chua cho phep frontend doc hoac sua du lieu
-- ==========================================

revoke all privileges on table
  public.profiles,
  public.tutor_students,
  public.parent_students,
  public.subjects,
  public.assignments
from public, anon, authenticated;


-- ==========================================
-- COMPLETE
-- ==========================================

commit;

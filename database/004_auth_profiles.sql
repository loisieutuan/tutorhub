begin;

alter table public.profiles
  enable row level security;

revoke all privileges
on table public.profiles
from public, anon, authenticated;

grant usage on schema public
to authenticated;

grant select
on table public.profiles
to authenticated;

create policy profiles_read_own
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);

commit;
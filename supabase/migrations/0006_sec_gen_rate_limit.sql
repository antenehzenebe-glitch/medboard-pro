-- S5 abuse control: per-IP rate limit for the public generate-mcq fallback endpoint.
-- Counter table is RLS-locked (no direct anon access); only the SECURITY DEFINER RPC may touch it.

create table if not exists public.gen_rate_limit (
  ip           text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (ip, window_start)
);

alter table public.gen_rate_limit enable row level security;
revoke all on table public.gen_rate_limit from anon, authenticated;

create or replace function public.check_and_bump_gen_rate(
  p_ip          text,
  p_limit       integer default 20,
  p_window_secs integer default 3600
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket timestamptz;
  v_count  integer;
begin
  if p_ip is null or length(p_ip) = 0 then
    return true;  -- fail-open when IP indeterminable; never block legit users
  end if;
  v_bucket := to_timestamp(floor(extract(epoch from now()) / p_window_secs) * p_window_secs);
  insert into public.gen_rate_limit (ip, window_start, count)
    values (p_ip, v_bucket, 1)
  on conflict (ip, window_start)
    do update set count = public.gen_rate_limit.count + 1
  returning count into v_count;
  if random() < 0.01 then
    delete from public.gen_rate_limit where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_and_bump_gen_rate(text, integer, integer) from public;
grant execute on function public.check_and_bump_gen_rate(text, integer, integer) to anon, authenticated;

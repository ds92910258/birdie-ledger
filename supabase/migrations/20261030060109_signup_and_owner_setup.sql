create table public.owner_bootstrap(id integer primary key check(id=1), token_hash text not null, used_at timestamptz);
alter table public.owner_bootstrap enable row level security;
revoke all on public.owner_bootstrap from public,anon,authenticated;
grant all on public.owner_bootstrap to service_role;
create table public.signup_limits(key text primary key, window_started timestamptz not null default now(), attempts integer not null default 0);
alter table public.signup_limits enable row level security;
revoke all on public.signup_limits from public,anon,authenticated;
grant all on public.signup_limits to service_role;
create function public.allow_signup_request(_key text) returns boolean language plpgsql security invoker set search_path=public as $$
declare n int;
begin
 insert into public.signup_limits(key,attempts) values('global',1)
 on conflict(key) do update set attempts=case when signup_limits.window_started<now()-interval '1 hour' then 1 else signup_limits.attempts+1 end,
 window_started=case when signup_limits.window_started<now()-interval '1 hour' then now() else signup_limits.window_started end returning attempts into n;
 if n>50 then return false; end if;
 insert into public.signup_limits(key,attempts) values(_key,1)
 on conflict(key) do update set attempts=case when signup_limits.window_started<now()-interval '1 hour' then 1 else signup_limits.attempts+1 end,
 window_started=case when signup_limits.window_started<now()-interval '1 hour' then now() else signup_limits.window_started end returning attempts into n;
 return n<=3;
end $$;
revoke all on function public.allow_signup_request(text) from public,anon,authenticated;
grant execute on function public.allow_signup_request(text) to service_role;
create index on public.game_scores(user_id);
create index on public.game_scores(game_id);
create index on public.ledger_entries(score_id);

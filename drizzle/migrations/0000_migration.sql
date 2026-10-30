create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ===== Enums =====
create type public.app_role as enum ('admin');
create type public.member_status as enum ('pending','approved','rejected','revoked');
create type public.ledger_kind as enum ('income','expense');
create type public.ledger_category as enum ('penalty','food','coffee','other');

-- ===== Profiles (no phone here) =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  status public.member_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid
);
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- Private contact info (phone) visible only to self and admin
create table public.member_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone text not null unique check (phone ~ '^010[0-9]{8}$')
);
grant select on public.member_contacts to authenticated;
grant all on public.member_contacts to service_role;
alter table public.member_contacts enable row level security;

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function private.is_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select private.has_role(_user_id,'admin')
      or exists (select 1 from public.profiles where id = _user_id and status = 'approved')
$$;

create policy "own role read" on public.user_roles for select to authenticated using (user_id = auth.uid());

create policy "profile self read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "members read profiles" on public.profiles for select to authenticated using (private.is_member(auth.uid()));
create policy "contact self or admin" on public.member_contacts for select to authenticated
  using (user_id = auth.uid() or private.has_role(auth.uid(),'admin'));

-- ===== Signup trigger =====
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
  v_name text;
begin
  -- Owner admin account is created only by the server with service-role app_metadata
  if coalesce(new.raw_app_meta_data->>'bootstrap_admin','') = 'true' then
    insert into public.profiles(id, name, status) values (new.id, coalesce(new.raw_app_meta_data->>'name','관리자'), 'approved');
    return new;
  end if;

  v_phone := regexp_replace(coalesce(new.raw_user_meta_data->>'phone',''), '[^0-9]', '', 'g');
  v_name := btrim(coalesce(new.raw_user_meta_data->>'name',''));
  if v_phone !~ '^010[0-9]{8}$' then
    raise exception '올바른 휴대폰 번호가 아닙니다';
  end if;
  if lower(new.email) is distinct from v_phone || '@phone.birdiejangbu.app' then
    raise exception '허용되지 않은 가입 방식입니다';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 30 then
    raise exception '이름을 확인해 주세요';
  end if;
  insert into public.profiles(id, name, status) values (new.id, v_name, 'pending');
  insert into public.member_contacts(user_id, phone) values (new.id, v_phone);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

-- ===== Audit log =====
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "admin read audit" on public.audit_log for select to authenticated using (private.has_role(auth.uid(),'admin'));

create or replace function private.write_audit(_action text, _entity text, _id text, _details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log(actor, action, entity, entity_id, details) values (auth.uid(), _action, _entity, _id, _details);
$$;
revoke execute on function private.write_audit(text,text,text,jsonb) from public, anon, authenticated;

-- ===== Games =====
create table public.games (
  id uuid primary key default gen_random_uuid(),
  played_on date not null,
  venue text not null check (char_length(venue) between 1 and 80),
  memo text check (memo is null or char_length(memo) <= 300),
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.games to authenticated;
grant all on public.games to service_role;
alter table public.games enable row level security;
create policy "members read games" on public.games for select to authenticated using (private.is_member(auth.uid()));
create policy "admin insert games" on public.games for insert to authenticated with check (private.has_role(auth.uid(),'admin'));
create policy "admin update games" on public.games for update to authenticated using (private.has_role(auth.uid(),'admin')) with check (private.has_role(auth.uid(),'admin'));
create policy "admin delete games" on public.games for delete to authenticated using (private.has_role(auth.uid(),'admin'));

-- ===== Ledger =====
create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_kind not null,
  category public.ledger_category not null,
  amount integer not null check (amount > 0 and amount <= 100000000),
  entry_date date not null,
  memo text check (memo is null or char_length(memo) <= 300),
  score_id uuid,
  voided_at timestamptz,
  void_reason text,
  voided_by uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.ledger_entries to authenticated;
grant all on public.ledger_entries to service_role;
alter table public.ledger_entries enable row level security;
create policy "members read ledger" on public.ledger_entries for select to authenticated using (private.is_member(auth.uid()));

-- ===== Scores =====
create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  over_par integer not null check (over_par between -30 and 200),
  penalty integer generated always as (greatest(0, floor(over_par / 10.0))::int * 10000) stored,
  payment_entry_id uuid references public.ledger_entries(id),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (game_id, user_id)
);
alter table public.ledger_entries add constraint ledger_score_fk foreign key (score_id) references public.game_scores(id) on delete restrict;
grant select, insert, update, delete on public.game_scores to authenticated;
grant all on public.game_scores to service_role;
alter table public.game_scores enable row level security;
create policy "members read scores" on public.game_scores for select to authenticated using (private.is_member(auth.uid()));
create policy "insert own or admin" on public.game_scores for insert to authenticated
  with check (private.has_role(auth.uid(),'admin') or (user_id = auth.uid() and private.is_member(auth.uid())));
create policy "update own or admin" on public.game_scores for update to authenticated
  using (private.has_role(auth.uid(),'admin') or (user_id = auth.uid() and private.is_member(auth.uid())))
  with check (private.has_role(auth.uid(),'admin') or (user_id = auth.uid() and private.is_member(auth.uid())));
create policy "admin delete scores" on public.game_scores for delete to authenticated
  using (private.has_role(auth.uid(),'admin') and payment_entry_id is null);

create or replace function private.guard_scores()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_admin boolean := private.has_role(auth.uid(),'admin');
begin
  if tg_op = 'INSERT' then
    if new.payment_entry_id is not null and auth.uid() is not null then
      raise exception '납부 정보는 직접 입력할 수 없습니다';
    end if;
    new.updated_by := auth.uid();
    perform private.write_audit('score_create','game_scores',new.id::text, jsonb_build_object('game',new.game_id,'user',new.user_id,'over_par',new.over_par));
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform private.write_audit('score_delete','game_scores',old.id::text, to_jsonb(old));
    return old;
  end if;
  -- UPDATE
  if auth.uid() is not null then
    if new.game_id <> old.game_id or new.user_id <> old.user_id then
      raise exception '게임이나 회원은 변경할 수 없습니다';
    end if;
    if new.payment_entry_id is distinct from old.payment_entry_id and current_setting('app.payment_rpc', true) is distinct from 'on' then
      raise exception '납부 처리는 총무 메뉴에서만 가능합니다';
    end if;
    if not v_admin and old.payment_entry_id is not null and new.over_par <> old.over_par then
      raise exception '이미 납부된 점수는 총무에게 정정을 요청해 주세요';
    end if;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  if new.over_par <> old.over_par then
    perform private.write_audit('score_update','game_scores',new.id::text, jsonb_build_object('from',old.over_par,'to',new.over_par,'paid',old.payment_entry_id is not null));
  end if;
  return new;
end $$;
create trigger guard_scores_ins before insert on public.game_scores for each row execute function private.guard_scores();
create trigger guard_scores_upd before update on public.game_scores for each row execute function private.guard_scores();
create trigger guard_scores_del before delete on public.game_scores for each row execute function private.guard_scores();

create or replace function private.audit_games()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.write_audit(lower(tg_op)||'_game','games', coalesce(new.id,old.id)::text,
    jsonb_build_object('old', case when tg_op<>'INSERT' then to_jsonb(old) end, 'new', case when tg_op<>'DELETE' then to_jsonb(new) end));
  return coalesce(new, old);
end $$;
create trigger audit_games_t after insert or update or delete on public.games for each row execute function private.audit_games();

-- ===== Admin RPCs =====
create or replace function public.admin_set_member_status(_user_id uuid, _status public.member_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not private.has_role(auth.uid(),'admin') then raise exception '권한이 없습니다'; end if;
  if private.has_role(_user_id,'admin') then raise exception '총무 계정 상태는 변경할 수 없습니다'; end if;
  update public.profiles set status = _status, decided_at = now(), decided_by = auth.uid() where id = _user_id;
  if not found then raise exception '회원을 찾을 수 없습니다'; end if;
  perform private.write_audit('member_status','profiles',_user_id::text, jsonb_build_object('status',_status));
end $$;

create or replace function public.admin_add_entry(_kind public.ledger_kind, _category public.ledger_category, _amount int, _date date, _memo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not private.has_role(auth.uid(),'admin') then raise exception '권한이 없습니다'; end if;
  if _category = 'penalty' then raise exception '벌금 수입은 점수 납부 처리로만 기록됩니다'; end if;
  insert into public.ledger_entries(kind, category, amount, entry_date, memo, created_by)
    values (_kind, _category, _amount, _date, nullif(btrim(_memo),''), auth.uid()) returning id into v_id;
  perform private.write_audit('entry_create','ledger_entries',v_id::text, jsonb_build_object('kind',_kind,'category',_category,'amount',_amount,'date',_date));
  return v_id;
end $$;

create or replace function public.admin_void_entry(_entry_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.ledger_entries;
begin
  if not private.has_role(auth.uid(),'admin') then raise exception '권한이 없습니다'; end if;
  if char_length(btrim(coalesce(_reason,''))) < 1 then raise exception '취소 사유를 입력해 주세요'; end if;
  select * into e from public.ledger_entries where id = _entry_id for update;
  if not found then raise exception '내역을 찾을 수 없습니다'; end if;
  if e.voided_at is not null then raise exception '이미 취소된 내역입니다'; end if;
  update public.ledger_entries set voided_at = now(), void_reason = btrim(_reason), voided_by = auth.uid() where id = _entry_id;
  if e.score_id is not null then
    perform set_config('app.payment_rpc','on', true);
    update public.game_scores set payment_entry_id = null where id = e.score_id and payment_entry_id = _entry_id;
    perform set_config('app.payment_rpc','off', true);
  end if;
  perform private.write_audit('entry_void','ledger_entries',_entry_id::text, jsonb_build_object('reason',_reason,'amount',e.amount));
end $$;

-- Mark a score paid: records actual payment of the current charge
create or replace function public.admin_mark_paid(_score_id uuid, _received date, _amount int)
returns uuid language plpgsql security definer set search_path = public as $$
declare s public.game_scores; v_id uuid; v_name text; v_game public.games;
begin
  if not private.has_role(auth.uid(),'admin') then raise exception '권한이 없습니다'; end if;
  select * into s from public.game_scores where id = _score_id for update;
  if not found then raise exception '점수를 찾을 수 없습니다'; end if;
  if s.payment_entry_id is not null then raise exception '이미 납부 처리된 점수입니다. 정정하려면 먼저 납부를 취소하세요'; end if;
  if _amount is null or _amount <= 0 then raise exception '납부 금액을 확인해 주세요'; end if;
  select name into v_name from public.profiles where id = s.user_id;
  select * into v_game from public.games where id = s.game_id;
  insert into public.ledger_entries(kind, category, amount, entry_date, memo, score_id, created_by)
    values ('income','penalty',_amount,_received, v_name||' 벌금 ('||to_char(v_game.played_on,'YYYY-MM-DD')||' '||v_game.venue||')', _score_id, auth.uid())
    returning id into v_id;
  perform set_config('app.payment_rpc','on', true);
  update public.game_scores set payment_entry_id = v_id where id = _score_id;
  perform set_config('app.payment_rpc','off', true);
  perform private.write_audit('score_paid','game_scores',_score_id::text, jsonb_build_object('amount',_amount,'received',_received,'entry',v_id));
  return v_id;
end $$;

-- Admin member list (with phone)
create or replace function public.admin_list_members()
returns table(id uuid, name text, phone text, status public.member_status, created_at timestamptz, is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.has_role(auth.uid(),'admin') then raise exception '권한이 없습니다'; end if;
  return query select p.id, p.name, c.phone, p.status, p.created_at, private.has_role(p.id,'admin')
    from public.profiles p left join public.member_contacts c on c.user_id = p.id order by p.created_at;
end $$;

revoke execute on function public.admin_set_member_status(uuid, public.member_status) from public, anon;
revoke execute on function public.admin_add_entry(public.ledger_kind, public.ledger_category, int, date, text) from public, anon;
revoke execute on function public.admin_void_entry(uuid, text) from public, anon;
revoke execute on function public.admin_mark_paid(uuid, date, int) from public, anon;
revoke execute on function public.admin_list_members() from public, anon;
grant execute on function public.admin_set_member_status(uuid, public.member_status) to authenticated;
grant execute on function public.admin_add_entry(public.ledger_kind, public.ledger_category, int, date, text) to authenticated;
grant execute on function public.admin_void_entry(uuid, text) to authenticated;
grant execute on function public.admin_mark_paid(uuid, date, int) to authenticated;
grant execute on function public.admin_list_members() to authenticated;
revoke execute on function private.handle_new_user() from public, anon, authenticated;


revoke execute on function private.has_role(uuid,public.app_role) from public,anon;
revoke execute on function private.is_member(uuid) from public,anon;
grant execute on function private.has_role(uuid,public.app_role),private.is_member(uuid) to authenticated,service_role;

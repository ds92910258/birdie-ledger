alter table public.ledger_entries add column custom_category text check(custom_category is null or char_length(btrim(custom_category)) between 1 and 30);
create table public.ledger_categories(
 id uuid primary key default gen_random_uuid(),
 kind public.ledger_kind not null,
 label text not null check(label=btrim(label) and char_length(label) between 1 and 30),
 created_at timestamptz not null default now(),
 unique(kind,label)
);
alter table public.ledger_categories enable row level security;
revoke all on public.ledger_categories from public,anon,authenticated;
grant select,insert on public.ledger_categories to authenticated;
grant all on public.ledger_categories to service_role;
create policy "approved members read categories" on public.ledger_categories for select to authenticated using(private.is_member((select auth.uid())));
create policy "admin add categories" on public.ledger_categories for insert to authenticated with check(private.has_role((select auth.uid()),'admin'));
create function public.admin_record_entry(_kind public.ledger_kind,_category public.ledger_category,_amount integer,_date date,_memo text,_custom_category_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_label text;
begin
 if not private.has_role(auth.uid(),'admin') then raise exception '권한이 없습니다'; end if;
 if _custom_category_id is not null then
  if _category<>'other' then raise exception '추가 분류를 확인해 주세요'; end if;
  select label into v_label from public.ledger_categories where id=_custom_category_id and kind=_kind;
  if not found then raise exception '해당 구분의 추가 분류가 아닙니다'; end if;
 elsif _kind='income' and _category not in ('penalty','other') then raise exception '수입 분류를 확인해 주세요';
 elsif _kind='expense' and _category='penalty' then raise exception '벌금은 수입으로 기록해 주세요';
 end if;
 insert into public.ledger_entries(kind,category,custom_category,amount,entry_date,memo,created_by)
 values(_kind,_category,v_label,_amount,_date,nullif(btrim(_memo),''),auth.uid()) returning id into v_id;
 perform private.write_audit('entry_create','ledger_entries',v_id::text,jsonb_build_object('kind',_kind,'category',_category,'custom_category',v_label,'amount',_amount,'date',_date));
 return v_id;
end $$;
revoke all on function public.admin_record_entry(public.ledger_kind,public.ledger_category,integer,date,text,uuid) from public,anon;
grant execute on function public.admin_record_entry(public.ledger_kind,public.ledger_category,integer,date,text,uuid) to authenticated;


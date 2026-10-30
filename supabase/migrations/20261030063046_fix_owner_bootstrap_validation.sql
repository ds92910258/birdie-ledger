create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_phone text; v_name text;
begin
 if new.email='owner@admin.birdiejangbu.app' then
  if not exists(select 1 from public.owner_bootstrap where id=1 and used_at is null and token_hash=new.raw_user_meta_data->>'bootstrap_proof') then
   raise exception '총무 설정 코드가 확인되지 않았습니다';
  end if;
  insert into public.profiles(id,name,status) values(new.id,'정동성','approved');
  return new;
 end if;
 v_phone:=regexp_replace(coalesce(new.raw_user_meta_data->>'phone',''),'[^0-9]','','g');
 v_name:=btrim(coalesce(new.raw_user_meta_data->>'name',''));
 if v_phone !~ '^010[0-9]{8}$' then raise exception '올바른 휴대폰 번호가 아닙니다'; end if;
 if lower(new.email) is distinct from v_phone||'@phone.birdiejangbu.app' then raise exception '허용되지 않은 가입 방식입니다'; end if;
 if char_length(v_name)<1 or char_length(v_name)>30 then raise exception '이름을 확인해 주세요'; end if;
 insert into public.profiles(id,name,status) values(new.id,v_name,'pending');
 insert into public.member_contacts(user_id,phone) values(new.id,v_phone);
 return new;
end $$;
revoke all on function private.handle_new_user() from public,anon,authenticated;


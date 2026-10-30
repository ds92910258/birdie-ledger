import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.118.0';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const out=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return out({error:'잘못된 요청입니다.'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>4096)return out({error:'요청이 너무 큽니다.'},413);
  const b=await req.json(),phone=String(b.phone||'').replace(/\D/g,''),name=String(b.name||'').trim();
  if(!/^010\d{8}$/.test(phone)||name.length<2||name.length>30||typeof b.password!=='string'||b.password.length<8||b.password.length>72)return out({error:'이름·전화번호·비밀번호를 확인해 주세요.'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(phone)));
  const key=Array.from(digest).map(x=>x.toString(16).padStart(2,'0')).join('');
  const {data:allowed,error:rateError}=await db.rpc('allow_signup_request',{_key:key});
  if(rateError||!allowed)return out({error:'요청이 너무 많습니다. 1시간 후 다시 시도해 주세요.'},429);
  const {error}=await db.auth.admin.createUser({email:phone+'@phone.birdiejangbu.app',password:b.password,email_confirm:true,user_metadata:{name,phone}});
  if(error)return out({error:'가입할 수 없습니다. 이미 가입된 번호인지 확인해 주세요.'},400);
  return out({ok:true});
 }catch{return out({error:'가입 요청을 처리하지 못했습니다.'},400)}
});

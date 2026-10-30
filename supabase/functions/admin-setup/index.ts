import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
async function equal(a:string,b:string){const enc=new TextEncoder();const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const u=new Uint8Array(x),v=new Uint8Array(y);let d=0;for(let i=0;i<u.length;i++)d|=u[i]^v[i];return d===0}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'허용되지 않은 요청'},405);
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {count,error:checkError}=await db.from('user_roles').select('id',{count:'exact',head:true}).eq('role','admin');
  if(checkError)return json({error:'관리자 상태를 확인하지 못했습니다.'},503);
  const expected=Deno.env.get('ADMIN_SETUP_TOKEN')||'';
  const body=await req.json();
  if(body.action==='status')return json({adminExists:(count||0)>0,tokenConfigured:expected.length>=32});
  if((count||0)>0)return json({error:'이미 총무 계정이 설정되어 있습니다.'},409);
  if(expected.length<32||typeof body.token!=='string'||body.token.length>256||!await equal(body.token,expected))return json({error:'설정 토큰을 확인해 주세요.'},403);
  if(typeof body.password!=='string'||body.password.length<10||body.password.length>72)return json({error:'비밀번호는 10~72자여야 합니다.'},400);
  // A unique auth email prevents two concurrent bootstrap requests from creating separate admins.
  const {data,error}=await db.auth.admin.createUser({email:'owner@admin.birdiejangbu.app',password:body.password,email_confirm:true,app_metadata:{bootstrap_admin:'true',name:'정동성'}});
  if(error||!data.user)return json({error:'계정 생성에 실패했습니다. 소유자 설정을 확인해 주세요.'},409);
  const {error:roleError}=await db.from('user_roles').insert({user_id:data.user.id,role:'admin'});
  if(roleError){await db.auth.admin.deleteUser(data.user.id);return json({error:'관리자 권한을 설정하지 못했습니다.'},500)}
  await db.from('audit_log').insert({actor:data.user.id,action:'owner_bootstrap',entity:'user_roles',entity_id:data.user.id});
  return json({ok:true});
 }catch{return json({error:'요청 처리에 실패했습니다.'},400)}
});

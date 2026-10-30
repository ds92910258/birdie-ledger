import {supabase} from '@/integrations/supabase/client';
async function setupRequest(body:Record<string,unknown>){
 const {data,error}=await supabase.functions.invoke('admin-setup',{body});
 if(error){
  let message='총무 계정을 설정하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  try{const response=await error.context?.json();if(typeof response?.error==='string')message=response.error;}catch{}
  throw new Error(message);
 }
 if(data?.error)throw new Error(data.error);
 return data;
}
export async function getSetupState(){return await setupRequest({action:'status'}) as {adminExists:boolean;tokenConfigured:boolean};}
export async function bootstrapOwnerAdmin({data}:{data:{token:string;password:string}}){return setupRequest({action:'create',...data});}

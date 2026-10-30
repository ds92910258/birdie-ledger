import {supabase} from '@/integrations/supabase/client';
export async function getSetupState(){const {data,error}=await supabase.functions.invoke('admin-setup',{body:{action:'status'}});if(error)throw error;return data as {adminExists:boolean;tokenConfigured:boolean}}
export async function bootstrapOwnerAdmin({data:body}:{data:{token:string;password:string}}){const {data,error}=await supabase.functions.invoke('admin-setup',{body:{action:'create',...body}});if(error)throw error;if(data.error)throw new Error(data.error);return data}

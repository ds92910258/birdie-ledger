import {beforeEach,describe,it,expect,vi} from 'vitest';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke}}}));
import {bootstrapOwnerAdmin,getSetupState} from './admin-setup.functions';
beforeEach(()=>invoke.mockReset());
describe('총무 설정 서버 응답',()=>{
 it('실패 응답의 원인을 한국어로 전달한다',async()=>{
  invoke.mockResolvedValue({data:null,error:{context:{json:async()=>({error:'설정 토큰을 확인해 주세요.'})}}});
  await expect(bootstrapOwnerAdmin({data:{token:'invalid',password:'not-a-real-password'}})).rejects.toThrow('설정 토큰을 확인해 주세요.');
 });
 it('서버 응답을 읽을 수 없어도 일반 영문 오류를 노출하지 않는다',async()=>{
  invoke.mockResolvedValue({data:null,error:{message:'Edge Function returned a non-2xx status code'}});
  await expect(getSetupState()).rejects.toThrow('총무 계정을 설정하지 못했습니다.');
 });
 it('정상 응답을 전달한다',async()=>{
  invoke.mockResolvedValue({data:{adminExists:false,tokenConfigured:true},error:null});
  await expect(getSetupState()).resolves.toEqual({adminExists:false,tokenConfigured:true});
 });
});

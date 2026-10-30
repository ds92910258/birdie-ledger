import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
const {rpc,from,single}=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),single:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc,from}}));
vi.mock('sonner',()=>({toast:{error:vi.fn(),success:vi.fn()}}));
import {EntryForm} from '../routes/_authenticated/dues';
afterEach(cleanup);
beforeEach(()=>{rpc.mockReset();rpc.mockResolvedValue({data:'entry-1',error:null});single.mockReset();from.mockImplementation((table:string)=>table==='ledger_categories'?{insert:()=>({select:()=>({single})})}:{select:()=>({eq:()=>({single:async()=>({data:{id:'entry-1',amount:rpc.mock.lastCall?.[1]?._amount},error:null})})})});});
describe('수입·지출 추가 분류',()=>{
 it('수입에서 벌금·기타·분류 추가를 제공하며 식비는 제외한다',()=>{
  render(<EntryForm onDone={()=>{}} categories={[]} />);
  fireEvent.change(screen.getByLabelText('구분'),{target:{value:'income'}});
  expect(screen.getByRole('option',{name:'벌금'})).toBeInTheDocument();
  expect(screen.getByRole('option',{name:'기타'})).toBeInTheDocument();
  expect(screen.getByRole('option',{name:'＋ 분류 추가'})).toBeInTheDocument();
  expect(screen.queryByRole('option',{name:'식비'})).toBeNull();
 });
 it('수입 벌금을 실제 수입으로 저장한다',async()=>{
  render(<EntryForm onDone={()=>{}} categories={[]} />);
  fireEvent.change(screen.getByLabelText('구분'),{target:{value:'income'}});
  fireEvent.change(screen.getByLabelText('금액 (원)'),{target:{value:'20000'}});
  fireEvent.click(screen.getByRole('button',{name:'회비 저장하기'}));
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('admin_record_entry',expect.objectContaining({_kind:'income',_category:'penalty',_amount:20000})));
 });
 it('추가 분류를 저장한 뒤 선택하고 해당 분류로 장부를 기록한다',async()=>{
  single.mockResolvedValue({data:{id:'cat-1',kind:'expense',label:'스크린 이용료'},error:null});
  render(<EntryForm onDone={()=>{}} categories={[]} />);
  fireEvent.change(screen.getByLabelText('분류'),{target:{value:'add'}});
  fireEvent.change(screen.getByLabelText('추가할 지출 분류'),{target:{value:'스크린 이용료'}});
  fireEvent.click(screen.getByRole('button',{name:'추가'}));
  await waitFor(()=>expect(screen.getByLabelText('분류')).toHaveValue('custom:cat-1'));
  fireEvent.change(screen.getByLabelText('금액 (원)'),{target:{value:'50000'}});
  fireEvent.click(screen.getByRole('button',{name:'회비 저장하기'}));
  await waitFor(()=>expect(rpc).toHaveBeenCalledWith('admin_record_entry',expect.objectContaining({_kind:'expense',_category:'other',_custom_category_id:'cat-1',_amount:50000})));
 });
 it('쉼표가 있는 회비도 저장하고 서버 확인 후 완료를 표시한다',async()=>{
  render(<EntryForm onDone={()=>{}} categories={[]} />);
  fireEvent.change(screen.getByLabelText('구분'),{target:{value:'income'}});
  fireEvent.change(screen.getByLabelText('금액 (원)'),{target:{value:'100,000'}});
  fireEvent.click(screen.getByRole('button',{name:'회비 저장하기'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('수입 100,000원을 저장했습니다.'));
  expect(rpc).toHaveBeenCalledWith('admin_record_entry',expect.objectContaining({_amount:100000}));
 });
 it('날짜가 없으면 화면에 이유를 표시하고 저장 요청을 하지 않는다',async()=>{
  render(<EntryForm onDone={()=>{}} categories={[]} />);
  fireEvent.change(screen.getByLabelText('금액 (원)'),{target:{value:'10000'}});
  fireEvent.change(screen.getByLabelText('날짜'),{target:{value:''}});
  fireEvent.click(screen.getByRole('button',{name:'회비 저장하기'}));
  expect(screen.getByRole('alert')).toHaveTextContent('날짜를 선택');expect(rpc).not.toHaveBeenCalled();
 });
 it('저장이 거절되면 입력을 지우거나 성공 표시를 하지 않는다',async()=>{
  rpc.mockResolvedValue({data:null,error:{message:'권한이 없습니다.'}});
  render(<EntryForm onDone={()=>{}} categories={[]} />);
  fireEvent.change(screen.getByLabelText('금액 (원)'),{target:{value:'10000'}});
  fireEvent.click(screen.getByRole('button',{name:'회비 저장하기'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('권한이 없습니다.'));
  expect(screen.getByLabelText('금액 (원)')).toHaveValue('10000');
 });

});

import {it,expect} from 'vitest';
import {auditLabel,auditTime} from './audit-label';
it('회비 기록을 분류와 금액이 있는 한국어로 표시한다',()=>expect(auditLabel({action:'entry_create',details:{kind:'income',category:'other',custom_category:'정기회비',amount:10000}})).toEqual({title:'회비 수입 기록',detail:'정기회비 · 10,000원'}));
it('점수 변경을 이전·이후 스코어로 표시한다',()=>expect(auditLabel({action:'score_update',details:{from:23,to:18}}).detail).toBe('+23타 → +18타'));
it('회원 번호 대신 이름으로 승인 기록을 표시한다',()=>expect(auditLabel({action:'member_status',entity_id:'private-id',details:{status:'approved'}},()=> '홍길동')).toEqual({title:'회원 승인',detail:'홍길동'}));
it('알 수 없는 데이터에서 원시 문자열을 노출하지 않는다',()=>expect(auditLabel({action:'unknown_123',details:{secret:'raw-json'}})).toEqual({title:'기록 변경',detail:'모임 정보가 변경되었습니다.'}));
it('잘못된 시간도 화면 오류 없이 처리한다',()=>expect(auditTime('invalid')).toBe('시간 정보 없음'));

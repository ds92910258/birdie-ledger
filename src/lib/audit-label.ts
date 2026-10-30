import {CATEGORY_LABEL,formatOver,won} from './golf';
type AuditItem={action:string;entity_id?:string|null;details?:unknown};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?won(v):'';
export function auditLabel(item:AuditItem,name:(id:string)=>string=()=> '회원'){
 const d=obj(item.details),person=name(str(d['user'])||str(d['user_id'])||item.entity_id||'');
 const category=str(d['custom_category'])||CATEGORY_LABEL[str(d['category'])]||'';
 const game=obj(d['new']||d['old']);
 switch(item.action){
  case 'owner_bootstrap':return {title:'총무 계정 생성',detail:'총무 계정의 최초 설정을 완료했습니다.'};
  case 'member_status':{
   const status=str(d['status']);const action:Record<string,string>={approved:'승인',rejected:'가입 거절',revoked:'권한 해제',pending:'승인 대기로 변경'};
   return {title:`회원 ${action[status]||'상태 변경'}`,detail:person};
  }
  case 'insert_game':case 'update_game':case 'delete_game':return {title:{insert_game:'게임 등록',update_game:'게임 정보 수정',delete_game:'게임 삭제'}[item.action]!,detail:[str(game['played_on']),str(game['venue'])].filter(Boolean).join(' · ')};
  case 'score_create':return {title:'스코어 등록',detail:[person,typeof d['over_par']==='number'?formatOver(d['over_par'])+'타':''].filter(Boolean).join(' · ')};
  case 'score_update':return {title:'스코어 수정',detail:typeof d['from']==='number'&&typeof d['to']==='number'?`${formatOver(d['from'])}타 → ${formatOver(d['to'])}타${d['paid']?' · 납부 금액 재확인 필요':''}`:'스코어를 수정했습니다.'};
  case 'score_delete':return {title:'스코어 삭제',detail:person};
  case 'score_paid':return {title:'벌금 납부 확인',detail:[amount(d['amount']),str(d['received'])].filter(Boolean).join(' · ')};
  case 'entry_create':return {title:d['kind']==='income'?'회비 수입 기록':'회비 지출 기록',detail:[category,amount(d['amount']),str(d['date'])].filter(Boolean).join(' · ')};
  case 'entry_void':return {title:'회비 내역 취소',detail:[amount(d['amount']),str(d['reason'])].filter(Boolean).join(' · ')};
  default:return {title:'기록 변경',detail:'모임 정보가 변경되었습니다.'};
 }
}
export function auditTime(value:string){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '시간 정보 없음';return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);}

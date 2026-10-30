import {describe,it,expect} from 'vitest';
import {recentMemberGames} from './recent-games';
const games=Array.from({length:15},(_,i)=>({id:'g'+i,played_on:`2026-10-${String(i+1).padStart(2,'0')}`,created_at:`2026-10-${String(i+1).padStart(2,'0')}T10:00:00Z`}));
const scores=games.map((g,i)=>({game_id:g.id,user_id:'a',over_par:i}));
describe('최근 10게임 선택',()=>{
 it('입력 순서와 상관없이 최근 10게임을 오래된 순서로 표시한다',()=>expect(recentMemberGames([...games].reverse(),scores,'a').map(g=>g.id)).toEqual(games.slice(5).map(g=>g.id)));
 it('선택 회원이 실제 점수를 등록한 게임만 포함한다',()=>expect(recentMemberGames(games,[...scores.slice(0,3),{game_id:'g14',user_id:'b',over_par:1}],'a')).toHaveLength(3));
 it('기간을 먼저 적용한 다음 최근 게임을 고른다',()=>expect(recentMemberGames(games,scores,'a','2026-10-02','2026-10-12').map(g=>g.id)).toEqual(games.slice(2,12).map(g=>g.id)));
 it('같은 날짜에는 게임 생성 순서로 최근 기록을 고른다',()=>{const same=games.map(g=>({...g,played_on:'2026-10-20'}));expect(recentMemberGames(same,scores,'a').map(g=>g.id)).toEqual(games.slice(5).map(g=>g.id));});
 it('기록이 없으면 빈 목록을 반환한다',()=>expect(recentMemberGames(games,scores,'nobody')).toEqual([]));
});

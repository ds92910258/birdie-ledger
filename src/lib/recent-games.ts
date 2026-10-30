export type DatedGame = {id:string; played_on:string; created_at?:string};
export type MemberScore = {game_id:string; user_id:string; over_par:number};
/** Select only games actually played by the chosen member, then show oldest first. */
export function recentMemberGames<G extends DatedGame>(games:G[],scores:MemberScore[],memberId:string,from='',to=''){
 const played=new Set(scores.filter(s=>s.user_id===memberId).map(s=>s.game_id));
 return games.filter(g=>played.has(g.id)&&(!from||g.played_on>=from)&&(!to||g.played_on<=to))
  .sort((a,b)=>b.played_on.localeCompare(a.played_on)||(b.created_at??'').localeCompare(a.created_at??'')||b.id.localeCompare(a.id))
  .slice(0,10).reverse();
}

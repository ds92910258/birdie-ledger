import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, LabelList, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, StateBox } from "@/components/AppShell";
import { useClubData, type Me } from "@/lib/club";
import { recentMemberGames } from "@/lib/recent-games";
import { formatOver, scoreStats } from "@/lib/golf";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({ meta: [{ title: "기록 · 버디장부" }, { name: "description", content: "회원별 오버파 기록 차트" }, { property: "og:title", content: "기록 · 버디장부" }, { property: "og:description", content: "회원별 오버파 기록" }] }),
  component: () => <AppShell>{(me) => <RecordsView me={me} />}</AppShell>,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)"];

function RecordsView({ me }: { me: Me }) {
  const q = useClubData(true);
  const [a, setA] = useState(me.id);
  const [b, setB] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const view = useMemo(() => {
    if (!q.data) return null;
    const { games, scores, members } = q.data;
    const ids=[...new Set([a,b].filter(Boolean))];
    const selectedGames=recentMemberGames(games,scores,a,from,to);
    const selectedIds=new Set(selectedGames.map(g=>g.id));
    const rows=scores.filter(s=>selectedIds.has(s.game_id)&&ids.includes(s.user_id));
    const data=selectedGames.map(g=>{
      const point:Record<string,string|number>={date:g.played_on,label:`${g.played_on} ${g.venue}`};
      for(const r of rows.filter(s=>s.game_id===g.id))point[r.user_id]=r.over_par;
      return point;
    });
    const name = (id: string) => members.find((m) => m.id === id)?.name ?? "";
    return { data, selectedGames, ids, name, members, stats: ids.map((id) => ({ id, ...scoreStats(rows.filter((r) => r.user_id === id).map((r) => r.over_par)) })) };
  }, [q.data, a, b, from, to]);

  if (q.isLoading) return <StateBox>불러오는 중…</StateBox>;
  if (q.error || !view) return <StateBox>기록을 불러오지 못했어요. <Button variant="link" onClick={() => q.refetch()}>다시 시도</Button></StateBox>;
  const opts = view.members.filter((m) => m.status === "approved" || m.id === me.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">개인기록</h1>
      <p className="text-sm text-muted-foreground">선택한 회원의 최근 10게임 스코어입니다. 오버파가 낮을수록 좋은 기록이에요.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0 space-y-1"><Label htmlFor="ma">회원</Label>
          <select id="ma" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={a} onChange={(e) => {setA(e.target.value);if(b===e.target.value)setB("");}}>
            {opts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></div>
        <div className="min-w-0 space-y-1"><Label htmlFor="mb">비교 (선택)</Label>
          <select id="mb" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">없음</option>
            {opts.filter((m) => m.id !== a).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></div>
        <div className="min-w-0 space-y-1"><Label htmlFor="from">시작일</Label><Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="min-w-0 space-y-1"><Label htmlFor="to">종료일</Label><Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${view.stats.length}, minmax(0,1fr))` }}>
        {view.stats.map((s, i) => (
          <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold" style={{ color: COLORS[i] }}>{view.name(s.id)}</p>
            <dl className="mt-2 grid grid-cols-3 text-center text-xs text-muted-foreground">
              <div><dt>평균</dt><dd className="text-base font-bold text-foreground">{s.avg == null ? "-" : formatOver(s.avg)}</dd></div>
              <div><dt>베스트</dt><dd className="text-base font-bold text-foreground">{s.best == null ? "-" : formatOver(s.best)}</dd></div>
              <div><dt>게임 수</dt><dd className="text-base font-bold text-foreground">{s.count}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      {view.data.length === 0 ? <StateBox>선택한 기간에 기록이 없어요.</StateBox> : (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="font-bold">최근 10게임 스코어</h2>
          <p className="mt-1 text-xs text-muted-foreground">{view.name(a)} · 최근 {view.data.length}게임 · 오버파(타){b&&" · 비교 회원은 같은 게임에 참여한 기록만 표시"}</p>
          <div className="mt-4 h-72 w-full min-w-0" role="img" aria-label={`${view.name(a)} 최근 ${view.data.length}게임 스코어 그래프`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view.data} margin={{ top: 28, right: 18, left: -20, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v:string)=>v.slice(5)} minTickGap={12} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={['auto','auto']} tickFormatter={(v:number)=>formatOver(v)} />
              <Tooltip labelFormatter={(_, p) => (p?.[0]?.payload?.label as string) ?? ""} formatter={(v: number, n: string) => [formatOver(v), view.name(n)]} />
              {view.ids.length > 1 && <Legend formatter={(v: string) => view.name(v)} />}
              {view.ids.map((id, i) => <Line key={id} type="linear" dataKey={id} stroke={COLORS[i]} strokeWidth={2.5} dot={{ r: 4 }} activeDot={{r:6}} connectNulls isAnimationActive={false}>{i===0&&<LabelList dataKey={id} position="top" offset={10} fontSize={11} formatter={(v:unknown)=>formatOver(Number(v))} />}</Line>)}
            </LineChart>
          </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">왼쪽부터 오래된 순서입니다. 점을 누르면 날짜와 스코어를 볼 수 있어요.</p>
          <ol className="mt-4 divide-y divide-border border-t border-border text-sm">
            {view.selectedGames.map(g=>{const score=q.data!.scores.find(s=>s.game_id===g.id&&s.user_id===a);return <li key={g.id} className="flex items-center justify-between gap-3 py-2"><span className="text-muted-foreground">{g.played_on} · {g.venue}</span><strong>{score?formatOver(score.over_par):'-'}</strong></li>;})}
          </ol>
        </section>
      )}
    </div>
  );
}


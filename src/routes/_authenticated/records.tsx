import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, StateBox } from "@/components/AppShell";
import { useClubData, type Me } from "@/lib/club";
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
    const gmap = new Map(games.map((g) => [g.id, g]));
    const ids = [a, b].filter(Boolean);
    const rows = scores
      .filter((s) => ids.includes(s.user_id))
      .map((s) => ({ ...s, game: gmap.get(s.game_id)! }))
      .filter((r) => r.game && (!from || r.game.played_on >= from) && (!to || r.game.played_on <= to))
      .sort((x, y) => x.game.played_on.localeCompare(y.game.played_on));
    const byKey = new Map<string, Record<string, string | number>>();
    for (const r of rows) {
      const key = r.game.id;
      const p = byKey.get(key) ?? { date: r.game.played_on, label: `${r.game.played_on} ${r.game.venue}` };
      p[r.user_id] = r.over_par;
      byKey.set(key, p);
    }
    const name = (id: string) => members.find((m) => m.id === id)?.name ?? "";
    return { data: [...byKey.values()], ids, name, members, stats: ids.map((id) => ({ id, ...scoreStats(rows.filter((r) => r.user_id === id).map((r) => r.over_par)) })) };
  }, [q.data, a, b, from, to]);

  if (q.isLoading) return <StateBox>불러오는 중…</StateBox>;
  if (q.error || !view) return <StateBox>기록을 불러오지 못했어요. <Button variant="link" onClick={() => q.refetch()}>다시 시도</Button></StateBox>;
  const opts = view.members.filter((m) => m.status === "approved" || m.id === me.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">기록</h1>
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="space-y-1"><Label htmlFor="ma">회원</Label>
          <select id="ma" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={a} onChange={(e) => setA(e.target.value)}>
            {opts.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></div>
        <div className="space-y-1"><Label htmlFor="mb">비교 (선택)</Label>
          <select id="mb" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={b} onChange={(e) => setB(e.target.value)}>
            <option value="">없음</option>
            {opts.filter((m) => m.id !== a).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select></div>
        <div className="space-y-1"><Label htmlFor="from">시작일</Label><Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="to">종료일</Label><Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
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
        <div className="h-72 rounded-2xl border border-border bg-card p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view.data} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(_, p) => (p?.[0]?.payload?.label as string) ?? ""} formatter={(v: number, n: string) => [formatOver(v), view.name(n)]} />
              {view.ids.length > 1 && <Legend formatter={(v: string) => view.name(v)} />}
              {view.ids.map((id, i) => <Line key={id} type="monotone" dataKey={id} stroke={COLORS[i]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StateBox } from "@/components/AppShell";
import { useClubData, type Me } from "@/lib/club";
import { computeBalance, computeUnpaid, formatDateKo, formatOver, scoreStats, won } from "@/lib/golf";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "홈 · 버디장부" }, { name: "description", content: "모임 잔액과 최근 게임 요약" }, { property: "og:title", content: "홈 · 버디장부" }, { property: "og:description", content: "모임 잔액과 최근 게임" }] }),
  component: () => <AppShell>{(me) => <HomeView me={me} />}</AppShell>,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function HomeView({ me }: { me: Me }) {
  const q = useClubData(true);
  if (q.isLoading) return <StateBox>불러오는 중…</StateBox>;
  if (q.error) return <StateBox>데이터를 불러오지 못했어요. <Button variant="link" onClick={() => q.refetch()}>다시 시도</Button></StateBox>;
  const { games, scores, entries } = q.data!;
  const bal = computeBalance(entries);
  const unpaid = computeUnpaid(scores);
  const mine = scores.filter((s) => s.user_id === me.id);
  const myUnpaid = computeUnpaid(mine);
  const st = scoreStats(mine.map((s) => s.over_par));
  const recent = games.slice(0, 3);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-hero p-6 text-primary-foreground shadow-soft">
        <p className="text-sm opacity-80">모임 잔액 (실제 입금 기준)</p>
        <p className="mt-1 font-display text-4xl font-bold">{won(bal.balance)}</p>
        <div className="mt-4 flex gap-4 text-sm opacity-90">
          <span>수입 {won(bal.income)}</span><span>지출 {won(bal.expense)}</span>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3">
        <Stat label="미납 벌금 (전체)" value={won(unpaid)} />
        <Stat label="내 미납 벌금" value={won(myUnpaid)} />
        <Stat label="내 평균 오버" value={st.avg == null ? "-" : formatOver(st.avg)} sub={`${st.count}게임`} />
        <Stat label="내 베스트" value={st.best == null ? "-" : formatOver(st.best)} />
      </section>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">최근 게임</h2>
          <Link to="/games" className="text-sm text-primary">전체 보기</Link>
        </div>
        {recent.length === 0 ? <StateBox>아직 등록된 게임이 없어요.</StateBox> : (
          <ul className="space-y-2">
            {recent.map((g) => {
              const gs = scores.filter((s) => s.game_id === g.id);
              const my = gs.find((s) => s.user_id === me.id);
              return (
                <li key={g.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div><p className="font-semibold">{g.venue}</p><p className="text-xs text-muted-foreground">{formatDateKo(g.played_on)} · {gs.length}명</p></div>
                  <span className="text-sm font-semibold text-primary">{my ? formatOver(my.over_par) : "미참가"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}


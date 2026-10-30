import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { errMsg, useClubData, useRefresh, type Entry, type Me } from "@/lib/club";
import { CATEGORY_LABEL, computeBalance, computeUnpaid, formatDateKo, formatOver, todayKST, won } from "@/lib/golf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dues")({
  head: () => ({ meta: [{ title: "회비 · 버디장부" }, { name: "description", content: "모임 공동 장부와 벌금 납부 현황" }, { property: "og:title", content: "회비 · 버디장부" }, { property: "og:description", content: "공동 장부와 납부 현황" }] }),
  component: () => <AppShell>{(me) => <DuesView me={me} />}</AppShell>,
});

function DuesView({ me }: { me: Me }) {
  const q = useClubData(true);
  const refresh = useRefresh();
  const [showVoided, setShowVoided] = useState(false);
  if (q.isLoading) return <StateBox>불러오는 중…</StateBox>;
  if (q.error) return <StateBox>장부를 불러오지 못했어요. <Button variant="link" onClick={() => q.refetch()}>다시 시도</Button></StateBox>;
  const { games, scores, members, entries } = q.data!;
  const bal = computeBalance(entries);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "알 수 없음";
  const gmap = new Map(games.map((g) => [g.id, g]));
  const emap = new Map(entries.map((e) => [e.id, e]));
  const unpaid = scores.filter((s) => s.penalty > 0 && !s.payment_entry_id);
  const mismatch = scores.filter((s) => s.payment_entry_id && emap.get(s.payment_entry_id)?.amount !== s.penalty);
  const list = entries.filter((e) => showVoided || !e.voided_at);

  async function markPaid(scoreId: string, amount: number, date: string) {
    const { error } = await supabase.rpc("admin_mark_paid", { _score_id: scoreId, _received: date, _amount: amount });
    if (error) return void toast.error(errMsg(error));
    toast.success("납부 처리했어요"); refresh();
  }
  async function voidEntry(e: Entry) {
    const reason = prompt(e.score_id ? "납부 취소 사유 (점수는 다시 미납이 됩니다)" : "취소 사유를 입력해 주세요");
    if (!reason?.trim()) return;
    const { error } = await supabase.rpc("admin_void_entry", { _entry_id: e.id, _reason: reason.trim() });
    if (error) return void toast.error(errMsg(error));
    toast.success("취소했어요. 기록은 장부에 남아요."); refresh();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">회비</h1>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["잔액", bal.balance], ["총 수입", bal.income], ["총 지출", bal.expense], ["미납 벌금", computeUnpaid(scores)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-bold">{won(v as number)}</p></div>
        ))}
      </section>
      <p className="text-xs text-muted-foreground">잔액은 실제 입금·수입에서 지출을 뺀 금액이에요. 미납 벌금은 잔액에 포함되지 않아요.</p>

      {me.isAdmin && mismatch.length > 0 && (
        <section className="rounded-2xl border border-warning bg-card p-4">
          <h2 className="font-bold">정산 필요 ({mismatch.length})</h2>
          <p className="text-xs text-muted-foreground">납부 후 점수가 바뀌어 청구액과 납부액이 달라요. 납부를 취소하고 다시 처리하거나 차액을 별도 수입으로 기록하세요.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {mismatch.map((s) => { const e = emap.get(s.payment_entry_id!)!; const g = gmap.get(s.game_id); return (
              <li key={s.id} className="flex items-center justify-between gap-2"><span>{name(s.user_id)} · {g?.played_on} · 청구 {won(s.penalty)} / 납부 {won(e?.amount ?? 0)}</span>
                {e && <Button size="sm" variant="outline" onClick={() => voidEntry(e)}>납부 취소</Button>}</li>); })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold">미납 벌금</h2>
        {unpaid.length === 0 ? <StateBox>미납 벌금이 없어요. 🎉</StateBox> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {unpaid.map((s) => { const g = gmap.get(s.game_id); return (
              <UnpaidRow key={s.id} label={`${name(s.user_id)} · ${g ? `${g.played_on} ${g.venue}` : ""} · ${formatOver(s.over_par)}`} amount={s.penalty} isAdmin={me.isAdmin} onPay={(d) => markPaid(s.id, s.penalty, d)} />); })}
          </ul>
        )}
      </section>

      {me.isAdmin && <EntryForm onDone={refresh} />}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">공동 장부</h2>
          <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />취소 내역 보기</label>
        </div>
        {list.length === 0 ? <StateBox>장부 내역이 없어요.</StateBox> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {list.map((e) => (
              <li key={e.id} className={`flex items-center gap-3 p-3 ${e.voided_at ? "opacity-50" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.memo || CATEGORY_LABEL[e.category]}</p>
                  <p className="text-xs text-muted-foreground">{formatDateKo(e.entry_date)} · {CATEGORY_LABEL[e.category]}{e.voided_at && ` · 취소됨: ${e.void_reason}`}</p>
                </div>
                <span className={`text-sm font-bold ${e.kind === "income" ? "text-success" : "text-destructive"} ${e.voided_at ? "line-through" : ""}`}>{e.kind === "income" ? "+" : "-"}{won(e.amount)}</span>
                {me.isAdmin && !e.voided_at && <Button size="sm" variant="ghost" onClick={() => voidEntry(e)}>취소</Button>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UnpaidRow({ label, amount, isAdmin, onPay }: { label: string; amount: number; isAdmin: boolean; onPay: (d: string) => void }) {
  const [d, setD] = useState(todayKST());
  return (
    <li className="flex flex-wrap items-center gap-2 p-3">
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <Badge variant="outline">{won(amount)}</Badge>
      {isAdmin && <>
        <Input aria-label="입금일" type="date" className="h-8 w-36" value={d} onChange={(e) => setD(e.target.value)} />
        <Button size="sm" onClick={() => onPay(d)}>납부 확인</Button>
      </>}
    </li>
  );
}

function EntryForm({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const amount = Number(f.get("amount"));
    if (!Number.isInteger(amount) || amount <= 0) return void toast.error("금액은 1원 이상의 정수로 입력해 주세요");
    setBusy(true);
    const { error } = await supabase.rpc("admin_add_entry", {
      _kind: f.get("kind") as "income" | "expense", _category: f.get("category") as "food" | "coffee" | "other",
      _amount: amount, _date: String(f.get("date")), _memo: String(f.get("memo") ?? ""),
    });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("장부에 기록했어요"); form.reset(); onDone();
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold">수입·지출 기록</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="kind">구분</Label><select id="kind" name="kind" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="expense">지출</option><option value="income">수입</option></select></div>
        <div className="space-y-1"><Label htmlFor="category">분류</Label><select id="category" name="category" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="food">식비</option><option value="coffee">커피</option><option value="other">기타</option></select></div>
        <div className="space-y-1"><Label htmlFor="edate">날짜</Label><Input id="edate" name="date" type="date" defaultValue={todayKST()} required /></div>
        <div className="space-y-1"><Label htmlFor="amount">금액 (원)</Label><Input id="amount" name="amount" inputMode="numeric" required placeholder="30000" /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="emo">메모</Label><Input id="emo" name="memo" maxLength={300} /></div>
      <Button disabled={busy} className="w-full">{busy ? "저장 중…" : "기록하기"}</Button>
    </form>
  );
}


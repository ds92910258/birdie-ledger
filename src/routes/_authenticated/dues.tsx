import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { errMsg, useClubData, useRefresh, type Entry, type Me } from "@/lib/club";
import { CATEGORY_LABEL, computeBalance, computeUnpaid, formatDateKo, formatOver, todayKST, won } from "@/lib/golf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseWonInput,validEntryDate } from "@/lib/entry-input";
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

      {me.isAdmin && <EntryForm onDone={refresh} categories={q.data!.categories} />}

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
                  <p className="truncate text-sm font-medium">{e.memo || e.custom_category || CATEGORY_LABEL[e.category]}</p>
                  <p className="text-xs text-muted-foreground">{formatDateKo(e.entry_date)} · {e.custom_category || CATEGORY_LABEL[e.category]}{e.voided_at && ` · 취소됨: ${e.void_reason}`}</p>
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

export function EntryForm({ onDone, categories }: { onDone: () => void; categories: { id:string; kind:"income"|"expense"; label:string }[] }) {
  const [busy,setBusy]=useState(false);
  const saving=useRef(false);
  const [entryDate,setEntryDate]=useState(todayKST());
  const [feedback,setFeedback]=useState<{kind:'error'|'success'|'info';text:string}|null>(null);
  const [kind,setKind]=useState<"income"|"expense">("expense");
  const [category,setCategory]=useState("food");
  const [label,setLabel]=useState("");
  const [adding,setAdding]=useState(false);
  const [localCategories,setLocalCategories]=useState<typeof categories>([]);
  const available=[...categories,...localCategories.filter(c=>!categories.some(x=>x.id===c.id))].filter(c=>c.kind===kind);
  async function addCategory(){
    const name=label.trim();
    if(!name||name.length>30){toast.error("분류 이름을 1~30자로 입력해 주세요");return;}
    const duplicate=available.find(c=>c.label===name);
    if(duplicate){setCategory('custom:'+duplicate.id);setLabel('');return;}
    setAdding(true);
    try{
      const {data,error}=await supabase.from('ledger_categories').insert({kind,label:name}).select('id,kind,label').single();
      if(error){toast.error(errMsg(error));return;}
      setLocalCategories(prev=>[...prev,data]);setCategory('custom:'+data.id);setLabel('');onDone();setFeedback({kind:'info',text:'분류를 추가했어요. 금액을 입력하고 아래 ‘회비 저장하기’를 눌러야 장부에 기록됩니다.'});toast.success('분류를 추가했어요');
    }catch{toast.error('분류를 저장하지 못했습니다. 다시 시도해 주세요.');}
    finally{setAdding(false);}
  }
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(saving.current)return;
    setFeedback(null);
    const fail=(text:string)=>{setFeedback({kind:'error',text});toast.error(text);};
    if(category==='add'){fail('분류 이름을 입력한 뒤 ‘추가’를 눌러 주세요.');return;}
    const form=e.currentTarget,f=new FormData(form),amount=parseWonInput(String(f.get('amount')??''));
    if(amount===null){fail('금액을 1원부터 1억원까지 입력해 주세요. 예: 10,000');return;}
    if(!validEntryDate(entryDate)){fail('입금 또는 지출 날짜를 선택해 주세요.');return;}
    saving.current=true;setBusy(true);
    let savedId:string|null=null;
    try{
      const customId=category.startsWith('custom:')?category.slice(7):null;
      const {data,error}=await supabase.rpc('admin_record_entry',{
        _kind:kind,_category:customId?'other':category as 'food'|'coffee'|'other'|'penalty',
        ...(customId?{_custom_category_id:customId}:{}),_amount:amount,_date:entryDate,_memo:String(f.get('memo')??''),
      });
      if(error){fail(errMsg(error));return;}
      if(!data){fail('저장 결과를 확인하지 못했습니다. 새로고침 후 장부를 확인해 주세요.');return;}
      savedId=data;
      const check=await supabase.from('ledger_entries').select('id,amount,kind').eq('id',savedId).single();
      if(check.error||check.data?.amount!==amount){
        setFeedback({kind:'info',text:'저장 요청은 완료됐지만 조회를 확인하지 못했어요. 중복 입력하지 말고 새로고침해 장부를 확인해 주세요.'});
        await onDone();return;
      }
      form.reset();
      await onDone();
      setFeedback({kind:'success',text:`${kind==='income'?'수입':'지출'} ${won(amount)}을 저장했습니다. 아래 공동 장부에서 확인하세요.`});
      toast.success('회비가 저장됐어요');
    }catch{
      if(savedId)setFeedback({kind:'info',text:'저장 요청은 완료됐어요. 중복 입력하지 말고 새로고침해 장부를 확인해 주세요.'});
      else fail('서버 응답을 확인하지 못했습니다. 새로고침해 장부를 확인한 뒤 다시 시도해 주세요.');
    }finally{saving.current=false;setBusy(false);}
  }
  return <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-border bg-card p-4">
    <h2 className="font-bold">수입·지출 기록</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1"><Label htmlFor="kind">구분</Label><select id="kind" name="kind" value={kind} onChange={e=>{const k=e.target.value as 'income'|'expense';setKind(k);setCategory(k==='income'?'penalty':'food');setLabel('');}} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"><option value="expense">지출</option><option value="income">수입</option></select></div>
      <div className="min-w-0 space-y-1"><Label htmlFor="category">분류</Label><select id="category" name="category" value={category} onChange={e=>setCategory(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
        {kind==='income'?<option value="penalty">벌금</option>:<><option value="food">식비</option><option value="coffee">커피</option></>}
        <option value="other">기타</option>
        {available.map(c=><option key={c.id} value={'custom:'+c.id}>{c.label}</option>)}
        <option value="add">＋ 분류 추가</option>
      </select></div>
      <div className="min-w-0 space-y-1"><Label htmlFor="edate">날짜</Label><Input id="edate" name="date" type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)} required /></div>
      <div className="min-w-0 space-y-1"><Label htmlFor="amount">금액 (원)</Label><Input id="amount" name="amount" type="text" inputMode="numeric" required placeholder="예: 30,000" /></div>
    </div>
    {category==='add'&&<div className="space-y-2 rounded-xl bg-muted/40 p-3"><Label htmlFor="new-category">추가할 {kind==='income'?'수입':'지출'} 분류</Label><div className="flex gap-2"><Input id="new-category" value={label} onChange={e=>setLabel(e.target.value)} maxLength={30} placeholder={kind==='income'?'예: 정기회비, 찬조금':'예: 스크린 이용료, 교통비'} /><Button type="button" disabled={adding} onClick={addCategory}>{adding?'저장 중…':'추가'}</Button></div><p className="text-xs text-muted-foreground">추가한 분류는 다음에도 선택할 수 있어요.</p></div>}
    {kind==='income'&&category==='penalty'&&<p className="text-xs text-muted-foreground">게임 벌금은 위 ‘납부 확인’으로 기록하세요. 여기서 별도로 입력한 벌금은 게임의 미납 상태를 바꾸지 않으니 중복 기록에 주의해 주세요.</p>}
    <div className="min-w-0 space-y-1"><Label htmlFor="emo">메모</Label><Input id="emo" name="memo" maxLength={300} /></div>
    {feedback&&<p role={feedback.kind==='error'?'alert':'status'} className={`rounded-lg p-3 text-sm ${feedback.kind==='error'?'bg-destructive/10 text-destructive':feedback.kind==='success'?'bg-success/10 text-success':'bg-secondary text-foreground'}`}>{feedback.text}</p>}
    <Button type="submit" disabled={busy||adding} className="w-full">{busy?'서버에 저장 중…':'회비 저장하기'}</Button>
  </form>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { errMsg, useClubData, useRefresh, type Game, type Me, type Member, type Score } from "@/lib/club";
import { formatDateKo, formatOver, penaltyFor, todayKST, won } from "@/lib/golf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/games")({
  head: () => ({ meta: [{ title: "게임 · 버디장부" }, { name: "description", content: "게임별 점수와 벌금" }, { property: "og:title", content: "게임 · 버디장부" }, { property: "og:description", content: "게임별 점수와 벌금" }] }),
  component: () => <AppShell>{(me) => <GamesView me={me} />}</AppShell>,
});

function parseOver(v: string): number | null {
  const n = Number(v.replace(/^\+/, "").trim());
  return Number.isInteger(n) && n >= -30 && n <= 200 ? n : null;
}

function GamesView({ me }: { me: Me }) {
  const q = useClubData(true);
  const [creating, setCreating] = useState(false);
  if (q.isLoading) return <StateBox>불러오는 중…</StateBox>;
  if (q.error) return <StateBox>게임을 불러오지 못했어요. <Button variant="link" onClick={() => q.refetch()}>다시 시도</Button></StateBox>;
  const { games, scores, members } = q.data!;
  const active = members.filter((m) => m.status === "approved");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">게임</h1>
        {me.isAdmin && <Button onClick={() => setCreating((v) => !v)}><Plus className="h-4 w-4" />새 게임</Button>}
      </div>
      {creating && <NewGameForm members={active} onDone={() => setCreating(false)} />}
      {games.length === 0 ? <StateBox>아직 게임이 없어요.{me.isAdmin && " 새 게임을 등록해 보세요."}</StateBox> :
        games.map((g) => <GameCard key={g.id} game={g} scores={scores.filter((s) => s.game_id === g.id)} members={members} me={me} />)}
    </div>
  );
}

function NewGameForm({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const refresh = useRefresh();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const venue = String(f.get("venue")).trim();
    const date = String(f.get("date"));
    if (!venue || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return void toast.error("날짜와 장소를 입력해 주세요");
    const rows: { user_id: string; over_par: number }[] = [];
    for (const [uid, v] of Object.entries(vals)) {
      if (!v.trim()) continue;
      const n = parseOver(v);
      if (n == null) return void toast.error("점수는 정수로 입력해 주세요 (예: 23)");
      rows.push({ user_id: uid, over_par: n });
    }
    setBusy(true);
    const { data: g, error } = await supabase.from("games").insert({ played_on: date, venue, memo: String(f.get("memo") || "").trim() || null }).select("id").single();
    if (!error && rows.length) {
      const r = await supabase.from("game_scores").insert(rows.map((r) => ({ ...r, game_id: g.id })));
      if (r.error) toast.error(errMsg(r.error));
    }
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("게임을 등록했어요");
    refresh(); onDone();
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="date">날짜</Label><Input id="date" name="date" type="date" defaultValue={todayKST()} required /></div>
        <div className="space-y-1"><Label htmlFor="venue">장소/코스</Label><Input id="venue" name="venue" maxLength={80} required placeholder="골프존 강남 · 남서울CC" /></div>
      </div>
      <div className="space-y-1"><Label htmlFor="memo">메모 (선택)</Label><Input id="memo" name="memo" maxLength={300} /></div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">참가자 오버파 (비우면 불참)</legend>
        <div className="grid grid-cols-2 gap-2">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
              <span className="flex-1 truncate">{m.name}</span>
              <Input aria-label={`${m.name} 오버파`} inputMode="numeric" className="h-8 w-16" placeholder="+0" value={vals[m.id] ?? ""} onChange={(e) => setVals({ ...vals, [m.id]: e.target.value })} />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onDone}>취소</Button><Button disabled={busy}>{busy ? "저장 중…" : "등록"}</Button></div>
    </form>
  );
}

function GameCard({ game, scores, members, me }: { game: Game; scores: Score[]; members: Member[]; me: Me }) {
  const refresh = useRefresh();
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? "알 수 없음";
  const mine = scores.find((s) => s.user_id === me.id);
  const [addUser, setAddUser] = useState("");
  const [addVal, setAddVal] = useState("");
  const sorted = [...scores].sort((a, b) => a.over_par - b.over_par);
  const others = members.filter((m) => m.status === "approved" && !scores.some((s) => s.user_id === m.id));

  async function addScore(uid: string, v: string) {
    const n = parseOver(v);
    if (n == null) return void toast.error("점수는 정수로 입력해 주세요");
    const { error } = await supabase.from("game_scores").insert({ game_id: game.id, user_id: uid, over_par: n });
    if (error) return void toast.error(errMsg(error));
    toast.success("점수를 저장했어요"); setAddVal(""); setAddUser(""); refresh();
  }
  async function deleteGame() {
    if (scores.length) return void toast.error("점수가 있는 게임은 점수를 먼저 삭제해 주세요");
    if (!confirm("이 게임을 삭제할까요?")) return;
    const { error } = await supabase.from("games").delete().eq("id", game.id);
    if (error) return void toast.error(errMsg(error));
    refresh();
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <header className="flex items-start justify-between">
        <div><h2 className="font-display text-lg font-bold">{game.venue}</h2><p className="text-xs text-muted-foreground">{formatDateKo(game.played_on)}{game.memo && ` · ${game.memo}`}</p></div>
        {me.isAdmin && <Button variant="ghost" size="icon" onClick={deleteGame} aria-label="게임 삭제"><Trash2 className="h-4 w-4" /></Button>}
      </header>
      {sorted.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">아직 점수가 없어요.</p> : (
        <ul className="mt-3 divide-y divide-border">
          {sorted.map((s) => <ScoreRow key={s.id} s={s} name={name(s.user_id)} editable={me.isAdmin || (s.user_id === me.id && !s.payment_entry_id)} isAdmin={me.isAdmin} mine={s.user_id === me.id} />)}
        </ul>
      )}
      {!mine && (
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addScore(me.id, addVal); }}>
          <Input aria-label="내 오버파" inputMode="numeric" placeholder="내 점수 (예: 23)" value={addVal} onChange={(e) => setAddVal(e.target.value)} />
          <Button type="submit" variant="secondary">내 점수 입력</Button>
        </form>
      )}
      {me.isAdmin && others.length > 0 && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (addUser) addScore(addUser, addVal); }}>
          <select aria-label="회원 선택" className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={addUser} onChange={(e) => setAddUser(e.target.value)}>
            <option value="">회원 추가…</option>
            {others.filter((m) => m.id !== me.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <Input aria-label="오버파" inputMode="numeric" className="w-20" placeholder="+0" value={addVal} onChange={(e) => setAddVal(e.target.value)} />
          <Button type="submit" variant="outline">추가</Button>
        </form>
      )}
    </article>
  );
}

function ScoreRow({ s, name, editable, isAdmin, mine }: { s: Score; name: string; editable: boolean; isAdmin: boolean; mine: boolean }) {
  const refresh = useRefresh();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(s.over_par));
  async function save() {
    const n = parseOver(v);
    if (n == null) return void toast.error("점수는 정수로 입력해 주세요");
    if (s.payment_entry_id && penaltyFor(n) !== s.penalty && !confirm("이미 납부된 점수예요. 수정하면 회비 화면에서 정산이 필요해요. 계속할까요?")) return;
    const { error } = await supabase.from("game_scores").update({ over_par: n }).eq("id", s.id);
    if (error) return void toast.error(errMsg(error));
    setEdit(false); refresh();
  }
  async function del() {
    if (!confirm(`${name}님의 점수를 삭제할까요?`)) return;
    const { error } = await supabase.from("game_scores").delete().eq("id", s.id);
    if (error) return void toast.error(errMsg(error));
    refresh();
  }
  return (
    <li className="flex items-center gap-2 py-2">
      <span className={`flex-1 text-sm ${mine ? "font-bold text-primary" : ""}`}>{name}</span>
      {edit ? (
        <>
          <Input aria-label={`${name} 오버파 수정`} autoFocus inputMode="numeric" className="h-8 w-20" value={v} onChange={(e) => setV(e.target.value)} />
          <Button size="sm" onClick={save}>저장</Button>
          <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>취소</Button>
        </>
      ) : (
        <>
          <span className="w-12 text-right font-semibold">{formatOver(s.over_par)}</span>
          <span className="w-16 text-right text-xs text-muted-foreground">{won(s.penalty)}</span>
          {s.penalty > 0 && (s.payment_entry_id ? <Badge variant="secondary">납부</Badge> : <Badge variant="outline">미납</Badge>)}
          {editable && <Button size="sm" variant="ghost" onClick={() => { setV(String(s.over_par)); setEdit(true); }}>수정</Button>}
          {isAdmin && !s.payment_entry_id && <Button size="icon" variant="ghost" onClick={del} aria-label={`${name} 점수 삭제`}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </>
      )}
    </li>
  );
}


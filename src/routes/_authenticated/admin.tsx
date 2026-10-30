import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, StateBox } from "@/components/AppShell";
import { errMsg, useClubData, useRefresh } from "@/lib/club";
import { auditLabel,auditTime } from "@/lib/audit-label";
import { formatPhone } from "@/lib/golf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "관리 · 버디장부" }, { name: "description", content: "총무 전용 회원 승인과 백업" }, { property: "og:title", content: "관리 · 버디장부" }, { property: "og:description", content: "총무 관리" }] }),
  component: () => <AppShell adminOnly>{() => <AdminView />}</AppShell>,
});

const STATUS: Record<string, string> = { pending: "승인 대기", approved: "승인", rejected: "거절", revoked: "해제" };

function AdminView() {
  const members = useQuery({
    queryKey: ["admin-members"],
    queryFn: async () => { const { data, error } = await supabase.rpc("admin_list_members"); if (error) throw error; return data; },
  });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: async () => { const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50); if (error) throw error; return data; },
  });
  const refresh = useRefresh();

  async function setStatus(id: string, status: "approved" | "rejected" | "revoked") {
    const { error } = await supabase.rpc("admin_set_member_status", { _user_id: id, _status: status });
    if (error) return void toast.error(errMsg(error));
    toast.success("변경했어요"); members.refetch(); audit.refetch(); refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">관리</h1>
      <section>
        <h2 className="mb-2 text-lg font-bold">회원 승인</h2>
        {members.isLoading ? <StateBox>불러오는 중…</StateBox> : members.error ? <StateBox>회원 목록을 불러오지 못했어요.</StateBox> : !members.data?.length ? <StateBox>회원이 없어요.</StateBox> : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {[...members.data].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")).map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{m.name} {m.is_admin && <Badge>총무</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{m.phone ? formatPhone(m.phone) : "admin"} · {new Date(m.created_at).toLocaleDateString("ko-KR")}</p>
                </div>
                <Badge variant={m.status === "pending" ? "default" : "outline"}>{STATUS[m.status]}</Badge>
                {!m.is_admin && <div className="flex gap-1">
                  {m.status !== "approved" && <Button size="sm" onClick={() => setStatus(m.id, "approved")}>승인</Button>}
                  {m.status === "pending" && <Button size="sm" variant="outline" onClick={() => setStatus(m.id, "rejected")}>거절</Button>}
                  {m.status === "approved" && <Button size="sm" variant="outline" onClick={() => confirm(`${m.name}님의 권한을 해제할까요?`) && setStatus(m.id, "revoked")}>권한 해제</Button>}
                </div>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Backup />
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">변경 기록 (최근 50건)</h2><Button variant="ghost" size="sm" onClick={()=>audit.refetch()}>새로고침</Button></div>
        {audit.isLoading ? <StateBox>불러오는 중…</StateBox> : audit.error ? <StateBox>변경 기록을 불러오지 못했어요. 새로고침을 눌러 주세요.</StateBox> : !audit.data?.length ? <StateBox>기록이 없어요.</StateBox> : (
          <ul className="max-h-96 overflow-y-auto rounded-2xl border border-border bg-card">
            {audit.data.map((a)=>{
              const name=(id:string)=>members.data?.find(m=>m.id===id)?.name||'이전 회원';
              const label=auditLabel(a,name);
              return <li key={a.id} className="min-w-0 space-y-1 border-b border-border p-3 last:border-b-0">
                <p className="break-words text-sm font-semibold">{label.title}</p>
                {label.detail&&<p className="break-words text-sm text-muted-foreground">{label.detail}</p>}
                <p className="break-words text-xs text-muted-foreground">{auditTime(a.created_at)} · 처리: {a.actor?name(a.actor):'시스템'}</p>
              </li>;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const importSchema = z.object({
  games: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    venue: z.string().trim().min(1).max(80),
    memo: z.string().max(300).nullish(),
    scores: z.array(z.object({ name: z.string().trim().min(1).max(30), overPar: z.number().int().min(-30).max(200) })).max(50),
  })).max(2000).default([]),
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(["income", "expense"]),
    category: z.enum(["food", "coffee", "other"]),
    amount: z.number().int().positive().max(100000000),
    memo: z.string().max(300).nullish(),
    voided: z.boolean().optional(),
  })).max(5000).default([]),
});

function Backup() {
  const q = useClubData(true);
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);

  function exportJson() {
    if (!q.data) return;
    const { games, scores, members, entries } = q.data;
    const name = (id: string) => members.find((m) => m.id === id)?.name ?? "";
    const out = {
      format: "birdiejangbu", version: 1, exportedAt: new Date().toISOString(),
      members: members.map((m) => ({ id: m.id, name: m.name, status: m.status })),
      games: games.map((g) => ({ id: g.id, date: g.played_on, venue: g.venue, memo: g.memo,
        scores: scores.filter((s) => s.game_id === g.id).map((s) => ({ name: name(s.user_id), userId: s.user_id, overPar: s.over_par, penalty: s.penalty, paymentEntryId: s.payment_entry_id })) })),
      entries: entries.map((e) => ({ id: e.id, date: e.entry_date, kind: e.kind, category: e.category, customCategory: e.custom_category, amount: e.amount, memo: e.memo, scoreId: e.score_id, voided: !!e.voided_at, voidReason: e.void_reason })),
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `birdiejangbu-backup-${out.exportedAt.slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    if (!q.data) return;
    if (file.size > 5_000_000) return void toast.error("파일이 너무 커요 (5MB 이하)");
    let parsed;
    try { parsed = importSchema.parse(JSON.parse(await file.text())); }
    catch { return void toast.error("파일 형식이 올바르지 않아요"); }
    const byName = new Map(q.data.members.filter((m) => m.status === "approved").map((m) => [m.name, m.id]));
    const existing = new Set(q.data.games.map((g) => `${g.played_on}|${g.venue}`));
    const unknown = new Set<string>();
    for (const g of parsed.games) for (const s of g.scores) if (!byName.has(s.name)) unknown.add(s.name);
    const penaltyIncome = parsed.entries.length;
    if (!confirm(`게임 ${parsed.games.length}건, 장부 ${penaltyIncome}건을 가져올까요?\n같은 날짜·장소의 게임은 건너뜁니다.${unknown.size ? `\n승인된 회원에 없는 이름의 점수는 제외: ${[...unknown].join(", ")}` : ""}\n벌금 납부 내역은 가져오지 않으니 납부 확인을 다시 해주세요.`)) return;
    setBusy(true);
    let gCount = 0, eCount = 0;
    try {
      for (const g of parsed.games) {
        if (existing.has(`${g.date}|${g.venue}`)) continue;
        const { data, error } = await supabase.from("games").insert({ played_on: g.date, venue: g.venue, memo: g.memo ?? null }).select("id").single();
        if (error) throw error;
        const rows = g.scores.filter((s) => byName.has(s.name)).map((s) => ({ game_id: data.id, user_id: byName.get(s.name)!, over_par: s.overPar }));
        if (rows.length) { const r = await supabase.from("game_scores").insert(rows); if (r.error) throw r.error; }
        gCount++;
      }
      for (const e of parsed.entries) {
        if (e.voided) continue;
        const { error } = await supabase.rpc("admin_add_entry", { _kind: e.kind, _category: e.category, _amount: e.amount, _date: e.date, _memo: e.memo ?? "" });
        if (error) throw error;
        eCount++;
      }
      toast.success(`게임 ${gCount}건, 장부 ${eCount}건을 가져왔어요`);
    } catch (err) {
      toast.error(`가져오기 중 오류 (게임 ${gCount}, 장부 ${eCount}건 완료): ${errMsg(err)}`);
    } finally { setBusy(false); refresh(); }
  }

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold">백업</h2>
      <p className="text-xs text-muted-foreground">백업 파일에는 비밀번호·휴대폰 번호가 포함되지 않아요.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportJson} disabled={!q.data}>JSON 내보내기</Button>
        <p className="text-xs text-muted-foreground">가져오기는 중복 입금을 방지하기 위해 준비 중입니다.</p>
      </div>
    </section>
  );
}


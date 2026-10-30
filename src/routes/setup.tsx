import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { bootstrapOwnerAdmin, getSetupState } from "@/lib/admin-setup.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/setup")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "총무 계정 설정 · 버디장부" },
      { name: "description", content: "프로젝트 소유자 전용 1회성 총무 계정 설정" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "총무 계정 설정 · 버디장부" },
      { property: "og:description", content: "소유자 전용 설정" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const getState = getSetupState;
  const boot = bootstrapOwnerAdmin;
  const state = useQuery({ queryKey: ["setup"], queryFn: () => getState() });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password !== String(f.get("confirm"))) return void toast.error("비밀번호가 서로 달라요");
    setBusy(true);
    try {
      await boot({ data: { token: String(f.get("token")), password } });
      setDone(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h1 className="font-display text-2xl font-bold text-primary">총무 계정 설정</h1>
        {state.isLoading ? <p className="mt-4 text-sm text-muted-foreground">확인 중…</p>
        : state.error ? <p className="mt-4 text-sm text-destructive">상태를 확인하지 못했어요.</p>
        : done || state.data?.adminExists ? (
          <div className="mt-4 space-y-4 text-sm">
            <p>총무 계정이 설정되어 있어요. 아이디 <b>admin</b>과 설정한 비밀번호로 로그인하세요.</p>
            <Button asChild className="w-full"><Link to="/auth">로그인하러 가기</Link></Button>
          </div>
        ) : !state.data?.tokenConfigured ? (
          <p className="mt-4 text-sm text-muted-foreground">Supabase 프로젝트의 Edge Functions → Secrets에 <b>ADMIN_SETUP_TOKEN</b>을 먼저 등록해 주세요.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">소유자 정동성 님 전용 1회성 설정입니다. 완료 후에는 이 화면이 영구히 잠깁니다.</p>
            <div className="space-y-1.5"><Label htmlFor="token">설정 토큰</Label><Input id="token" name="token" type="password" required autoComplete="off" /></div>
            <div className="space-y-1.5"><Label htmlFor="password">총무 비밀번호 (10자 이상)</Label><Input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /></div>
            <div className="space-y-1.5"><Label htmlFor="confirm">비밀번호 확인</Label><Input id="confirm" name="confirm" type="password" required autoComplete="new-password" /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "설정 중…" : "총무 계정 만들기"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}


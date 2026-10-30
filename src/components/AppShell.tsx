import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Flag, LineChart, Wallet, ShieldCheck, LogOut, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type Me } from "@/lib/club";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/home", label: "홈", icon: Home },
  { to: "/games", label: "게임", icon: Flag },
  { to: "/records", label: "기록", icon: LineChart },
  { to: "/dues", label: "회비", icon: Wallet },
] as const;

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function AppShell({ children, adminOnly }: { children: (me: Me) => ReactNode; adminOnly?: boolean }) {
  const me = useMe();
  const signOut = useSignOut();

  if (me.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="불러오는 중" /></Center>;
  if (me.error || !me.data) {
    return <Center><p className="text-muted-foreground">회원 정보를 불러오지 못했어요.</p><Button className="mt-4" onClick={signOut}>다시 로그인</Button></Center>;
  }
  const m = me.data;
  if (!m.isAdmin && m.status !== "approved") return <PendingScreen me={m} onSignOut={signOut} />;
  if (adminOnly && !m.isAdmin) return <Center><p>총무만 볼 수 있는 화면이에요.</p></Center>;

  const nav = m.isAdmin ? [...NAV, { to: "/admin", label: "관리", icon: ShieldCheck } as const] : NAV;
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/home" className="font-display text-xl font-bold text-primary">버디장부</Link>
          <nav className="hidden gap-1 md:flex" aria-label="주요 메뉴">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary" activeProps={{ className: "bg-secondary text-primary font-semibold" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{m.name}{m.isAdmin && " · 총무"}</span>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="로그아웃"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children(m)}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="하단 메뉴">
        <div className="mx-auto flex max-w-3xl">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary font-semibold" }}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center">{children}</div>;
}

function PendingScreen({ me, onSignOut }: { me: Me; onSignOut: () => void }) {
  const msg = {
    pending: { t: "가입 승인을 기다리고 있어요", d: "총무가 본인 확인 후 승인하면 장부와 기록을 볼 수 있어요. 승인 후 다시 로그인하거나 새로고침해 주세요." },
    rejected: { t: "가입이 승인되지 않았어요", d: "총무에게 문의해 주세요." },
    revoked: { t: "회원 권한이 해제되었어요", d: "다시 이용하려면 총무에게 문의해 주세요." },
    approved: { t: "", d: "" },
  }[me.status];
  return (
    <Center>
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-soft">
        <p className="font-display text-2xl text-primary">버디장부</p>
        <h1 className="mt-4 text-xl font-bold">{msg.t}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{me.name}님, {msg.d}</p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => location.reload()}>새로고침</Button>
          <Button className="flex-1" onClick={onSignOut}>로그아웃</Button>
        </div>
      </div>
    </Center>
  );
}

export function StateBox({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">{children}</div>;
}


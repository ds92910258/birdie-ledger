import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "버디장부 · 스크린골프 모임 장부" },
      { name: "description", content: "게임 점수, 벌금, 회비를 모임원 모두가 함께 보는 스크린골프 장부" },
      { property: "og:title", content: "버디장부 · 스크린골프 모임 장부" },
      { property: "og:description", content: "게임 점수, 벌금, 회비를 함께 보는 장부" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-hero text-primary-foreground">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between px-6 py-12">
        <div>
          <p className="text-sm tracking-[0.3em] opacity-70">SCREEN GOLF CLUB</p>
          <h1 className="mt-6 font-display text-5xl font-bold leading-tight">버디장부</h1>
          <p className="mt-4 text-lg opacity-85">오늘 몇 개 오버했나요?<br />점수와 벌금, 회비를 한 장부에.</p>
        </div>
        <div className="mt-16 space-y-4 rounded-3xl bg-card p-6 text-card-foreground shadow-soft">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>· 9오버까지 0원, 10오버마다 1만원</li>
            <li>· 실제 입금된 돈만 잔액에 반영</li>
            <li>· 총무가 직접 확인 후 가입 승인</li>
          </ul>
          <Button asChild size="lg" className="w-full"><Link to="/auth">로그인 / 가입하기</Link></Button>
        </div>
      </div>
    </div>
  );
}


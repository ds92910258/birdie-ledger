import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loginIdToEmail, normalizePhone, PHONE_EMAIL_DOMAIN } from "@/lib/golf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 · 버디장부" },
      { name: "description", content: "휴대폰 번호와 비밀번호로 버디장부에 로그인하거나 가입 신청하세요." },
      { property: "og:title", content: "로그인 · 버디장부" },
      { property: "og:description", content: "버디장부 로그인과 가입 신청" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "실명을 2자 이상 입력해 주세요").max(30, "이름이 너무 길어요").regex(/^[가-힣a-zA-Z ]+$/, "이름은 한글 또는 영문만 입력해 주세요"),
  phone: z.string().refine((v) => !!normalizePhone(v), "010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 해요").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "비밀번호가 서로 달라요", path: ["confirm"] });

function koAuthError(m: string): string {
  if (/invalid login credentials/i.test(m)) return "휴대폰 번호 또는 비밀번호가 올바르지 않아요.";
  if (/already registered|already been registered|duplicate/i.test(m)) return "이미 가입된 휴대폰 번호예요. 로그인해 주세요.";
  if (/pwned|leaked|weak/i.test(m)) return "유출된 적 있는 비밀번호예요. 다른 비밀번호를 사용해 주세요.";
  if (/rate limit|too many/i.test(m)) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  if (/Database error/i.test(m)) return "가입 정보를 확인해 주세요. 이미 가입된 번호일 수 있어요.";
  return "문제가 생겼어요. 잠시 후 다시 시도해 주세요.";
}

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = loginIdToEmail(String(f.get("id") ?? ""));
    const password = String(f.get("password") ?? "");
    if (!email) return setErrors({ id: "휴대폰 번호를 정확히 입력해 주세요" });
    if (!password) return setErrors({ lpw: "비밀번호를 입력해 주세요" });
    setErrors({}); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return void toast.error(koAuthError(error.message));
    navigate({ to: "/home" });
  }

  async function onSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const r = signupSchema.safeParse(f);
    if (!r.success) {
      const errs: Record<string, string> = {};
      for (const i of r.error.issues) errs[String(i.path[0])] ??= i.message;
      return setErrors(errs);
    }
    setErrors({}); setBusy(true);
    const phone = normalizePhone(r.data.phone)!;
    const { data, error } = await supabase.auth.signUp({
      email: `${phone}@${PHONE_EMAIL_DOMAIN}`,
      password: r.data.password,
      options: { data: { name: r.data.name, phone } },
    });
    setBusy(false);
    if (error) return void toast.error(koAuthError(error.message));
    if (data.session) {
      toast.success("가입 신청이 완료됐어요. 총무 승인을 기다려 주세요.");
      navigate({ to: "/home" });
    } else {
      toast.success("가입 신청이 완료됐어요. 로그인해 주세요.");
    }
  }

  const err = (k: string) => errors[k] && <p id={`${k}-err`} className="text-xs text-destructive">{errors[k]}</p>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-soft">
        <h1 className="text-center font-display text-3xl font-bold text-primary">버디장부</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">스크린골프 모임 장부</p>
        <Tabs defaultValue="login" className="mt-6" onValueChange={() => setErrors({})}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="signup">가입 신청</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form onSubmit={onLogin} className="mt-4 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="id">휴대폰 번호</Label>
                <Input id="id" name="id" inputMode="tel" autoComplete="username" placeholder="010-1234-5678" aria-invalid={!!errors["id"]} />
                {err("id")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lpw">비밀번호</Label>
                <Input id="lpw" name="password" type="password" autoComplete="current-password" aria-invalid={!!errors["lpw"]} />
                {err("lpw")}
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "확인 중…" : "로그인"}</Button>
              <p className="text-center text-xs text-muted-foreground">비밀번호를 잊으셨다면 총무에게 문의해 주세요.</p>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={onSignup} className="mt-4 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="name">실명</Label>
                <Input id="name" name="name" autoComplete="name" placeholder="홍길동" aria-invalid={!!errors["name"]} />
                {err("name")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">휴대폰 번호</Label>
                <Input id="phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="010-1234-5678" aria-invalid={!!errors["phone"]} />
                {err("phone")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">비밀번호 (8자 이상)</Label>
                <Input id="password" name="password" type="password" autoComplete="new-password" aria-invalid={!!errors["password"]} />
                {err("password")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">비밀번호 확인</Label>
                <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors["confirm"]} />
                {err("confirm")}
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? "신청 중…" : "가입 신청"}</Button>
              <p className="text-center text-xs text-muted-foreground">문자 인증 없이 총무가 직접 본인 확인 후 승인해요.</p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


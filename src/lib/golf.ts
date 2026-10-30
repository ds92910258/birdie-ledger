// Pure club rules — keep in sync with the database (game_scores.penalty column).
export const PHONE_EMAIL_DOMAIN = "phone.birdiejangbu.app";
export const ADMIN_EMAIL = "owner@admin.birdiejangbu.app";
export const ADMIN_LOGIN_ID = "admin";

export function normalizePhone(input: string): string | null {
  let d = input.replace(/[^0-9+]/g, "");
  if (d.startsWith("+82")) d = "0" + d.slice(3);
  d = d.replace(/\D/g, "");
  return /^010\d{8}$/.test(d) ? d : null;
}

export function formatPhone(p: string) {
  return p.length === 11 ? `${p.slice(0, 3)}-${p.slice(3, 7)}-${p.slice(7)}` : p;
}

/** Maps a login identifier (phone or "admin") to the internal auth address. */
export function loginIdToEmail(id: string): string | null {
  const t = id.trim().toLowerCase();
  if (t === ADMIN_LOGIN_ID) return ADMIN_EMAIL;
  const p = normalizePhone(t);
  return p ? `${p}@${PHONE_EMAIL_DOMAIN}` : null;
}

export function penaltyFor(overPar: number): number {
  return Math.max(0, Math.floor(overPar / 10)) * 10000;
}

export function formatOver(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function won(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function todayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function formatDateKo(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y!, m! - 1, day!)).getUTCDay()];
  return `${y}년 ${m}월 ${day}일 (${wd})`;
}

export type LedgerRow = { kind: "income" | "expense"; amount: number; voided_at: string | null };
export type ScoreRow = { penalty: number; payment_entry_id: string | null };

/** Balance = only real money: non-voided income minus non-voided expenses. Charges never count. */
export function computeBalance(entries: LedgerRow[]) {
  let income = 0, expense = 0;
  for (const e of entries) {
    if (e.voided_at) continue;
    if (e.kind === "income") income += e.amount; else expense += e.amount;
  }
  return { income, expense, balance: income - expense };
}

/** Outstanding charges: penalties of scores that have no payment yet. */
export function computeUnpaid(scores: ScoreRow[]) {
  return scores.filter((s) => !s.payment_entry_id && s.penalty > 0).reduce((a, s) => a + s.penalty, 0);
}

export function scoreStats(values: number[]) {
  if (!values.length) return { count: 0, avg: null as number | null, best: null as number | null };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, avg: Math.round((sum / values.length) * 10) / 10, best: Math.min(...values) };
}

export const CATEGORY_LABEL: Record<string, string> = { penalty: "벌금", food: "식비", coffee: "커피", other: "기타" };


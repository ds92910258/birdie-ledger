import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = { id: string; name: string; status: "pending" | "approved" | "rejected" | "revoked"; isAdmin: boolean };

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: p, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,name,status").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      if (error) throw error;
      if (!p) return null;
      return { id: p.id, name: p.name, status: p.status, isAdmin: !!roles?.some((r) => r.role === "admin") };
    },
  });
}

export type Game = { id: string; played_on: string; venue: string; memo: string | null };
export type Score = { id: string; game_id: string; user_id: string; over_par: number; penalty: number; payment_entry_id: string | null };
export type Member = { id: string; name: string; status: string };
export type Entry = {
  id: string; kind: "income" | "expense"; category: "penalty" | "food" | "coffee" | "other"; amount: number;
  entry_date: string; memo: string | null; score_id: string | null; voided_at: string | null; void_reason: string | null; created_at: string;
};

export function useClubData(enabled: boolean) {
  return useQuery({
    queryKey: ["club"],
    enabled,
    queryFn: async () => {
      const [g, s, m, e] = await Promise.all([
        supabase.from("games").select("id,played_on,venue,memo").order("played_on", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("game_scores").select("id,game_id,user_id,over_par,penalty,payment_entry_id").limit(5000),
        supabase.from("profiles").select("id,name,status").order("name"),
        supabase.from("ledger_entries").select("id,kind,category,amount,entry_date,memo,score_id,voided_at,void_reason,created_at").order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(5000),
      ]);
      for (const r of [g, s, m, e]) if (r.error) throw r.error;
      return { games: (g.data ?? []) as Game[], scores: (s.data ?? []) as Score[], members: (m.data ?? []) as Member[], entries: (e.data ?? []) as Entry[] };
    },
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["club"] });
}

export function errMsg(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (m.includes("row-level security") || m.includes("permission denied")) return "권한이 없습니다.";
  if (m.includes("duplicate key") && m.includes("game_scores")) return "이미 이 게임에 점수가 있습니다.";
  return m;
}


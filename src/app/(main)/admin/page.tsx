"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/posts";
import { MAX_STARS, fmtStars, starsError } from "@/lib/stars";

type Found = {
  name: string;
  profile: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
  balance: number;
};
type LogRow = {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
  target: { username: string } | null;
  counterparty: { username: string } | null;
};

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [mode, setMode] = useState<"grant" | "revoke">("grant");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    supabase.rpc("is_admin").then(({ data }) => setAllowed(data === true));
  }, []);

  const name = username.trim();

  useEffect(() => {
    if (!allowed || name.length < 4) return;
    const t = setTimeout(async () => {
      const { data: p } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("username", name)
        .maybeSingle();
      let balance = 0;
      if (p) {
        const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", p.id).maybeSingle();
        balance = w?.balance ?? 0;
      }
      setFound({ name, profile: p, balance });
    }, 300);
    return () => clearTimeout(t);
  }, [name, allowed, tick]);

  const loadLog = useCallback(async () => {
    const { data } = await supabase
      .from("star_transactions")
      .select(
        "id, amount, note, created_at, target:profiles!user_id(username), counterparty:profiles!counterparty_id(username)"
      )
      .in("kind", ["grant", "revoke"])
      .order("created_at", { ascending: false })
      .limit(20);
    setLog((data ?? []) as unknown as LogRow[]);
  }, []);

  useEffect(() => {
    if (allowed) loadLog();
  }, [allowed, loadLog]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1 || n > MAX_STARS) {
      setError("Введите сумму: целое число от 1");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_adjust_stars", {
      p_username: name,
      p_delta: mode === "grant" ? n : -n,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    setOk(`Готово. Баланс @${name}: ${fmtStars(Number(data))} ★`);
    setAmount("");
    setNote("");
    setTick((x) => x + 1);
    loadLog();
  }

  if (allowed === null) return <p className="py-16 text-center text-muted">Загрузка...</p>;
  if (!allowed) return <p className="py-16 text-center text-muted">Нет доступа.</p>;

  const target = found?.name === name ? found : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/account"
          aria-label="Назад"
          className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Админка</h1>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Звёзды пользователю</h2>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input
            className="input pl-9"
            placeholder="Юзернейм"
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[\s@]/g, ""))}
            required
          />
        </div>

        {target &&
          (target.profile ? (
            <div className="flex items-center gap-3 rounded-xl bg-brand-soft p-2.5">
              <Avatar url={target.profile.avatar_url} name={target.profile.display_name || target.profile.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{target.profile.display_name || target.profile.username}</p>
                <p className="text-xs text-muted">Баланс: {fmtStars(target.balance)} ★</p>
              </div>
            </div>
          ) : (
            <p className="px-1 text-xs text-red-500">Пользователь не найден</p>
          ))}

        <div className="grid grid-cols-2 gap-2">
          {(["grant", "revoke"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={mode === m ? "btn-primary !py-2 text-sm" : "btn-ghost"}
            >
              {m === "grant" ? "Выдать" : "Списать"}
            </button>
          ))}
        </div>
        <input
          className="input"
          inputMode="numeric"
          placeholder="Сколько звёзд"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 10))}
          required
        />
        <input
          className="input"
          placeholder="Комментарий (необязательно)"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        {ok && <p className="text-sm text-green-600">{ok}</p>}
        <button disabled={busy || !name || !amount} className="btn-primary w-full py-3">
          {busy ? "Применяем..." : mode === "grant" ? "Выдать звёзды" : "Списать звёзды"}
        </button>
      </form>

      <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Последние операции</h2>
      {log.length === 0 ? (
        <p className="py-6 text-center text-muted">Операций пока нет.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {log.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-[15px]">
                  @{r.target?.username ?? "?"} <span className="text-muted">· админ @{r.counterparty?.username ?? "?"}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {timeAgo(r.created_at)}
                  {r.note && ` · ${r.note}`}
                </p>
              </div>
              <b className={r.amount > 0 ? "text-green-600" : "text-ink"}>
                {r.amount > 0 ? "+" : "−"}
                {fmtStars(Math.abs(r.amount))} ★
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
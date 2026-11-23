"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import { timeAgo } from "@/lib/posts";
import { MAX_STARS, StarTx, TX_SELECT, fmtStars, starsError, txTitle } from "@/lib/stars";

export default function WalletPage() {
  const { me } = useMe();
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<StarTx[]>([]);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    const [w, h] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", me.id).maybeSingle(),
      supabase
        .from("star_transactions")
        .select(TX_SELECT)
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    setBalance(w.data?.balance ?? 0);
    setHistory((h.data ?? []) as unknown as StarTx[]);
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 1 || n > MAX_STARS) {
      setError("Введите сумму: целое число от 1");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("transfer_stars", {
      p_username: to,
      p_amount: n,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    setOk(`Отправлено ${fmtStars(n)} ★ пользователю @${to}`);
    setTo("");
    setAmount("");
    setNote("");
    load();
  }

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
        <h1 className="text-xl font-bold">Кошелёк</h1>
      </div>

      <section className="rounded-xl border border-line bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">FabricStars</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-4xl font-bold">
          <Star size={30} className="fill-amber-400 text-amber-400" />
          {balance === null ? "…" : fmtStars(balance)}
        </p>
      </section>

      <form onSubmit={send} className="space-y-3 rounded-xl border border-line bg-white p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Перевод</h2>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
          <input
            className="input pl-9"
            placeholder="Юзернейм получателя"
            maxLength={20}
            value={to}
            onChange={(e) => setTo(e.target.value.toLowerCase().replace(/[\s@]/g, ""))}
            required
          />
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
        <button disabled={busy || !to || !amount} className="btn-primary w-full py-3">
          {busy ? "Отправляем..." : "Отправить"}
        </button>
      </form>

      <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">История</h2>
      {history.length === 0 ? (
        <p className="py-6 text-center text-muted">Операций пока нет.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {history.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-[15px]">{txTitle(t)}</p>
                <p className="truncate text-xs text-muted">
                  {timeAgo(t.created_at)}
                  {t.note && ` · ${t.note}`}
                </p>
              </div>
              <b className={t.amount > 0 ? "text-green-600" : "text-ink"}>
                {t.amount > 0 ? "+" : "−"}
                {fmtStars(Math.abs(t.amount))} ★
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
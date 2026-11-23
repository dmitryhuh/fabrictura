"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import GiftArt from "@/components/GiftArt";
import { COLLECTION_SELECT, Collection } from "@/lib/gifts";
import { fmtStars, starsError } from "@/lib/stars";

export default function GiftStorePage() {
  const { me } = useMe();
  const router = useRouter();
  const toParam = useSearchParams().get("to") ?? "";

  const [cols, setCols] = useState<Collection[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<"self" | "other">(toParam ? "other" : "self");
  const [to, setTo] = useState(toParam);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, w] = await Promise.all([
      supabase
        .from("gift_collections")
        .select(COLLECTION_SELECT)
        .eq("active", true)
        .order("created_at"),
      supabase.from("wallets").select("balance").eq("user_id", me.id).maybeSingle(),
    ]);
    setCols((c.data ?? []) as unknown as Collection[]);
    setBalance(w.data?.balance ?? 0);
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const current = cols?.find((c) => c.id === sel) ?? null;

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setError("");
    setDone(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("buy_gift", {
      p_collection: current.id,
      p_recipient: mode === "other" ? to : null,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    setDone(String(data));
    setNote("");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          aria-label="Назад"
          className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-xl font-bold">Подарки</h1>
        {balance !== null && (
          <Link href="/account/wallet" className="rounded-full border border-line bg-white px-3 py-1 text-sm">
            {fmtStars(balance)} ★
          </Link>
        )}
      </div>

      {!cols && <p className="py-10 text-center text-muted">Загрузка...</p>}
      {cols && cols.length === 0 && (
        <p className="py-10 text-center text-muted">Подарков пока нет в продаже.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cols?.map((c) => {
          const left = c.supply - c.sold;
          return (
            <button
              key={c.id}
              disabled={left <= 0}
              onClick={() => {
                setSel(c.id);
                setDone(null);
                setError("");
              }}
              className={`overflow-hidden rounded-xl border bg-white text-left transition disabled:opacity-50 ${
                sel === c.id ? "border-ink ring-2 ring-ink" : "border-line hover:shadow-md"
              }`}
            >
              <GiftArt model={c.base} className="!rounded-none" />
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="text-xs text-muted">
                  {left > 0 ? `Осталось ${fmtStars(left)} из ${fmtStars(c.supply)}` : "Раскуплено"}
                </p>
                <p className="mt-1 text-sm font-semibold">{fmtStars(c.price)} ★</p>
              </div>
            </button>
          );
        })}
      </div>

      {current && (
        <form onSubmit={buy} className="space-y-3 rounded-xl border border-line bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            {current.name}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {(["self", "other"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={mode === m ? "btn-primary !py-2 text-sm" : "btn-ghost"}
              >
                {m === "self" ? "Себе" : "Другому"}
              </button>
            ))}
          </div>
          {mode === "other" && (
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
          )}
          <input
            className="input"
            placeholder="Подпись (необязательно)"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {done && (
            <p className="text-sm text-green-600">
              Готово!{" "}
              <Link href={`/gifts/${done}`} className="underline">
                Открыть подарок
              </Link>
            </p>
          )}
          <button disabled={busy || (mode === "other" && !to)} className="btn-primary w-full py-3">
            {busy ? "Покупаем..." : `Купить за ${fmtStars(current.price)} ★`}
          </button>
        </form>
      )}
    </div>
  );
}
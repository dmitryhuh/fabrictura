"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import GiftArt from "@/components/GiftArt";
import { GIFT_SELECT, UserGift } from "@/lib/gifts";
import { fmtStars, starsError } from "@/lib/stars";

export default function GiftPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const [gift, setGift] = useState<UserGift | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("user_gifts").select(GIFT_SELECT).eq("id", id).maybeSingle();
    if (!data) setNotFound(true);
    else setGift(data as unknown as UserGift);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function upgrade() {
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("upgrade_gift", { p_gift: id });
    setBusy(false);
    setConfirm(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    setFresh(true);
    await load();
  }

  if (notFound) return <p className="py-16 text-center text-muted">Подарок не найден.</p>;
  if (!gift) return <p className="py-16 text-center text-muted">Загрузка...</p>;

  const c = gift.collection;
  const upgraded = !!gift.model;
  const isOwner = gift.owner_id === me.id;
  const row = "flex justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0";

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
        <h1 className="text-xl font-bold">
          {c.name}
          {gift.number ? ` №${gift.number}` : ""}
        </h1>
      </div>

      <div className={`mx-auto max-w-sm ${fresh ? "gift-reveal" : ""}`}>
        <GiftArt model={gift.model ?? c.base} backdrop={gift.backdrop} animate />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        {upgraded && (
          <>
            <div className={row}><span className="text-muted">Модель</span><b>{gift.model?.name}</b></div>
            <div className={row}><span className="text-muted">Фон</span><b>{gift.backdrop?.name}</b></div>
            <div className={row}><span className="text-muted">Номер</span><b>№{gift.number} из {fmtStars(c.upgraded)}</b></div>
          </>
        )}
        <div className={row}>
          <span className="text-muted">Владелец</span>
          {gift.owner ? <Link href={`/u/${gift.owner.username}`} className="font-semibold hover:underline">@{gift.owner.username}</Link> : "—"}
        </div>
        {gift.sender && (
          <div className={row}>
            <span className="text-muted">От</span>
            <Link href={`/u/${gift.sender.username}`} className="font-semibold hover:underline">@{gift.sender.username}</Link>
          </div>
        )}
        {gift.message && <div className={row}><span className="text-muted">Подпись</span><span className="text-right">{gift.message}</span></div>}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {isOwner && !upgraded && (
        <div className="space-y-2">
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="btn-primary w-full py-3">
              Прокачать за {fmtStars(c.upgrade_price)} ★
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-line bg-white p-4 text-center">
              <p className="text-sm">
                Спишется {fmtStars(c.upgrade_price)} ★. Модель и фон выпадут случайно, отменить нельзя.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setConfirm(false)} className="btn-ghost">Отмена</button>
                <button onClick={upgrade} disabled={busy} className="btn-primary !py-2 text-sm">
                  {busy ? "Прокачиваем..." : "Прокачать"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import GiftSheet from "@/components/GiftSheet";
import GiftArt from "@/components/GiftArt";
import { GIFT_SELECT, UserGift } from "@/lib/gifts";
import { Odds, fmtPct, getOdds } from "@/lib/giftOdds";
import { fmtStars, starsError } from "@/lib/stars";

type Props = { giftId: string; onClose: () => void; onChanged?: () => void };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[15px] last:border-b-0">
      <span className="text-muted">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-right font-semibold">
        {children}
      </span>
    </div>
  );
}

function Chance({ v }: { v?: number }) {
  if (v === undefined) return null;
  return (
    <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-muted">
      {fmtPct(v)}
    </span>
  );
}

export default function GiftModal({ giftId, onClose, onChanged }: Props) {
  const { me } = useMe();
  const [gift, setGift] = useState<UserGift | null>(null);
  const [odds, setOdds] = useState<Odds | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [play, setPlay] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("user_gifts").select(GIFT_SELECT).eq("id", giftId).maybeSingle();
    if (!data) {
      setMissing(true);
      return;
    }
    const g = data as unknown as UserGift;
    setGift(g);
    getOdds(g.collection.id, g.collection.base?.id ?? null).then(setOdds);
  }, [giftId]);

  useEffect(() => {
    load();
  }, [load]);

  async function upgrade() {
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("upgrade_gift", { p_gift: giftId });
    setBusy(false);
    setConfirm(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    setFresh(true);
    setPlay((p) => p + 1);
    await load();
    onChanged?.();
  }

  if (missing) {
    return (
      <GiftSheet onClose={onClose}>
        <p className="px-6 py-16 text-center text-muted">Подарок не найден.</p>
      </GiftSheet>
    );
  }
  if (!gift) {
    return (
      <GiftSheet onClose={onClose}>
        <p className="px-6 py-16 text-center text-muted">Загрузка...</p>
      </GiftSheet>
    );
  }

  const c = gift.collection;
  const upgraded = !!gift.model;
  const isOwner = gift.owner_id === me.id;

  return (
    <GiftSheet onClose={onClose}>
      <div className="overflow-y-auto">
        <div
          onClick={() => setPlay((p) => p + 1)}
          className={`cursor-pointer ${fresh ? "gift-reveal" : ""}`}
        >
          <GiftArt
            key={play}
            model={gift.model ?? c.base}
            backdrop={gift.backdrop}
            pattern={gift.pattern}
            animate
            className="!aspect-auto h-64 !rounded-none"
          />
        </div>

        <div className="px-4 pb-1 pt-3 text-center">
          <h2 className="text-xl font-bold">
            {c.name}
            {gift.number ? ` №${gift.number}` : ""}
          </h2>
          {!upgraded && (
            <p className="mt-1 text-sm text-muted">
              Обычный подарок. Прокачка даст случайные модель, фон и узор.
            </p>
          )}
        </div>

        <div className="m-4 overflow-hidden rounded-xl border border-line">
          {upgraded && (
            <>
              <Row label="Модель">
                {gift.model?.name}
                <Chance v={gift.model ? odds?.models.get(gift.model.id) : undefined} />
              </Row>
              <Row label="Фон">
                {gift.backdrop?.name}
                <Chance v={gift.backdrop ? odds?.backdrops.get(gift.backdrop.id) : undefined} />
              </Row>
              <Row label="Узор">
                {gift.pattern?.name ?? "—"}
                <Chance v={gift.pattern ? odds?.patterns.get(gift.pattern.id) : undefined} />
              </Row>
            </>
          )}
          <Row label="Владелец">
            {gift.owner ? (
              <Link href={`/u/${gift.owner.username}`} onClick={onClose} className="truncate hover:underline">
                @{gift.owner.username}
              </Link>
            ) : (
              "—"
            )}
          </Row>
          {gift.sender && (
            <Row label="От">
              <Link href={`/u/${gift.sender.username}`} onClick={onClose} className="truncate hover:underline">
                @{gift.sender.username}
              </Link>
            </Row>
          )}
          {gift.message && <Row label="Подпись">{gift.message}</Row>}
        </div>

        {error && <p className="px-4 pb-2 text-sm text-red-500">{error}</p>}

        {isOwner && !upgraded && (
          <div className="px-4 pb-4">
            {!confirm ? (
              <button onClick={() => setConfirm(true)} className="btn-primary w-full py-3">
                Прокачать за {fmtStars(c.upgrade_price)} ★
              </button>
            ) : (
              <div className="space-y-2 text-center">
                <p className="text-sm">
                  Спишется {fmtStars(c.upgrade_price)} ★. Результат случайный, отменить нельзя.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setConfirm(false)} className="btn-ghost">
                    Отмена
                  </button>
                  <button onClick={upgrade} disabled={busy} className="btn-primary !py-2 text-sm">
                    {busy ? "Прокачиваем..." : "Прокачать"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </GiftSheet>
  );
}
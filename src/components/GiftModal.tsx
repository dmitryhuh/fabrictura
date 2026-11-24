"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Ellipsis, EyeOff, Pin, Send, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import GiftSheet from "@/components/GiftSheet";
import GiftArt from "@/components/GiftArt";
import GiftReel, { REEL_MS, ReelItem } from "@/components/GiftReel";
import { GIFT_SELECT, GiftBackdrop, GiftModel, GiftPattern, UserGift } from "@/lib/gifts";
import { Odds, fmtPct, getOdds } from "@/lib/giftOdds";
import { fmtStars, starsError } from "@/lib/stars";

type Props = { giftId: string; onClose: () => void; onChanged?: () => void };

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const sleep = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

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

const MENU_ITEM =
  "flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-brand-soft disabled:opacity-50 disabled:hover:bg-transparent";

export default function GiftModal({ giftId, onClose, onChanged }: Props) {
  const { me } = useMe();
  const [gift, setGift] = useState<UserGift | null>(null);
  const [odds, setOdds] = useState<Odds | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [play, setPlay] = useState(0);
  const [reel, setReel] = useState<{ items: ReelItem[]; target: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([
      supabase.from("user_gifts").select(GIFT_SELECT).eq("id", giftId).maybeSingle(),
      supabase.from("profiles").select("pinned_gift_id").eq("id", me.id).maybeSingle(),
    ]);
    if (!g.data) {
      setMissing(true);
      return;
    }
    const row = g.data as unknown as UserGift;
    setGift(row);
    setPinnedId((p.data?.pinned_gift_id as string | null) ?? null);
    getOdds(row.collection.id, row.collection.base?.id ?? null).then(setOdds);
  }, [giftId, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function upgrade() {
    if (!gift) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("upgrade_gift", { p_gift: giftId });
    setConfirm(false);
    if (error) {
      setBusy(false);
      setError(starsError(error.message));
      return;
    }

    // списание и результат уже на сервере; дальше только показ барабана
    const [m, b, p, r] = await Promise.all([
      supabase
        .from("gift_models")
        .select("id, name, lottie_path, png_path")
        .eq("collection_id", gift.collection.id),
      supabase
        .from("gift_backdrops")
        .select("id, name, center_color, edge_color, pattern_color, text_color"),
      supabase.from("gift_patterns").select("id, key, name, png_path"),
      supabase.from("user_gifts").select(GIFT_SELECT).eq("id", giftId).maybeSingle(),
    ]);

    const models = ((m.data ?? []) as GiftModel[]).filter((x) => x.id !== gift.collection.base?.id);
    const withPng = models.filter((x) => x.png_path);
    const modelPool = withPng.length ? withPng : models;
    const backs = (b.data ?? []) as GiftBackdrop[];
    const pats = ((p.data ?? []) as GiftPattern[]).filter((x) => x.png_path);
    const res = r.data as unknown as UserGift | null;

    if (res?.model && res.backdrop && modelPool.length && backs.length) {
      const N = 32;
      const TARGET = 27;
      const items: ReelItem[] = Array.from({ length: N }, (_, i) =>
        i === TARGET
          ? { model: res.model!, backdrop: res.backdrop!, pattern: res.pattern }
          : {
              model: pick(modelPool),
              backdrop: pick(backs),
              pattern: pats.length ? pick(pats) : null,
            }
      );
      setReel({ items, target: TARGET });
      await sleep(REEL_MS + 600);
    }

    if (!alive.current) return;
    await load();
    setReel(null);
    setBusy(false);
    setFresh(true);
    setPlay((x) => x + 1);
    onChanged?.();
  }

  async function togglePin() {
    setMenu(false);
    setError("");
    const { error } = await supabase.rpc("set_pinned_gift", {
      p_gift: pinnedId === giftId ? null : giftId,
    });
    if (error) {
      setError(starsError(error.message));
      return;
    }
    await load();
    onChanged?.();
  }

  async function toggleHidden() {
    if (!gift) return;
    setMenu(false);
    setError("");
    const { error } = await supabase.rpc("set_gift_hidden", {
      p_gift: giftId,
      p_hidden: !gift.hidden,
    });
    if (error) {
      setError(starsError(error.message));
      return;
    }
    await load();
    onChanged?.();
  }

  async function doTransfer() {
    const name = to.trim().replace(/^@/, "").toLowerCase();
    if (!name) return;
    setBusy(true);
    setError("");
    const { error } = await supabase.rpc("transfer_gift", { p_gift: giftId, p_username: name });
    setBusy(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    onChanged?.();
    onClose();
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
  const pinned = pinnedId === giftId;

  return (
    <GiftSheet onClose={onClose}>
      <div className="overflow-y-auto">
        <div className="relative">
          {reel ? (
            <GiftReel items={reel.items} target={reel.target} />
          ) : (
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
          )}

          {isOwner && !reel && (
            <div className="absolute left-3 top-3 z-10">
              <button
                onClick={() => setMenu((v) => !v)}
                aria-label="Действия"
                className="grid h-9 w-9 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50"
              >
                <Ellipsis size={18} />
              </button>
              {menu && (
                <div className="mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white py-1 text-[15px] shadow-lg">
                  <button
                    onClick={() => {
                      setMenu(false);
                      setConfirm(false);
                      setTransfer(true);
                    }}
                    className={MENU_ITEM}
                  >
                    <Send size={16} /> Передать
                  </button>
                  <button disabled className={MENU_ITEM}>
                    <Tag size={16} /> Продать
                    <span className="ml-auto text-xs text-muted">скоро</span>
                  </button>
                  <button onClick={togglePin} className={MENU_ITEM}>
                    <Pin size={16} /> {pinned ? "Открепить от профиля" : "Закрепить у ника"}
                  </button>
                  <button onClick={toggleHidden} className={MENU_ITEM}>
                    <EyeOff size={16} /> {gift.hidden ? "Показать в профиле" : "Скрыть из профиля"}
                  </button>
                </div>
              )}
            </div>
          )}
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
          {isOwner && gift.hidden && (
            <p className="mt-1 text-xs text-muted">Скрыт из вашего профиля</p>
          )}
        </div>

        <div className="m-4 overflow-hidden rounded-xl border border-line">
          {upgraded && !reel && (
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

        {isOwner && transfer && (
          <div className="space-y-2 px-4 pb-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input
                className="input pl-9"
                placeholder="Юзернейм получателя"
                maxLength={20}
                autoFocus
                value={to}
                onChange={(e) => setTo(e.target.value.toLowerCase().replace(/[\s@]/g, ""))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setTransfer(false);
                  setTo("");
                  setError("");
                }}
                className="btn-ghost"
              >
                Отмена
              </button>
              <button
                onClick={doTransfer}
                disabled={busy || !to}
                className="btn-primary !py-2 text-sm"
              >
                {busy ? "Передаём..." : "Передать"}
              </button>
            </div>
            <p className="text-center text-xs text-muted">
              Подарок станет собственностью получателя. Отменить нельзя.
            </p>
          </div>
        )}

        {isOwner && !upgraded && !transfer && (
          <div className="px-4 pb-4">
            {busy ? (
              <p className="py-3 text-center text-sm text-muted">Прокачиваем...</p>
            ) : !confirm ? (
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
                  <button onClick={upgrade} className="btn-primary !py-2 text-sm">
                    Прокачать
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
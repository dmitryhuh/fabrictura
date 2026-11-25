"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import GiftSheet from "@/components/GiftSheet";
import { PinnedGift, giftUrl } from "@/lib/gifts";
import type { Badge } from "@/lib/posts";

type Props = {
  badge?: Badge | null;
  gift?: PinnedGift | null;
  size?: number;
  onGift?: (giftId: string) => void;
};

const INFO: Record<Badge, { color: string; title: string; text: string }> = {
  staff: {
    color: "fill-ink",
    title: "Чёрная галочка",
    text: "Этот аккаунт принадлежит партнёру или сотруднику сервиса.",
  },
  official: {
    color: "fill-sky-500",
    title: "Синяя галочка",
    text: "Этот пользователь верифицирован.",
  },
};

export default function NameBadges({ badge = null, gift = null, size = 18, onGift }: Props) {
  const [info, setInfo] = useState(false);
  const png = (gift?.model ?? gift?.collection?.base)?.png_path ?? null;
  if (!badge && !(gift && png)) return null;

  const meta = badge ? INFO[badge] : null;

  const img = png && (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={giftUrl(png)}
      alt=""
      draggable={false}
      className="object-contain"
      style={{ width: size + 4, height: size + 4 }}
    />
  );

  return (
    <span className="inline-flex shrink-0 items-center gap-1 align-middle">
      {meta && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setInfo(true);
          }}
          aria-label={meta.title}
        >
          <BadgeCheck size={size} className={`${meta.color} text-white`} />
        </button>
      )}
      {gift &&
        img &&
        (onGift ? (
          <button type="button" onClick={() => onGift(gift.id)} aria-label="Открыть подарок">
            {img}
          </button>
        ) : (
          img
        ))}

      {info && meta && (
        <GiftSheet onClose={() => setInfo(false)}>
          <div className="flex flex-col items-center gap-3 px-6 pb-8 pt-10 text-center">
            <BadgeCheck size={56} className={`${meta.color} text-white`} />
            <h2 className="text-lg font-bold">{meta.title}</h2>
            <p className="text-muted">{meta.text}</p>
            <button onClick={() => setInfo(false)} className="btn-primary mt-2 w-full py-3">
              Понятно
            </button>
          </div>
        </GiftSheet>
      )}
    </span>
  );
}
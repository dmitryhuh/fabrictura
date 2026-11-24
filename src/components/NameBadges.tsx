"use client";

import { BadgeCheck } from "lucide-react";
import { PinnedGift, giftUrl } from "@/lib/gifts";

type Props = {
  verified?: boolean;
  gift?: PinnedGift | null;
  size?: number;
  onGift?: (giftId: string) => void;
};

export default function NameBadges({ verified = false, gift = null, size = 18, onGift }: Props) {
  const png = (gift?.model ?? gift?.collection?.base)?.png_path ?? null;
  if (!verified && !(gift && png)) return null;

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
      {verified && (
        <BadgeCheck size={size} className="fill-ink text-white" aria-label="Подтверждённый аккаунт" />
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
    </span>
  );
}
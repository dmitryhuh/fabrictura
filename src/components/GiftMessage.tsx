"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import GiftArt from "@/components/GiftArt";
import { GIFT_SELECT, UserGift } from "@/lib/gifts";

type Props = { giftId: string; mine: boolean; onOpen: (id: string) => void };

export default function GiftMessage({ giftId, mine, onOpen }: Props) {
  const [gift, setGift] = useState<UserGift | null>(null);

  useEffect(() => {
    let off = false;
    supabase
      .from("user_gifts")
      .select(GIFT_SELECT)
      .eq("id", giftId)
      .maybeSingle()
      .then(({ data }) => {
        if (!off && data) setGift(data as unknown as UserGift);
      });
    return () => {
      off = true;
    };
  }, [giftId]);

  return (
    <button type="button" onClick={() => onOpen(giftId)} className="block w-44 text-center">
      <p className="mb-1 text-[13px] opacity-80">
        {mine ? "Вы передали подарок" : "Вам передали подарок"}
      </p>
      <GiftArt
        model={gift?.model ?? gift?.collection.base ?? null}
        backdrop={gift?.backdrop}
        pattern={gift?.pattern}
      />
      <p className="mt-1 text-sm font-semibold">{gift?.collection.name ?? "Подарок"}</p>
      {gift?.message && <p className="break-words text-[13px] opacity-80">{gift.message}</p>}
    </button>
  );
}
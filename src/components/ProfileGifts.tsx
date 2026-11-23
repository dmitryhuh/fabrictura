"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import GiftArt from "@/components/GiftArt";
import { GIFT_SELECT, UserGift } from "@/lib/gifts";

type Props = { profileId: string; username: string; isMe: boolean };

export default function ProfileGifts({ profileId, username, isMe }: Props) {
  const [gifts, setGifts] = useState<UserGift[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let off = false;
    supabase
      .from("user_gifts")
      .select(GIFT_SELECT)
      .eq("owner_id", profileId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (off) return;
        if (error) setError(error.message);
        else setGifts((data ?? []) as unknown as UserGift[]);
      });
    return () => {
      off = true;
    };
  }, [profileId]);

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!gifts && !error && <p className="py-8 text-center text-muted">Загрузка...</p>}
      {gifts && gifts.length === 0 && (
        <p className="py-8 text-center text-muted">Подарков пока нет.</p>
      )}

      {gifts && gifts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gifts.map((g) => (
            <Link
              key={g.id}
              href={`/gifts/${g.id}`}
              className="overflow-hidden rounded-xl border border-line bg-white transition hover:shadow-md"
            >
              <GiftArt
                model={g.model ?? g.collection.base}
                backdrop={g.backdrop}
                className="!rounded-none"
              />
              <div className="px-3 py-2">
                <p className="truncate text-sm font-semibold">{g.collection.name}</p>
                <p className="truncate text-xs text-muted">
                  {g.number ? `№${g.number} · ${g.model?.name ?? ""}` : "Можно прокачать"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        href={isMe ? "/gifts" : `/gifts?to=${username}`}
        className="btn-primary block w-full py-3 text-center"
      >
        Купить подарок
      </Link>
    </div>
  );
}
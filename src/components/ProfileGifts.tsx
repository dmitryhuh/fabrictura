"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import GiftArt from "@/components/GiftArt";
import GiftModal from "@/components/GiftModal";
import GiftShop from "@/components/GiftShop";
import { GIFT_SELECT, UserGift } from "@/lib/gifts";

type Props = {
  profileId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
  onChanged?: () => void;
};

export default function ProfileGifts({
  profileId,
  username,
  name,
  avatarUrl,
  isMe,
  onChanged,
}: Props) {
  const [gifts, setGifts] = useState<UserGift[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shop, setShop] = useState(false);
  const [showBtn, setShowBtn] = useState(false);

  const load = useCallback(async () => {
    const base = supabase.from("user_gifts").select(GIFT_SELECT).eq("owner_id", profileId);
    const { data, error } = await (isMe ? base : base.eq("hidden", false))
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    else setGifts((data ?? []) as unknown as UserGift[]);
  }, [profileId, isMe]);

  useEffect(() => {
    load();
  }, [load]);

  // кнопка «Купить подарок» плавно появляется, когда пролистнули вниз (или страница короткая)
  useEffect(() => {
    function check() {
      const scrolled = window.scrollY > 160;
      const short = document.documentElement.scrollHeight <= window.innerHeight + 160;
      setShowBtn(scrolled || short);
    }
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [gifts]);

  function changed() {
    load();
    onChanged?.();
  }

  return (
    <div className="space-y-3 pb-16">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!gifts && !error && <p className="py-8 text-center text-muted">Загрузка...</p>}
      {gifts && gifts.length === 0 && (
        <p className="py-8 text-center text-muted">Подарков пока нет.</p>
      )}

      {gifts && gifts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {gifts.map((g) => (
            <button
              key={g.id}
              onClick={() => setOpenId(g.id)}
              className="relative block overflow-hidden rounded-xl text-left transition active:scale-[0.97]"
            >
              <GiftArt
                model={g.model ?? g.collection.base}
                backdrop={g.backdrop}
                pattern={g.pattern}
                className="!rounded-none"
              />
              {g.number && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  №{g.number}
                </span>
              )}
              {g.hidden && (
                <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-black/50 backdrop-blur-sm">
                    <EyeOff size={20} />
                  </span>
                </span>
              )}
              <span
                className="absolute inset-x-0 bottom-0 truncate px-2 pb-1.5 text-center text-[11px] font-semibold"
                style={{ color: g.backdrop?.text_color ?? "#71717A" }}
              >
                {g.model?.name ?? g.collection.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => setShop(true)}
        className={`btn-primary fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap px-6 py-3 shadow-lg transition duration-300 md:bottom-6 ${
          showBtn ? "translate-y-0 opacity-95" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        Купить подарок
      </button>

      {openId && <GiftModal giftId={openId} onClose={() => setOpenId(null)} onChanged={changed} />}
      {shop && (
        <GiftShop
          recipient={isMe ? null : { username, name, avatar: avatarUrl }}
          onClose={() => setShop(false)}
          onBought={(id) => {
            setShop(false);
            changed();
            setOpenId(id);
          }}
        />
      )}
    </div>
  );
}
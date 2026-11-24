"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import GiftArt from "@/components/GiftArt";
import GiftSheet from "@/components/GiftSheet";
import { COLLECTION_SELECT, Collection } from "@/lib/gifts";
import { ConversationItem } from "@/lib/messages";
import { fmtStars, starsError } from "@/lib/stars";

export type Recipient = { username: string; name: string; avatar: string | null; self?: boolean };

type Props = {
  recipient?: Recipient | null; // заранее выбранный получатель (профиль другого человека)
  onClose: () => void;
  onBought: (giftId: string) => void;
};

function Person({ r, sub, onPick }: { r: Recipient; sub: string; onPick: (r: Recipient) => void }) {
  return (
    <button
      onClick={() => onPick(r)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-brand-soft"
    >
      <Avatar url={r.avatar} name={r.name} size={44} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{r.self ? "Себе" : r.name}</p>
        <p className="truncate text-sm text-muted">{sub}</p>
      </div>
    </button>
  );
}

export default function GiftShop({ recipient = null, onClose, onBought }: Props) {
  const { me } = useMe();
  const self: Recipient = {
    username: me.username,
    name: me.display_name || me.username,
    avatar: me.avatar_url,
    self: true,
  };

  const [to, setTo] = useState<Recipient | null>(recipient);
  const [q, setQ] = useState("");
  const [chats, setChats] = useState<Recipient[]>([]);
  const [found, setFound] = useState<Recipient[]>([]);
  const [cols, setCols] = useState<Collection[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("conversation_list").then(({ data }) => {
      setChats(
        ((data ?? []) as ConversationItem[]).slice(0, 30).map((c) => ({
          username: c.other_username,
          name: c.other_name || c.other_username,
          avatar: c.other_avatar,
        }))
      );
    });
    Promise.all([
      supabase.from("gift_collections").select(COLLECTION_SELECT).eq("active", true).order("created_at"),
      supabase.from("wallets").select("balance").eq("user_id", me.id).maybeSingle(),
    ]).then(([c, w]) => {
      setCols((c.data ?? []) as unknown as Collection[]);
      setBalance(w.data?.balance ?? 0);
    });
  }, [me.id]);

  const term = q.trim().replace(/[%,()*\\"_@]/g, "");

  useEffect(() => {
    if (term.length < 2) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
        .neq("id", me.id)
        .limit(8);
      setFound(
        (data ?? []).map((p) => ({
          username: p.username,
          name: p.display_name || p.username,
          avatar: p.avatar_url,
        }))
      );
    }, 300);
    return () => clearTimeout(t);
  }, [term, me.id]);

  const current = cols?.find((c) => c.id === sel) ?? null;

  async function buy() {
    if (!current || !to) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase.rpc("buy_gift", {
      p_collection: current.id,
      p_recipient: to.self ? null : to.username,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(starsError(error.message));
      return;
    }
    onBought(String(data));
  }

  // шаг 1: кому подарить
  if (!to) {
    const list = term.length >= 2 ? found : chats;
    return (
      <GiftSheet onClose={onClose}>
        <div className="px-4 pb-3 pt-4">
          <h2 className="pr-10 text-lg font-bold">Кому подарить?</h2>
          <div className="relative mt-3">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input !rounded-full !bg-brand-soft !py-2 pl-10"
              placeholder="Поиск по имени или юзернейму"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {term.length < 2 && <Person r={self} sub="Подарок в свою коллекцию" onPick={setTo} />}
          {list.map((r) => (
            <Person key={r.username} r={r} sub={`@${r.username}`} onPick={setTo} />
          ))}
          {term.length >= 2 && list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Никого не нашли.</p>
          )}
          {term.length < 2 && chats.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Чатов пока нет. Найдите человека по юзернейму.
            </p>
          )}
        </div>
      </GiftSheet>
    );
  }

  // шаг 2: какой подарок
  return (
    <GiftSheet onClose={onClose}>
      <div className="px-4 pb-2 pt-4 pr-14">
        <button
          onClick={() => {
            setTo(null);
            setSel(null);
            setError("");
          }}
          className="inline-flex items-center gap-2 rounded-full bg-brand-soft py-1 pl-1 pr-3 text-sm"
        >
          <Avatar url={to.avatar} name={to.name} size={26} />
          <span className="font-semibold">{to.self ? "Себе" : to.name}</span>
          <span className="text-muted">изменить</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        {!cols && <p className="py-10 text-center text-muted">Загрузка...</p>}
        {cols && cols.length === 0 && (
          <p className="py-10 text-center text-muted">Подарков пока нет в продаже.</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {cols?.map((c) => {
            const left = c.supply - c.sold;
            return (
              <button
                key={c.id}
                disabled={left <= 0}
                onClick={() => setSel(c.id)}
                className={`overflow-hidden rounded-xl border bg-white text-left transition disabled:opacity-50 ${
                  sel === c.id ? "border-ink ring-2 ring-ink" : "border-line hover:shadow-md"
                }`}
              >
                <GiftArt model={c.base} className="!rounded-none" />
                <div className="px-2 py-1.5">
                  <p className="truncate text-xs font-semibold">{c.name}</p>
                  <p className="text-[11px] text-muted">
                    {left > 0 ? `${fmtStars(left)} из ${fmtStars(c.supply)}` : "Раскуплено"}
                  </p>
                  <p className="text-xs font-semibold">{fmtStars(c.price)} ★</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-line p-4">
        {current && (
          <input
            className="input"
            placeholder="Подпись (необязательно)"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={buy} disabled={!current || busy} className="btn-primary w-full py-3">
          {busy
            ? "Покупаем..."
            : current
            ? `Купить за ${fmtStars(current.price)} ★`
            : "Выберите подарок"}
        </button>
        {balance !== null && (
          <p className="text-center text-xs text-muted">Ваш баланс: {fmtStars(balance)} ★</p>
        )}
      </div>
    </GiftSheet>
  );
}
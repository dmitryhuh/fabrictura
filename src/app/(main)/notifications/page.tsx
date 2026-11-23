"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, MessageSquare, Repeat2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/posts";
import { ConversationItem } from "@/lib/messages";

type Notif = {
  id: string;
  type: "like" | "comment" | "follow" | "repost" | "comment_like";
  post_id: string | null;
  created_at: string;
  read: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

const TEXT = {
  like: "оценил(а) вашу запись",
  comment: "прокомментировал(а) ваш пост",
  follow: "подписался(лась) на вас",
  repost: "репостнул(а) вашу запись",
  comment_like: "оценил(а) ваш комментарий",
};

const BADGE = {
  like: { icon: Heart, color: "bg-rose-500" },
  comment: { icon: MessageSquare, color: "bg-ink" },
  follow: { icon: UserPlus, color: "bg-ink" },
  repost: { icon: Repeat2, color: "bg-emerald-600" },
  comment_like: { icon: Heart, color: "bg-rose-500" },
};

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff <= 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return "Раньше";
}

export default function NotificationsPage() {
  const { me, refreshUnread } = useMe();
  const [items, setItems] = useState<Notif[]>([]);
  const [chats, setChats] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select(
        "id, type, post_id, created_at, read, profiles!actor_id(username, display_name, avatar_url)"
      )
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) setError(error.message);
    else setItems((data ?? []) as unknown as Notif[]);

    
    const { data: convs } = await supabase.rpc("conversation_list");
    setChats(
      ((convs ?? []) as ConversationItem[]).filter(
        (c) => c.unread_count > 0 && c.last_sender !== me.id
      )
    );
    setLoading(false);
  }, [me.id]);

  useEffect(() => {
    load();
    window.addEventListener("notif-new", load);
    window.addEventListener("msg-new", load);
    return () => {
      window.removeEventListener("notif-new", load);
      window.removeEventListener("msg-new", load);
    };
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    await refreshUnread();
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", me.id)
      .eq("read", false);
    await refreshUnread();
  }

  const groups = ["Сегодня", "Вчера", "Раньше"]
    .map((title) => ({ title, rows: items.filter((n) => dayGroup(n.created_at) === title) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-4">
      <h1 className="px-1 text-xl font-bold">Уведомления</h1>

      <div className="flex items-center justify-between px-1">
        <span className="rounded-full border border-line bg-white px-3 py-1 text-sm text-muted">
          Непрочитано <b className="text-ink">{unread}</b>
        </span>
        {unread > 0 && (
          <button onClick={markAll} className="btn-ghost">
            Прочитать всё
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="py-8 text-center text-muted">Загрузка...</p>}
      {!loading && items.length === 0 && chats.length === 0 && (
        <p className="py-10 text-center text-muted">Пока ничего нового.</p>
      )}

      {chats.length > 0 && (
        <section>
          <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Сообщения
          </h2>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {chats.map((c) => {
              const name = c.other_name || c.other_username;
              return (
                <Link
                  key={c.conv_id}
                  href={`/messages/${c.conv_id}`}
                  className="flex items-center gap-3 border-b border-line bg-brand-soft px-4 py-3 transition last:border-b-0 hover:bg-brand-soft"
                >
                  <div className="relative shrink-0">
                    <Avatar url={c.other_avatar} name={name} size={40} />
                    <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-white ring-2 ring-white">
                      <MessageCircle size={11} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">
                      <b>{name}</b> отправил(а) вам{" "}
                      {c.unread_count > 1 ? `сообщения (${c.unread_count})` : "сообщение"}
                    </p>
                    <p className="text-xs text-muted">{timeAgo(c.last_at)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.title}>
          <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {g.title}
          </h2>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {g.rows.map((n) => {
              const actor = n.profiles;
              const name = actor?.display_name || actor?.username || "?";
              const href =
                n.type === "follow" ? `/u/${actor?.username ?? ""}` : `/p/${n.post_id ?? ""}`;
              const { icon: Icon, color } = BADGE[n.type];

              return (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 transition hover:bg-brand-soft ${
                    n.read ? "" : "bg-brand-soft"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar url={actor?.avatar_url} name={name} size={40} />
                    <span
                      className={`absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-white ring-2 ring-white ${color}`}
                    >
                      <Icon size={11} />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px]">
                      <b>{name}</b> {TEXT[n.type]}
                    </p>
                    <p className="text-xs text-muted">{timeAgo(n.created_at)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
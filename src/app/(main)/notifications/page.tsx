"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, MessageSquare, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/posts";

type Notif = {
  id: string;
  type: "like" | "comment" | "follow";
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
  like: "поставил(а) лайк вашему посту",
  comment: "прокомментировал(а) ваш пост",
  follow: "подписался(лась) на вас",
};

export default function NotificationsPage() {
  const { me, refreshUnread } = useMe();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, type, post_id, created_at, read, profiles!actor_id(username, display_name, avatar_url)"
        )
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setItems((data ?? []) as unknown as Notif[]);
      setLoading(false);

      // непрочитанные подсвечены в списке, в базе отмечаем прочитанными
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", me.id)
        .eq("read", false);
      await refreshUnread();
    }
    load();
  }, [me.id, refreshUnread]);

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-2xl font-bold">Уведомления</h1>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading && <p className="py-8 text-center text-muted">Загрузка...</p>}
      {!loading && items.length === 0 && (
        <p className="py-10 text-center text-muted">Пока ничего нового.</p>
      )}

      {items.map((n) => {
        const actor = n.profiles;
        const name = actor?.display_name || actor?.username || "?";
        const href =
          n.type === "follow" ? `/u/${actor?.username ?? ""}` : `/p/${n.post_id ?? ""}`;
        const Icon = n.type === "like" ? Heart : n.type === "comment" ? MessageSquare : UserPlus;

        return (
          <Link
            key={n.id}
            href={href}
            className={`flex items-center gap-4 rounded-3xl border p-4 shadow-sm transition hover:shadow-md ${
              n.read ? "border-line bg-white" : "border-brand bg-brand-soft"
            }`}
          >
            <div className="relative">
              <Avatar url={actor?.avatar_url} name={name} size={48} />
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-brand-strong text-white ring-2 ring-white">
                <Icon size={13} />
              </span>
            </div>
            <div className="min-w-0">
              <p>
                <b>{name}</b> {TEXT[n.type]}
              </p>
              <p className="text-sm text-muted">{timeAgo(n.created_at)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
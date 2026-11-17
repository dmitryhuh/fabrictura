"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Bell, MessageCircle, Gift, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import { Me, MeContext } from "@/components/MeContext";

type Item = {
  key: string;
  href: string;
  label: string;
  icon?: LucideIcon;
  avatar?: boolean;
  soon?: boolean;
  badge?: number;
};

type Toast = {
  id: string;
  name: string;
  avatar: string | null;
  text: string;
  href: string;
};

const NOTIF_TEXT: Record<string, string> = {
  like: "оценил(а) вашу запись",
  comment: "прокомментировал(а) ваш пост",
  follow: "подписался(лась) на вас",
  repost: "репостнул(а) вашу запись",
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myId = me?.id;

  const refresh = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", user.id)
      .single();
    if (data) setMe(data);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const refreshUnread = useCallback(async () => {
    if (!myId) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", myId)
      .eq("read", false);
    setUnread(count ?? 0);
  }, [myId]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!myId) return;
    const { count } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", myId)
      .is("read_at", null);
    setUnreadMsgs(count ?? 0);
  }, [myId]);

  useEffect(() => {
    refreshUnread();
    refreshUnreadMessages();
    const t = setInterval(() => {
      refreshUnread();
      refreshUnreadMessages();
    }, 60000);
    return () => clearInterval(t);
  }, [refreshUnread, refreshUnreadMessages, pathname]);

  // новые уведомления и сообщения приходят сразу (один канал на всё)
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`notifications-${myId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${myId}` },
        async (payload) => {
          const n = payload.new as {
            id: string;
            actor_id: string;
            type: string;
            post_id: string | null;
          };
          refreshUnread();
          window.dispatchEvent(new Event("notif-new"));

          const { data: actor } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", n.actor_id)
            .single();
          if (!actor) return;

          setToast({
            id: n.id,
            name: actor.display_name || actor.username,
            avatar: actor.avatar_url,
            text: NOTIF_TEXT[n.type] ?? "новое уведомление",
            href: n.type === "follow" ? `/u/${actor.username}` : `/p/${n.post_id ?? ""}`,
          });
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${myId}` },
        () => {
          refreshUnreadMessages();
          window.dispatchEvent(new Event("msg-new"));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `recipient_id=eq.${myId}` },
        () => {
          refreshUnreadMessages();
          window.dispatchEvent(new Event("msg-new"));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [myId, refreshUnread, refreshUnreadMessages]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!me) {
    return (
      <div className="min-h-screen grid place-items-center bg-canvas text-muted">
        Загрузка...
      </div>
    );
  }

  const name = me.display_name || me.username;
  // сообщения занимают больше места, чем остальные страницы
  const wide = pathname.startsWith("/messages");

  const items: Item[] = [
    { key: "feed", href: "/feed", label: "Лента", icon: Home },
    { key: "search", href: "/search", label: "Поиск", icon: Search },
    { key: "chats", href: "/messages", label: "Чаты", icon: MessageCircle, badge: unreadMsgs },
    { key: "gifts", href: "#", label: "Подарки", icon: Gift, soon: true },
    { key: "notifications", href: "/notifications", label: "Уведомления", icon: Bell, badge: unread },
    { key: "profile", href: `/u/${me.username}`, label: "Профиль", avatar: true },
  ];

  function isActive(it: Item) {
    if (it.soon) return false;
    return it.key === "chats" ? pathname.startsWith("/messages") : pathname === it.href;
  }

  function glyph(it: Item, size: number, active: boolean) {
    const Icon = it.icon;
    return (
      <span className="relative grid shrink-0 place-items-center">
        {it.avatar ? (
          <span className={`rounded-full ${active ? "ring-2 ring-ink ring-offset-2" : ""}`}>
            <Avatar url={me!.avatar_url} name={name} size={size + 2} />
          </span>
        ) : (
          Icon && <Icon size={size} strokeWidth={active ? 2.6 : 2} className="shrink-0" />
        )}
        {!!it.badge && (
          <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {it.badge > 9 ? "9+" : it.badge}
          </span>
        )}
      </span>
    );
  }

  const row =
    "flex items-center gap-4 rounded-full p-3 text-[17px] transition xl:px-4";

  return (
    <MeContext.Provider
      value={{
        me,
        refresh,
        unread,
        refreshUnread,
        unreadMessages: unreadMsgs,
        refreshUnreadMessages,
      }}
    >
      <div className="min-h-screen bg-canvas text-ink">
        {/* Всплывающее уведомление */}
        {toast && (
          <Link
            href={toast.href}
            onClick={() => setToast(null)}
            className="fixed left-1/2 top-3 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-white p-3 shadow-lg"
          >
            <Avatar url={toast.avatar} name={toast.name} size={36} />
            <p className="min-w-0 text-[15px]">
              <b className="break-words">{toast.name}</b> {toast.text}
            </p>
          </Link>
        )}

        {/* Левая колонка (компьютер) */}
        <aside className="fixed left-3 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-stretch rounded-xl border border-line bg-white p-2 md:flex xl:w-56">
          <Link
            href="/feed"
            className="mb-2 flex w-full items-center justify-center py-3"
          >
            <Logo size={30} />
          </Link>

          <nav className="flex flex-col gap-1">
            {items.map((it) => {
              const active = isActive(it);
              const label = <span className="hidden xl:inline">{it.label}</span>;
              if (it.soon) {
                return (
                  <div
                    key={it.key}
                    title={`${it.label} (скоро)`}
                    className={`${row} cursor-default text-muted opacity-60`}
                  >
                    {glyph(it, 24, false)}
                    {label}
                    <span className="ml-auto hidden rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide xl:inline">
                      скоро
                    </span>
                  </div>
                );
              }
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  title={it.label}
                  className={`${row} ${
                    active ? "bg-brand-soft font-bold" : "hover:bg-brand-soft"
                  }`}
                >
                  {glyph(it, 24, active)}
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 border-t border-line" />

          <button
            onClick={logout}
            title="Выйти"
            className={`${row} mt-3 w-full text-muted hover:bg-brand-soft hover:text-ink`}
          >
            <LogOut size={24} className="shrink-0" />
            <span className="hidden xl:inline">Выйти</span>
          </button>
        </aside>

        <div className={wide ? "md:pl-20 md:pr-4 xl:pl-64" : "md:px-20 xl:px-64"}>
          {/* Верхняя полоса (телефон) */}
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur md:hidden">
            <Logo size={28} />
            <button onClick={logout} aria-label="Выйти" className="text-muted">
              <LogOut size={22} />
            </button>
          </header>

          <main
            className={
              wide
                ? "mx-auto max-w-5xl px-4 py-6 pb-24 md:px-0 md:py-4 md:pb-4"
                : "mx-auto max-w-2xl px-4 py-6 pb-24 md:pb-10"
            }
          >
            {children}
          </main>
        </div>

        {/* Нижняя панель (телефон) */}
        <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {items
            .filter((it) => !it.soon)
            .map((it) => {
              const active = isActive(it);
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  aria-label={it.label}
                  className={`grid h-14 w-16 place-items-center ${
                    active ? "text-ink" : "text-muted"
                  }`}
                >
                  {glyph(it, 24, active)}
                </Link>
              );
            })}
        </nav>
      </div>
    </MeContext.Provider>
  );
}

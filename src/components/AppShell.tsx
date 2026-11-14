"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Search, Bell, MessageCircle, Gift, User, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import { Me, MeContext } from "@/components/MeContext";

type Item = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  avatar?: boolean;
  soon?: boolean;
  badge?: number;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [unread, setUnread] = useState(0);
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

  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 30000);
    return () => clearInterval(t);
  }, [refreshUnread, pathname]);

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

  const items: Item[] = [
    { key: "feed", href: "/feed", label: "Лента", icon: Home },
    { key: "search", href: "/search", label: "Поиск", icon: Search },
    { key: "chats", href: "#", label: "Чаты", icon: MessageCircle, soon: true },
    { key: "gifts", href: "#", label: "Подарки", icon: Gift, soon: true },
    { key: "notifications", href: "/notifications", label: "Уведомления", icon: Bell, badge: unread },
    { key: "profile", href: `/u/${me.username}`, label: "Профиль", icon: User, avatar: true },
  ];

  const pill = (active: boolean, soon?: boolean) =>
    `relative flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition ${
      active
        ? "bg-linear-to-r from-brand to-brand-strong text-white shadow-sm"
        : soon
        ? "text-ink opacity-50 cursor-default"
        : "text-ink hover:bg-brand-soft"
    }`;

  return (
    <MeContext.Provider value={{ me, refresh, unread, refreshUnread }}>
      <div className="min-h-screen bg-canvas text-ink">
        {/* Плавающая навигация (компьютер) */}
        <aside className="fixed left-4 top-1/2 z-20 hidden w-52 -translate-y-1/2 flex-col gap-1 rounded-[2rem] border border-line bg-white/90 p-2 shadow-lg backdrop-blur md:flex">
          <Link href="/feed" className="flex items-center justify-center py-3">
            <Logo size={34} />
          </Link>

          <nav className="flex flex-col gap-1">
            {items.map((it) => {
              const active = !it.soon && pathname === it.href;
              const Icon = it.icon;
              const inner = (
                <>
                  {it.avatar ? (
                    <span className={`rounded-full ${active ? "ring-2 ring-white" : ""}`}>
                      <Avatar url={me.avatar_url} name={name} size={24} />
                    </span>
                  ) : (
                    <Icon size={22} />
                  )}
                  <span>{it.label}</span>
                  {it.soon && (
                    <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      скоро
                    </span>
                  )}
                  {!!it.badge && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  )}
                </>
              );
              return it.soon ? (
                <div key={it.key} className={pill(false, true)}>
                  {inner}
                </div>
              ) : (
                <Link key={it.key} href={it.href} className={pill(active)}>
                  {inner}
                </Link>
              );
            })}
          </nav>

          <div className="mt-1 border-t border-line pt-1">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium text-muted transition hover:bg-red-50 hover:text-red-500"
            >
              <LogOut size={22} />
              Выйти
            </button>
          </div>
        </aside>

        <div className="md:pl-64">
          {/* Верхняя полоса (телефон) */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:hidden">
            <Logo size={32} />
            <button onClick={logout} aria-label="Выйти" className="text-muted">
              <LogOut size={22} />
            </button>
          </header>

          <main className="mx-auto max-w-3xl px-4 py-6 pb-28 md:px-8 md:pb-10">
            {children}
          </main>
        </div>

        {/* Нижняя навигация (телефон) */}
        <nav className="fixed inset-x-4 bottom-3 z-20 flex justify-around rounded-full border border-line bg-white/95 p-1.5 shadow-lg backdrop-blur md:hidden">
          {items
            .filter((it) => !it.soon)
            .map((it) => {
              const active = pathname === it.href;
              const Icon = it.icon;
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  aria-label={it.label}
                  className={`relative grid h-11 w-11 place-items-center rounded-full transition ${
                    active
                      ? "bg-linear-to-r from-brand to-brand-strong text-white"
                      : "text-muted"
                  }`}
                >
                  {it.avatar ? (
                    <span className={`rounded-full ${active ? "ring-2 ring-white" : ""}`}>
                      <Avatar url={me.avatar_url} name={name} size={26} />
                    </span>
                  ) : (
                    <Icon size={22} />
                  )}
                  {!!it.badge && (
                    <span className="absolute right-0 top-0 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  )}
                </Link>
              );
            })}
        </nav>
      </div>
    </MeContext.Provider>
  );
}
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, User, MessageCircle, Gift, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import Logo from "@/components/Logo";
import { Me, MeContext } from "@/components/MeContext";

type Item = { href: string; label: string; icon: LucideIcon; soon?: boolean };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);

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

  const items: Item[] = [
    { href: "/feed", label: "Лента", icon: Home },
    { href: `/u/${me.username}`, label: "Профиль", icon: User },
    { href: "#", label: "Чаты", icon: MessageCircle, soon: true },
    { href: "#", label: "Подарки", icon: Gift, soon: true },
  ];

  const name = me.display_name || me.username;

  return (
    <MeContext.Provider value={{ me, refresh }}>
      <div className="min-h-screen bg-canvas text-ink md:flex">
        {/* Боковое меню (компьютер) */}
        <aside className="hidden md:flex md:w-64 shrink-0 flex-col justify-between sticky top-0 h-screen border-r border-line bg-white p-4">
          <div>
            <Link href="/feed" className="flex items-center gap-2 px-2 py-3 mb-4">
              <Logo size={36} />
              <span className="text-xl font-bold tracking-tight">Fabrictura</span>
            </Link>

            <nav className="space-y-1">
              {items.map(({ href, label, icon: Icon, soon }) => {
                const active = !soon && pathname === href;
                const cls = `flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition ${
                  active ? "bg-brand-soft text-brand-strong" : "hover:bg-canvas"
                } ${soon ? "opacity-50 cursor-default" : ""}`;
                return soon ? (
                  <div key={label} className={cls}>
                    <Icon size={20} />
                    {label}
                    <span className="ml-auto text-[10px] uppercase tracking-wide bg-canvas text-muted rounded-full px-2 py-0.5">
                      скоро
                    </span>
                  </div>
                ) : (
                  <Link key={label} href={href} className={cls}>
                    <Icon size={20} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <Avatar url={me.avatar_url} name={name} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-muted">@{me.username}</p>
            </div>
            <button
              onClick={logout}
              aria-label="Выйти"
              className="text-muted hover:text-red-500 transition"
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Верхняя полоса (телефон) */}
          <header className="md:hidden sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur border-b border-line px-4 py-3">
            <span className="flex items-center gap-2 font-bold">
              <Logo size={32} />
              Fabrictura
            </span>
            <button onClick={logout} aria-label="Выйти" className="text-muted">
              <LogOut size={20} />
            </button>
          </header>

          <main className="max-w-xl mx-auto p-4 pb-24 md:pb-8">{children}</main>
        </div>

        {/* Нижнее меню (телефон) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 flex justify-around bg-white border-t border-line py-2">
          {items.map(({ href, label, icon: Icon, soon }) => {
            const active = !soon && pathname === href;
            const cls = `flex flex-col items-center gap-0.5 text-[11px] font-medium ${
              active ? "text-brand-strong" : "text-muted"
            } ${soon ? "opacity-40" : ""}`;
            return soon ? (
              <div key={label} className={cls}>
                <Icon size={22} />
                {label}
              </div>
            ) : (
              <Link key={label} href={href} className={cls}>
                <Icon size={22} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </MeContext.Provider>
  );
}
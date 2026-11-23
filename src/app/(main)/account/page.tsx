"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, DoorOpen, Lock, Palette, Settings, ShieldCheck, User, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";

const PILL =
  "flex w-full items-center gap-3 rounded-full border border-line bg-white px-5 py-3.5 text-left transition hover:bg-brand-soft active:scale-[0.99]";

export default function AccountPage() {
  const { me, isAdmin } = useMe();
  const router = useRouter();
  const name = me.display_name || me.username;

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const rows: { label: string; icon: LucideIcon; href: string }[] = [
    { label: "Профиль", icon: User, href: `/u/${me.username}` },
    { label: "Аккаунт", icon: AtSign, href: "/account/info" },
    { label: "Оформление", icon: Palette, href: "/account/appearance" },
    { label: "Кошелёк", icon: Wallet, href: "/account/wallet" },
    { label: "Настройки", icon: Settings, href: "/account/settings" },
    { label: "Безопасность", icon: Lock, href: "/account/security" },
    ...(isAdmin ? [{ label: "Админка", icon: ShieldCheck, href: "/admin" }] : []),
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col items-center rounded-xl border border-line bg-white px-6 py-8 text-center">
        <Avatar url={me.avatar_url} name={name} size={96} />
        <h1 className="mt-3 text-xl font-bold">{name}</h1>
        <p className="text-muted">@{me.username}</p>
      </section>

      <nav className="flex flex-col gap-2">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.label} href={r.href} className={PILL}>
              <Icon size={20} className="shrink-0 text-muted" />
              {r.label}
            </Link>
          );
        })}
      </nav>

      <button onClick={logout} className={`${PILL} text-muted hover:text-ink`}>
        <DoorOpen size={20} className="shrink-0" />
        Выйти
      </button>
    </div>
  );
}
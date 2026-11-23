"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { USERNAME_HINT, UsernameStatus } from "@/lib/username";

export function PageHead({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        aria-label="Назад"
        className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink md:hidden"
      >
        <ArrowLeft size={20} />
      </Link>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  );
}

const TABS = [
  { href: "/account/info", label: "Аккаунт" },
  { href: "/account/appearance", label: "Оформление" },
  { href: "/account/security", label: "Безопасность" },
];

export function EditTabs() {
  const pathname = usePathname();
  return (
    <div className="hidden gap-2 md:flex">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            pathname.startsWith(t.href)
              ? "bg-ink text-white"
              : "border border-line bg-white hover:bg-brand-soft"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function SoonRow({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3.5 opacity-60">
      <div className="min-w-0">
        <p>{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
        скоро
      </span>
    </div>
  );
}

export function StatusLine({ status, same }: { status: UsernameStatus; same: React.ReactNode }) {
  let node: React.ReactNode;
  if (status === "same") node = same;
  else if (status === "empty") node = <span className="text-muted">{USERNAME_HINT}</span>;
  else if (status === "invalid") node = <span className="text-red-500">{USERNAME_HINT}</span>;
  else if (status === "checking") node = <span className="text-muted">Проверяем...</span>;
  else if (status === "taken") node = <span className="text-red-500">Юзернейм занят</span>;
  else node = <span className="text-green-600">Юзернейм свободен</span>;
  return <p className="mt-1.5 min-h-5 px-1 text-xs">{node}</p>;
}
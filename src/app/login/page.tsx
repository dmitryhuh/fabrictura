"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AuthLayout from "@/components/AuthLayout";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const result = await res.json();

    if (!res.ok) {
      setLoading(false);
      setError(result.error ?? "Ошибка входа");
      return;
    }

    await supabase.auth.setSession({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
    });

    setLoading(false);
    router.push("/feed");
  }

  return (
    <AuthLayout title="С возвращением" subtitle="Войдите в свой аккаунт">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          placeholder="Почта или логин"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Входим..." : "Войти"}
        </button>

        <p className="text-muted text-sm text-center">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-brand-strong font-medium">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
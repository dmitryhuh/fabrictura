"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import OtpForm from "@/components/OtpForm";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

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
      if (result.needConfirm && result.email) {
        setConfirmEmail(result.email);
        return;
      }
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

  if (confirmEmail) {
    return (
      <AuthLayout>
        <OtpForm
          email={confirmEmail}
          autoSend
          onDone={() => router.push("/feed")}
          onBack={() => setConfirmEmail(null)}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Вход">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          placeholder="Почта или логин"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Входим..." : "Войти"}
        </button>

        <p className="text-center text-sm text-muted">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-brand-strong">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
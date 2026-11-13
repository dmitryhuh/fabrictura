"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import AuthLayout from "@/components/AuthLayout";

function friendlyError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("rate limit"))
    return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (m.includes("already registered")) return "Эта почта уже зарегистрирована.";
  if (m.includes("signups are disabled"))
    return "Регистрация выключена в настройках Supabase.";
  if (m.includes("password"))
    return "Пароль слишком простой или короткий (минимум 6 символов).";
  return msg;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    const name = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) {
      setError("Логин: 3–20 символов, только латиница, цифры и _");
      return;
    }

    setLoading(true);

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", name)
      .maybeSingle();
    if (taken) {
      setLoading(false);
      setError("Этот логин уже занят");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: name } },
    });
    setLoading(false);

    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    if (!data.session) {
      setInfo("Мы отправили письмо для подтверждения. Перейдите по ссылке из него и войдите.");
      return;
    }
    router.push("/feed");
  }

  return (
    <AuthLayout title="Создайте аккаунт" subtitle="Это займёт меньше минуты">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="input"
          placeholder="Логин (латиница, 3–20)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="input"
          type="email"
          placeholder="Почта"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Пароль (минимум 6 символов)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {info && <p className="text-brand-strong text-sm">{info}</p>}

        <button disabled={loading} className="btn-primary w-full py-3">
          {loading ? "Создаём..." : "Зарегистрироваться"}
        </button>

        <p className="text-muted text-sm text-center">
          Уже есть аккаунт?{" "}
          <Link href="/login" className="text-brand-strong font-medium">
            Войти
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
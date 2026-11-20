// ПУТЬ: src/app/register/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import AuthLayout from "@/components/AuthLayout";
import PasswordInput from "@/components/PasswordInput";
import BirthDatePicker from "@/components/BirthDatePicker";
import OtpForm from "@/components/OtpForm";
import { birthError } from "@/lib/birthday";
import { USERNAME_HINT, USERNAME_RE } from "@/lib/username";


function friendlyError(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("rate limit"))
    return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (m.includes("already registered")) return "Эта почта уже зарегистрирована.";
  if (m.includes("not authorized"))
    return "Письма пока уходят только владельцам проекта. Подключите SMTP в Supabase.";
  if (m.includes("signups are disabled"))
    return "Регистрация выключена в настройках Supabase.";
  if (m.includes("database error"))
    return "Не удалось создать профиль. Проверьте дату рождения и логин.";
  if (m.includes("password"))
    return "Пароль слишком простой или короткий (минимум 6 символов).";
  return msg;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birth, setBirth] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [check, setCheck] = useState<{ name: string; taken: boolean } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // проверка занятости логина прямо во время ввода
  useEffect(() => {
    if (!USERNAME_RE.test(username)) return;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      setCheck({ name: username, taken: !!data });
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  function go(next: number) {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setError("");
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    go(1);
  }

  function skipName() {
    setFirstName("");
    setLastName("");
    go(1);
  }

  function submitBirth(e: React.FormEvent) {
    e.preventDefault();
    const problem = birth ? birthError(birth) : "Выберите дату рождения";
    if (problem) {
      setError(problem);
      return;
    }
    go(2);
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!USERNAME_RE.test(username)) {
      setError(`Логин: ${USERNAME_HINT}`);
      return;
    }

    setLoading(true);

    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (taken) {
      setLoading(false);
      setError("Этот логин уже занят");
      return;
    }

    const displayName = [firstName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(" ")
      .slice(0, 30);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName, birth_date: birth },
      },
    });
    setLoading(false);

    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    // подтверждение почты выключено: сессия уже есть
    if (data.session) {
      router.push("/feed");
      return;
    }
    // почта уже занята подтверждённым аккаунтом
    if (data.user && data.user.identities?.length === 0) {
      setError("Эта почта уже зарегистрирована. Войдите в аккаунт.");
      return;
    }
    go(3);
  }

  const usernameValid = USERNAME_RE.test(username);
  let usernameHint: React.ReactNode = null;
  if (username && !usernameValid) {
    usernameHint = <span className="text-muted">{USERNAME_HINT}</span>;
  } else if (usernameValid && check?.name === username) {
    usernameHint = check.taken ? (
      <span className="text-red-500">Логин занят</span>
    ) : (
      <span className="text-green-600">Логин свободен</span>
    );
  }

  return (
    <AuthLayout>
      {/* точки прогресса */}
      <div className="mb-6 flex justify-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-8 bg-brand-strong" : i < step ? "w-4 bg-brand" : "w-4 bg-line"
            }`}
          />
        ))}
      </div>

      <div key={step} className={dir === 1 ? "step-forward" : "step-back"}>
        {step === 0 && (
          <form onSubmit={submitName} className="space-y-4">
            <h1 className="text-center text-xl font-bold">Как вас зовут?</h1>
            <input
              className="input"
              placeholder="Имя"
              maxLength={15}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Фамилия"
              maxLength={15}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            <button className="btn-primary w-full py-3">Далее</button>
            <button type="button" onClick={skipName} className="btn-ghost w-full py-3">
              Пропустить
            </button>
            <p className="text-center text-sm text-muted">
              Уже есть аккаунт?{" "}
              <Link href="/login" className="font-medium text-brand-strong">
                Войти
              </Link>
            </p>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={submitBirth} className="space-y-4">
            <h1 className="text-center text-xl font-bold">Когда вы родились?</h1>
            <BirthDatePicker value={birth} onChange={setBirth} />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button className="btn-primary w-full py-3">Далее</button>
            <button
              type="button"
              onClick={() => go(0)}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted hover:text-ink"
            >
              <ArrowLeft size={16} /> Назад
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitAccount} className="space-y-4">
            <h1 className="text-center text-xl font-bold">Данные для входа</h1>
            <div>
              <input
                className="input"
                placeholder="Логин"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                required
              />
              <p className="mt-1.5 min-h-5 px-1 text-xs">{usernameHint}</p>
            </div>
            <input
              className="input"
              type="email"
              placeholder="Почта"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder="Пароль (минимум 6 символов)"
              autoComplete="new-password"
              minLength={6}
            />

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button disabled={loading} className="btn-primary w-full py-3">
              {loading ? "Создаём..." : "Создать аккаунт"}
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted hover:text-ink"
            >
              <ArrowLeft size={16} /> Назад
            </button>
          </form>
        )}

        {step === 3 && (
          <OtpForm
            email={email}
            onDone={() => router.push("/feed")}
            onBack={() => go(2)}
          />
        )}
      </div>
    </AuthLayout>
  );
}
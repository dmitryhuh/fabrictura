"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const LENGTH = 6;
const COOLDOWN = 60;

function friendly(msg: string) {
  const m = msg.toLowerCase();
  if (m.includes("only request this after"))
    return "Код уже отправлен недавно. Проверьте почту или подождите минуту.";
  if (m.includes("rate limit")) return "Слишком много попыток. Подождите немного.";
  if (m.includes("expired") || m.includes("invalid")) return "Неверный или просроченный код";
  return msg;
}

type Props = {
  email: string;
  autoSend?: boolean; // отправить новый код сразу при открытии (вход без подтверждённой почты)
  onDone: () => void;
  onBack?: () => void;
};

export default function OtpForm({ email, autoSend = false, onDone, onBack }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(COOLDOWN);
  const sent = useRef(false);
  const lastTried = useRef("");

  useEffect(() => {
    if (!autoSend || sent.current) return;
    sent.current = true;
    supabase.auth.resend({ type: "signup", email }).then(({ error }) => {
      if (error) setError(friendly(error.message));
      else setInfo("Мы отправили новый код на почту");
    });
  }, [autoSend, email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = useCallback(
    async (token: string) => {
      setLoading(true);
      setError("");
      setInfo("");
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      setLoading(false);
      if (error) {
        lastTried.current = "";
        setCode("");
        setError(friendly(error.message));
        return;
      }
      onDone();
    },
    [email, onDone]
  );

  useEffect(() => {
    if (code.length === LENGTH && lastTried.current !== code) {
      lastTried.current = code;
      verify(code);
    }
  }, [code, verify]);

  async function resend() {
    setError("");
    setInfo("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setError(friendly(error.message));
      return;
    }
    setInfo("Новый код отправлен");
    setCooldown(COOLDOWN);
  }

  return (
    <div className="space-y-5 text-center">
      <div>
        <h1 className="text-xl font-bold">Введите код из письма</h1>
        <p className="mt-2 text-sm text-muted">
          Мы отправили {LENGTH}-значный код на <b className="text-ink">{email}</b>
        </p>
      </div>

      <div className="relative">
        <div className="flex justify-center gap-2">
          {Array.from({ length: LENGTH }, (_, i) => (
            <div
              key={i}
              className={`grid h-14 w-11 place-items-center rounded-xl border bg-white text-2xl font-bold transition ${
                i === Math.min(code.length, LENGTH - 1)
                  ? "border-brand ring-4 ring-brand-soft"
                  : "border-line"
              }`}
            >
              {code[i] ?? ""}
            </div>
          ))}
        </div>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          value={code}
          disabled={loading}
          aria-label="Код из письма"
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, LENGTH))}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>

      {loading && <p className="text-sm text-muted">Проверяем...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {info && <p className="text-sm text-brand-strong">{info}</p>}

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="btn-ghost w-full py-3 disabled:opacity-50"
      >
        {cooldown > 0 ? `Отправить ещё раз (${cooldown})` : "Отправить код ещё раз"}
      </button>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Назад
        </button>
      )}

      <p className="text-xs text-muted">Письмо не пришло? Загляните в папку «Спам».</p>
    </div>
  );
}
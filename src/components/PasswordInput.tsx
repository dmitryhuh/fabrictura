"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
};

export default function PasswordInput({
  value,
  onChange,
  placeholder = "Пароль",
  autoComplete,
  minLength,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        className="input pr-12"
        type={show ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
}
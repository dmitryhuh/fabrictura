import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export const USERNAME_RE = /^[a-z_][a-z0-9_]{3,19}$/;

export const USERNAME_HINT = "4–20 символов: латиница, цифры, _. Не может начинаться с цифры";

export const MAX_ALIASES = 5;

export async function isUsernameTaken(name: string): Promise<boolean> {
  const [p, a] = await Promise.all([
    supabase.from("profiles").select("id").eq("username", name).maybeSingle(),
    supabase.from("profile_aliases").select("alias").eq("alias", name).maybeSingle(),
  ]);
  return !!p.data || !!a.data;
}

export type UsernameStatus = "empty" | "same" | "invalid" | "checking" | "taken" | "free";

export function useUsernameStatus(name: string, own: string[]): UsernameStatus {
  const [check, setCheck] = useState<{ name: string; taken: boolean } | null>(null);
  const isOwn = own.includes(name);
  const valid = USERNAME_RE.test(name);

  useEffect(() => {
    if (!name || isOwn || !valid) return;
    const t = setTimeout(async () => {
      setCheck({ name, taken: await isUsernameTaken(name) });
    }, 400);
    return () => clearTimeout(t);
  }, [name, isOwn, valid]);

  if (!name) return "empty";
  if (isOwn) return "same";
  if (!valid) return "invalid";
  if (check?.name !== name) return "checking";
  return check.taken ? "taken" : "free";
}
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const WINDOW_MIN = 10;
const MAX_PER_LOGIN = 5;
const MAX_PER_IP = 30;

export async function POST(req: Request) {
  const { identifier, password } = await req.json();

  if (!identifier || !password) {
    return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const loginKey = `login:${String(identifier).trim().toLowerCase()}`;
  const ipKey = `ip:${ip}`;
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();

  async function countFails(key: string) {
    const { count } = await admin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("key", key)
      .gte("created_at", since);
    return count ?? 0;
  }

  const [byLogin, byIp] = await Promise.all([countFails(loginKey), countFails(ipKey)]);
  if (byLogin >= MAX_PER_LOGIN || byIp >= MAX_PER_IP) {
    return NextResponse.json(
      { error: `Слишком много попыток. Попробуйте через ${WINDOW_MIN} минут.` },
      { status: 429 }
    );
  }

  const fail = async () => {
    await admin.from("login_attempts").insert([{ key: loginKey }, { key: ipKey }]);
    // заодно чистим старые записи
    await admin
      .from("login_attempts")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    // одно и то же сообщение, чтобы нельзя было угадывать существующие логины
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  };

  let email = String(identifier).trim();

  // если это не почта, ищем почту по логину
  if (!email.includes("@")) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", email.toLowerCase())
      .maybeSingle();
    if (!profile) return fail();

    const { data } = await admin.auth.admin.getUserById(profile.id);
    email = data.user?.email ?? "";
    if (!email) return fail();
  }

  const { data, error } = await anon.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("not confirmed")) {
      return NextResponse.json(
        { error: "Почта не подтверждена", needConfirm: true, email },
        { status: 403 }
      );
    }
    return fail();
  }

  if (!data.session) return fail();

  await admin.from("login_attempts").delete().eq("key", loginKey);

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
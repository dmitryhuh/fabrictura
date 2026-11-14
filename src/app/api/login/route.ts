import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

  const fail = () =>
    // одно и то же сообщение, чтобы нельзя было угадывать существующие логины
    NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });

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

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
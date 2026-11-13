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

  let email: string = String(identifier).trim();

  // если это не почта, ищем почту по логину
  if (!email.includes("@")) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("username", email)
      .maybeSingle();

    if (profile) {
      const { data } = await admin.auth.admin.getUserById(profile.id);
      email = data.user?.email ?? "";
    } else {
      email = "";
    }
  }

  const { data, error } = email
    ? await anon.auth.signInWithPassword({ email, password })
    : { data: null, error: true };

  if (error || !data?.session) {
    // одно и то же сообщение, чтобы нельзя было угадывать существующие логины
    return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
  }

  return NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
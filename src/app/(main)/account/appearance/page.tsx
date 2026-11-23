"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import { EditTabs, PageHead, SoonRow } from "@/components/AccountUi";
import { checkImage, compressImage, imageExt } from "@/lib/images";

type Kind = "avatars" | "covers";
const CFG = {
  avatars: { col: "avatar_url", side: 512, maxMb: 2 },
  covers: { col: "cover_url", side: 1500, maxMb: 3 },
} as const;

export default function AppearancePage() {
  const { me, refresh } = useMe();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const name = me.display_name || me.username;

  useEffect(() => {
    supabase
      .from("profiles")
      .select("avatar_url, cover_url")
      .eq("id", me.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAvatar(data.avatar_url);
          setCover(data.cover_url);
        }
      });
  }, [me.id]);

  async function upload(kind: Kind, file: File) {
    setError("");
    const cfg = CFG[kind];
    const problem = checkImage(file, 20);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(kind);
    try {
      let small: File;
      try {
        small = await compressImage(file, cfg.side);
      } catch {
        setError("Не удалось обработать картинку");
        return;
      }
      const tooBig = checkImage(small, cfg.maxMb);
      if (tooBig) {
        setError(tooBig);
        return;
      }

      const oldUrl = kind === "avatars" ? avatar : cover;
      const path = `${me.id}/${Date.now()}.${imageExt(small.type)}`;
      const { error: upErr } = await supabase.storage
        .from(kind)
        .upload(path, small, { contentType: small.type });
      if (upErr) {
        setError(upErr.message);
        return;
      }

      const url = supabase.storage.from(kind).getPublicUrl(path).data.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ [cfg.col]: url })
        .eq("id", me.id);
      if (dbErr) {
        await supabase.storage.from(kind).remove([path]);
        setError(dbErr.message);
        return;
      }

      if (oldUrl) {
        const marker = `/${kind}/`;
        const i = oldUrl.indexOf(marker);
        if (i !== -1) await supabase.storage.from(kind).remove([oldUrl.slice(i + marker.length)]);
      }

      if (kind === "avatars") {
        setAvatar(url);
        await refresh();
      } else {
        setCover(url);
      }
    } finally {
      setBusy(null);
    }
  }

  const camBtn =
    "grid h-9 w-9 place-items-center rounded-full text-white transition disabled:opacity-50";

  return (
    <div className="space-y-4">
      <PageHead title="Оформление" />
      <EditTabs />

      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="relative h-36 bg-linear-to-r from-brand to-brand-deep sm:h-48">
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
          <button
            onClick={() => coverRef.current?.click()}
            disabled={busy !== null}
            aria-label="Сменить баннер"
            className={`${camBtn} absolute bottom-3 right-3 bg-black/55 hover:bg-black/75`}
          >
            <Camera size={17} />
          </button>
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload("covers", f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-14 w-fit">
            <div className="relative">
              <div className="rounded-full ring-4 ring-white">
                <Avatar url={avatar} name={name} size={112} />
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={busy !== null}
                aria-label="Сменить аватарку"
                className={`${camBtn} absolute bottom-1 right-1 bg-ink ring-2 ring-white hover:bg-brand-hover`}
              >
                <Camera size={17} />
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload("avatars", f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">
            {busy ? "Загружаем..." : "Нажмите на камеру, чтобы сменить аватарку или баннер."}
          </p>
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
      </section>

      <SoonRow label="Цвет аккаунта" hint="Фирменный цвет вашего профиля" />
    </div>
  );
}
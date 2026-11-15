"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera, Cake } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import BirthDatePicker from "@/components/BirthDatePicker";
import { Post, RawPost, POST_SELECT, withLiked } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";
import { checkImage, compressImage, imageExt } from "@/lib/images";
import { birthError, formatBirth } from "@/lib/birthday";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { me, refresh } = useMe();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [birthInput, setBirthInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio, birth_date")
      .eq("username", username)
      .maybeSingle();

    if (!p) {
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setProfile(p);

    const [a, b, c, d] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", me.id)
        .eq("following_id", p.id),
      supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("author_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    setFollowers(a.count ?? 0);
    setFollowing(b.count ?? 0);
    setIsFollowing((c.count ?? 0) > 0);
    setPosts(await withLiked((d.data ?? []) as unknown as RawPost[], me.id));
  }, [username, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const { toggleLike, removePost } = usePostActions(me.id, setPosts, load, setError);

  async function toggleFollow() {
    if (!profile) return;
    if (isFollowing) {
      setIsFollowing(false);
      setFollowers((n) => n - 1);
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", me.id)
        .eq("following_id", profile.id);
      if (error) load();
    } else {
      setIsFollowing(true);
      setFollowers((n) => n + 1);
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: me.id, following_id: profile.id });
      if (error) load();
    }
  }

  function startEdit() {
    setUserInput(profile?.username ?? "");
    setNameInput(profile?.display_name ?? "");
    setBioInput(profile?.bio ?? "");
    setBirthInput(profile?.birth_date ?? "");
    setError("");
    setEditing(true);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const newName = userInput.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(newName)) {
      setError("Логин: 3–20 символов, латиница, цифры и _");
      return;
    }
    if (birthInput) {
      const problem = birthError(birthInput);
      if (problem) {
        setError(problem);
        return;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        username: newName,
        display_name: nameInput.trim() || null,
        bio: bioInput.trim() || null,
        birth_date: birthInput || null,
      })
      .eq("id", me.id);
    setSaving(false);

    if (error) {
      if (error.code === "23505") setError("Этот логин уже занят");
      else if (error.message.includes("profiles_birth_check"))
        setError("Недопустимая дата рождения");
      else setError(error.message);
      return;
    }

    setEditing(false);
    await refresh();
    if (newName !== profile?.username) router.replace(`/u/${newName}`);
    else await load();
  }

  async function uploadAvatar(file: File) {
    setError("");
    const problem = checkImage(file, 20);
    if (problem) {
      setError(problem);
      return;
    }

    let small: File;
    try {
      small = await compressImage(file, 512);
    } catch {
      setError("Не удалось обработать картинку");
      return;
    }
    const tooBig = checkImage(small, 2);
    if (tooBig) {
      setError(tooBig);
      return;
    }

    const oldUrl = profile?.avatar_url;
    const path = `${me.id}/${Date.now()}.${imageExt(small.type)}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, small, { contentType: small.type });
    if (upErr) {
      setError(upErr.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", me.id);
    if (error) {
      await supabase.storage.from("avatars").remove([path]);
      setError(error.message);
      return;
    }

    // старую аватарку удаляем, чтобы не копились файлы
    if (oldUrl) {
      const marker = "/avatars/";
      const i = oldUrl.indexOf(marker);
      if (i !== -1) {
        await supabase.storage.from("avatars").remove([oldUrl.slice(i + marker.length)]);
      }
    }

    await Promise.all([load(), refresh()]);
  }

  if (notFound) {
    return <p className="py-16 text-center text-muted">Такого пользователя нет.</p>;
  }
  if (!profile) {
    return <p className="py-16 text-center text-muted">Загрузка...</p>;
  }

  const isMe = profile.id === me.id;
  const name = profile.display_name || profile.username;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
        <div className="h-36 bg-linear-to-r from-brand to-brand-deep" />

        <div className="px-6 pb-6">
          <div className="-mt-14 flex items-end justify-between">
            <div className="relative">
              <div className="rounded-full ring-4 ring-white">
                <Avatar url={profile.avatar_url} name={name} size={112} />
              </div>
              {isMe && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    aria-label="Сменить аватарку"
                    className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-brand-strong text-white ring-2 ring-white hover:bg-brand-hover"
                  >
                    <Camera size={17} />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadAvatar(f);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>

            {isMe ? (
              !editing && (
                <button onClick={startEdit} className="btn-ghost">
                  Редактировать
                </button>
              )
            ) : (
              <button onClick={toggleFollow} className={isFollowing ? "btn-ghost" : "btn-primary"}>
                {isFollowing ? "Вы подписаны" : "Подписаться"}
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={saveProfile} className="mt-5 space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                <input
                  className="input pl-9"
                  maxLength={20}
                  placeholder="Логин"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value.toLowerCase().replace(/\s/g, ""))}
                />
              </div>
              <input
                className="input"
                maxLength={30}
                placeholder="Имя (до 30 символов)"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
              />
              <textarea
                className="input resize-none"
                rows={3}
                maxLength={160}
                placeholder="О себе (до 160 символов)"
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
              />
              <BirthDatePicker value={birthInput} onChange={setBirthInput} />

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button disabled={saving} className="btn-primary">
                  {saving ? "Сохраняем..." : "Сохранить"}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4">
              <h1 className="text-2xl font-bold">{name}</h1>
              <p className="text-muted">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-3 whitespace-pre-wrap text-[17px]">{profile.bio}</p>
              )}
              {profile.birth_date && (
                <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
                  <Cake size={16} />
                  {formatBirth(profile.birth_date)}
                </p>
              )}
              <p className="mt-4 text-sm text-muted">
                <b className="text-ink">{followers}</b> подписчиков ·{" "}
                <b className="text-ink">{following}</b> подписок ·{" "}
                <b className="text-ink">{posts.length}</b> постов
              </p>
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            </div>
          )}
        </div>
      </section>

      {posts.length === 0 && <p className="py-8 text-center text-muted">Постов пока нет.</p>}

      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          myId={me.id}
          onLike={toggleLike}
          onDelete={removePost}
        />
      ))}
    </div>
  );
}
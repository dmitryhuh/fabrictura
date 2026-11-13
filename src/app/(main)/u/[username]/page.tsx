"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Camera } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import { Post, POST_SELECT } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { me, refresh } = useMe();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
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
    setPosts((d.data ?? []) as unknown as Post[]);
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
    setNameInput(profile?.display_name ?? "");
    setBioInput(profile?.bio ?? "");
    setError("");
    setEditing(true);
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: nameInput.trim() || null,
        bio: bioInput.trim() || null,
      })
      .eq("id", me.id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEditing(false);
    await Promise.all([load(), refresh()]);
  }

  async function uploadAvatar(file: File) {
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Нужна картинка JPG, PNG или WebP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Файл больше 2 МБ");
      return;
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${me.id}/${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type });
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
      setError(error.message);
      return;
    }
    await Promise.all([load(), refresh()]);
  }

  if (notFound) {
    return <p className="text-center text-muted py-16">Такого пользователя нет.</p>;
  }
  if (!profile) {
    return <p className="text-center text-muted py-16">Загрузка...</p>;
  }

  const isMe = profile.id === me.id;
  const name = profile.display_name || profile.username;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-line rounded-2xl overflow-hidden shadow-sm">
        <div className="h-28 bg-linear-to-r from-brand to-brand-deep" />

        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-12">
            <div className="relative">
              <div className="rounded-full ring-4 ring-white">
                <Avatar url={profile.avatar_url} name={name} size={96} />
              </div>
              {isMe && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    aria-label="Сменить аватарку"
                    className="absolute bottom-0 right-0 grid place-items-center w-8 h-8 rounded-full bg-brand-strong text-white ring-2 ring-white hover:bg-brand-hover"
                  >
                    <Camera size={16} />
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
              <button
                onClick={toggleFollow}
                className={isFollowing ? "btn-ghost" : "btn-primary"}
              >
                {isFollowing ? "Вы подписаны" : "Подписаться"}
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={saveProfile} className="mt-4 space-y-3">
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
            <div className="mt-3">
              <h1 className="text-xl font-bold">{name}</h1>
              <p className="text-muted text-sm">@{profile.username}</p>
              {profile.bio && <p className="mt-3 whitespace-pre-wrap">{profile.bio}</p>}
              <p className="mt-4 text-sm text-muted">
                <b className="text-ink">{followers}</b> подписчиков ·{" "}
                <b className="text-ink">{following}</b> подписок ·{" "}
                <b className="text-ink">{posts.length}</b> постов
              </p>
            </div>
          )}

          {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
        </div>
      </section>

      {posts.length === 0 && (
        <p className="text-center text-muted py-8">Постов пока нет.</p>
      )}

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
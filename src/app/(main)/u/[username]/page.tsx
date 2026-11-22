// ПУТЬ: src/app/(main)/u/[username]/page.tsx
"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera, Cake, EyeOff, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import BirthDatePicker from "@/components/BirthDatePicker";
import EmojiButton, { insertEmoji } from "@/components/EmojiButton";
import { Post, RawPost, POST_SELECT, withLiked } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";
import { checkImage, compressImage, imageExt } from "@/lib/images";
import { birthError, formatBirth } from "@/lib/birthday";
import {
  MAX_ALIASES,
  USERNAME_HINT,
  USERNAME_RE,
  UsernameStatus,
  useUsernameStatus,
} from "@/lib/username";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  birth_date: string | null;
};

// одинаковый размер кнопок рядом с аватаркой
const SIDE_BTN = "h-10 w-36 !px-0 !py-0 !text-sm";

const LABEL = "block px-1 text-xs font-semibold uppercase tracking-wide text-muted";

// подсказка под полем юзернейма: правила по умолчанию, затем красная или зелёная проверка
function StatusLine({ status, same }: { status: UsernameStatus; same: React.ReactNode }) {
  let node: React.ReactNode;
  if (status === "same") node = same;
  else if (status === "empty") node = <span className="text-muted">{USERNAME_HINT}</span>;
  else if (status === "invalid") node = <span className="text-red-500">{USERNAME_HINT}</span>;
  else if (status === "checking") node = <span className="text-muted">Проверяем...</span>;
  else if (status === "taken") node = <span className="text-red-500">Юзернейм занят</span>;
  else node = <span className="text-green-600">Юзернейм свободен</span>;
  return <p className="mt-1.5 min-h-5 px-1 text-xs">{node}</p>;
}

type Tab = "posts" | "reposts" | "saved";

async function fromJoin(data: unknown, myId: string): Promise<Post[]> {
  const rows = ((data ?? []) as { post: RawPost | null }[])
    .map((r) => r.post)
    .filter((p): p is RawPost => !!p);
  return withLiked(rows, myId);
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { me, refresh } = useMe();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  const [saved, setSaved] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("posts");
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [aliases, setAliases] = useState<string[]>([]);
  const [aliasList, setAliasList] = useState<string[]>([]);
  const [aliasDraft, setAliasDraft] = useState("");
  const [userInput, setUserInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [birthInput, setBirthInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const mainName = userInput.trim().toLowerCase();
  const mainStatus = useUsernameStatus(mainName, [profile?.username ?? ""]);
  const aliasStatus = useUsernameStatus(aliasDraft, [mainName, ...aliasList]);

  const load = useCallback(async () => {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, cover_url, bio, birth_date")
      .eq("username", username)
      .maybeSingle();

    if (!p) {
      // возможно, это дополнительный логин: ведём на профиль владельца
      const { data: al } = await supabase
        .from("profile_aliases")
        .select("profiles!user_id(username)")
        .eq("alias", username)
        .maybeSingle();
      const owner = (al as unknown as { profiles: { username: string } | null } | null)?.profiles
        ?.username;
      if (owner) {
        setProfile(null);
        router.replace(`/u/${owner}`);
        return;
      }
      setNotFound(true);
      return;
    }
    setNotFound(false);
    setProfile(p);

    const mine = p.id === me.id;
    const [a, b, c, d, e, f, g] = await Promise.all([
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
      supabase
        .from("reposts")
        .select(`created_at, post:posts(${POST_SELECT})`)
        .eq("user_id", p.id)
        .order("created_at", { ascending: false })
        .limit(50),
      mine
        ? supabase
            .from("bookmarks")
            .select(`created_at, post:posts(${POST_SELECT})`)
            .eq("user_id", me.id)
            .order("created_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] }),
      supabase.from("profile_aliases").select("alias").eq("user_id", p.id).order("created_at"),
    ]);

    setAliases((g.data ?? []).map((r) => r.alias));
    setFollowers(a.count ?? 0);
    setFollowing(b.count ?? 0);
    setIsFollowing((c.count ?? 0) > 0);
    setPosts(await withLiked((d.data ?? []) as unknown as RawPost[], me.id));
    setReposts(await fromJoin(e.data, me.id));
    setSaved(await fromJoin(f.data, me.id));
  }, [username, me.id, router]);

  useEffect(() => {
    load();
  }, [load]);

  // лайки и удаление меняют пост сразу во всех вкладках
  const setAll: Dispatch<SetStateAction<Post[]>> = useCallback((action) => {
    const apply = (prev: Post[]) => (typeof action === "function" ? action(prev) : action);
    setPosts(apply);
    setReposts(apply);
    setSaved(apply);
  }, []);

  const { toggleLike, toggleRepost, toggleBookmark, removePost, editPost } = usePostActions(
    me.id,
    setAll,
    load,
    setError
  );

  async function repost(p: Post) {
    await toggleRepost(p);
    load();
  }

  async function bookmark(p: Post) {
    await toggleBookmark(p);
    load();
  }

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
    setAliasList(aliases);
    setAliasDraft("");
    setError("");
    setEditing(true);
  }

  function addAlias() {
    const a = aliasDraft.trim().toLowerCase();
    if (!a) return;
    if (!USERNAME_RE.test(a)) {
      setError(`Юзернейм: ${USERNAME_HINT}`);
      return;
    }
    if (a === userInput.trim().toLowerCase()) {
      setError("Это ваш основной юзернейм");
      return;
    }
    if (aliasList.includes(a)) {
      setError("Этот юзернейм уже в списке");
      return;
    }
    if (aliasList.length >= MAX_ALIASES) {
      setError(`Не больше ${MAX_ALIASES} дополнительных юзернеймов`);
      return;
    }
    setError("");
    setAliasList((l) => [...l, a]);
    setAliasDraft("");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const newName = userInput.trim().toLowerCase();
    // старый логин не проверяем, правило действует только при смене
    if (newName !== profile?.username && !USERNAME_RE.test(newName)) {
      setError(`Юзернейм: ${USERNAME_HINT}`);
      return;
    }
    if (birthInput) {
      const problem = birthError(birthInput);
      if (problem) {
        setError(problem);
        return;
      }
    }

    if (aliasList.includes(newName)) {
      setError("Этот юзернейм уже в списке дополнительных, уберите его оттуда");
      return;
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
      if (error.code === "23505") setError("Этот юзернейм уже занят");
      else if (error.message.includes("username_invalid")) setError(`Юзернейм: ${USERNAME_HINT}`);
      else if (error.message.includes("profiles_birth_check"))
        setError("Недопустимая дата рождения");
      else setError(error.message);
      return;
    }

    // дополнительные логины: удаляем убранные, добавляем новые
    const toDelete = aliases.filter((a) => !aliasList.includes(a));
    const toAdd = aliasList.filter((a) => !aliases.includes(a));
    let aliasError = "";
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("profile_aliases")
        .delete()
        .eq("user_id", me.id)
        .in("alias", toDelete);
      if (delErr) aliasError = delErr.message;
    }
    if (!aliasError && toAdd.length > 0) {
      const { error: addErr } = await supabase
        .from("profile_aliases")
        .insert(toAdd.map((alias) => ({ alias, user_id: me.id })));
      if (addErr) {
        if (addErr.code === "23505") aliasError = "Один из дополнительных юзернеймов уже занят";
        else if (addErr.message.includes("alias_limit"))
          aliasError = `Не больше ${MAX_ALIASES} дополнительных юзернеймов`;
        else if (addErr.message.includes("alias_invalid"))
          aliasError = `Юзернейм: ${USERNAME_HINT}`;
        else aliasError = addErr.message;
      }
    }
    if (aliasError) {
      // остальное уже сохранено, показываем актуальный список и остаёмся в редактировании
      const { data: fresh } = await supabase
        .from("profile_aliases")
        .select("alias")
        .eq("user_id", me.id)
        .order("created_at");
      const list = (fresh ?? []).map((r) => r.alias);
      setAliases(list);
      setAliasList(list);
      setError(aliasError);
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

    if (oldUrl) {
      const marker = "/avatars/";
      const i = oldUrl.indexOf(marker);
      if (i !== -1) {
        await supabase.storage.from("avatars").remove([oldUrl.slice(i + marker.length)]);
      }
    }

    await Promise.all([load(), refresh()]);
  }

  async function openChat() {
    if (!profile) return;
    const { data, error } = await supabase.rpc("open_conversation", { other: profile.id });
    if (error || !data) {
      setError(error?.message ?? "Не удалось открыть чат");
      return;
    }
    router.push(`/messages/${data}`);
  }

  async function uploadCover(file: File) {
    setError("");
    const problem = checkImage(file, 20);
    if (problem) {
      setError(problem);
      return;
    }

    let small: File;
    try {
      small = await compressImage(file, 1500);
    } catch {
      setError("Не удалось обработать картинку");
      return;
    }
    const tooBig = checkImage(small, 3);
    if (tooBig) {
      setError(tooBig);
      return;
    }

    const oldUrl = profile?.cover_url;
    const path = `${me.id}/${Date.now()}.${imageExt(small.type)}`;
    const { error: upErr } = await supabase.storage
      .from("covers")
      .upload(path, small, { contentType: small.type });
    if (upErr) {
      setError(upErr.message);
      return;
    }

    const { data } = supabase.storage.from("covers").getPublicUrl(path);
    const { error } = await supabase
      .from("profiles")
      .update({ cover_url: data.publicUrl })
      .eq("id", me.id);
    if (error) {
      await supabase.storage.from("covers").remove([path]);
      setError(error.message);
      return;
    }

    if (oldUrl) {
      const marker = "/covers/";
      const i = oldUrl.indexOf(marker);
      if (i !== -1) {
        await supabase.storage.from("covers").remove([oldUrl.slice(i + marker.length)]);
      }
    }

    await load();
  }

  if (notFound) {
    return <p className="py-16 text-center text-muted">Такого пользователя нет.</p>;
  }
  if (!profile) {
    return <p className="py-16 text-center text-muted">Загрузка...</p>;
  }

  const isMe = profile.id === me.id;
  const name = profile.display_name || profile.username;

  const tabs: { key: Tab; label: string }[] = [
    { key: "posts", label: "Публикации" },
    { key: "reposts", label: "Репосты" },
    ...(isMe ? [{ key: "saved" as Tab, label: "Избранное" }] : []),
  ];
  const current = tab === "saved" && !isMe ? "posts" : tab;
  const list = current === "posts" ? posts : current === "reposts" ? reposts : saved;
  const emptyText =
    current === "posts"
      ? "Публикаций пока нет."
      : current === "reposts"
      ? "Репостов пока нет."
      : "Здесь будут посты, которые вы сохраните.";

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="relative h-36 bg-linear-to-r from-brand to-brand-deep sm:h-48">
          {profile.cover_url && (
            <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
          )}
          {isMe && editing && (
            <>
              <button
                onClick={() => coverRef.current?.click()}
                aria-label="Сменить обложку"
                className="absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
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
                  if (f) uploadCover(f);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-14 flex items-end justify-between">
            <div className="relative">
              <div className="rounded-full ring-4 ring-white">
                <Avatar url={profile.avatar_url} name={name} size={112} />
              </div>
              {isMe && editing && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    aria-label="Сменить аватарку"
                    className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full bg-ink text-white ring-2 ring-white hover:bg-brand-hover"
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <button onClick={openChat} className={`btn-ghost ${SIDE_BTN}`}>Написать</button>
                <button
                  onClick={toggleFollow}
                  className={`${isFollowing ? "btn-ghost" : "btn-primary"} ${SIDE_BTN}`}
                >
                  {isFollowing ? "Вы подписаны" : "Подписаться"}
                </button>
              </div>
            )}
        </div>
        
          {editing ? (
            <form onSubmit={saveProfile} className="mt-5 space-y-5">
              <h2 className="text-lg font-bold">Редактирование профиля</h2>

              <div className="space-y-1.5">
                <label htmlFor="edit-name" className={LABEL}>
                  Имя
                </label>
                <input
                  id="edit-name"
                  className="input"
                  maxLength={30}
                  placeholder="Как вас зовут"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="edit-username" className={LABEL}>
                  Юзернейм
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                  <input
                    id="edit-username"
                    className="input pl-9"
                    maxLength={20}
                    placeholder="Юзернейм"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  />
                </div>
                {aliasList.includes(mainName) ? (
                  <p className="mt-1.5 min-h-5 px-1 text-xs text-red-500">
                    Он есть в дополнительных, уберите его оттуда
                  </p>
                ) : (
                  <StatusLine
                    status={mainStatus}
                    same={<span className="text-muted">{USERNAME_HINT}</span>}
                  />
                )}
              </div>

              <div>
                <p className={LABEL}>
                  Дополнительные юзернеймы ({aliasList.length}/{MAX_ALIASES})
                </p>
                {aliasList.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aliasList.map((a) => (
                      <span
                        key={a}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1.5 text-sm"
                      >
                        @{a}
                        <button
                          type="button"
                          onClick={() => setAliasList((l) => l.filter((x) => x !== a))}
                          aria-label={`Удалить ${a}`}
                          className="grid h-5 w-5 place-items-center rounded-full text-muted transition hover:bg-white hover:text-ink"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {aliasList.length < MAX_ALIASES && (
                  <>
                    <div className="mt-2 flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                          @
                        </span>
                        <input
                          className="input pl-9"
                          maxLength={20}
                          placeholder="Новый юзернейм"
                          aria-label="Новый дополнительный юзернейм"
                          value={aliasDraft}
                          onChange={(e) =>
                            setAliasDraft(e.target.value.toLowerCase().replace(/\s/g, ""))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addAlias();
                            }
                          }}
                        />
                      </div>
                      <button type="button" onClick={addAlias} className="btn-ghost shrink-0">
                        Добавить
                      </button>
                    </div>
                    <StatusLine
                      status={aliasStatus}
                      same={<span className="text-red-500">Этот юзернейм уже у вас</span>}
                    />
                  </>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-end justify-between">
                  <label htmlFor="edit-bio" className={LABEL}>
                    О себе
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted">{bioInput.length}/160</span>
                    <EmojiButton
                      placement="bottom"
                      align="right"
                      buttonClassName="grid h-8 w-8 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
                      onPick={(emoji) => insertEmoji(bioRef.current, bioInput, emoji, 160, setBioInput)}
                    />
                  </div>
                </div>
                <textarea
                  id="edit-bio"
                  ref={bioRef}
                  className="input resize-none"
                  rows={3}
                  maxLength={160}
                  placeholder="Расскажите о себе"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <p className={LABEL}>Дата рождения</p>
                <BirthDatePicker value={birthInput} onChange={setBirthInput} />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <div className="flex gap-2">
                <button disabled={saving} className="btn-primary h-10 !px-6 !py-0 !text-sm">
                  {saving ? "Сохраняем..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-ghost h-10 !px-6 !py-0"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4">
              <h1 className="text-2xl font-bold">{name}</h1>
              <p className="text-muted">@{profile.username}</p>
              {aliases.length > 0 && (
                <p className="text-sm text-muted">
                  <span className="text-ink">а также:</span>{" "}
                  {aliases.map((a, i) => (
                    <span key={a}>
                      <span className="underline decoration-muted/60 underline-offset-2">@{a}</span>
                      {i < aliases.length - 1 && ", "}
                    </span>
                  ))}
                </p>
              )}
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

      <div className="flex justify-center gap-1 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-5 py-2.5 text-sm font-medium transition ${
              current === t.key
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.key === "saved" && <EyeOff size={15} />}
          </button>
        ))}
      </div>

      {current === "saved" && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted">
          <EyeOff size={15} /> Видно только вам
        </p>
      )}

      {list.length === 0 && <p className="py-8 text-center text-muted">{emptyText}</p>}

      {list.map((post) => (
        <PostCard
          key={`${current}-${post.id}`}
          post={post}
          myId={me.id}
          onLike={toggleLike}
          onRepost={repost}
          onBookmark={bookmark}
          onDelete={removePost}
          onEdit={editPost}
        />
      ))}
    </div>
  );
}
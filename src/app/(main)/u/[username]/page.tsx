"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Cake, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import EmojiText from "@/components/EmojiText";
import NameBadges from "@/components/NameBadges";
import GiftModal from "@/components/GiftModal";
import ProfileGifts from "@/components/ProfileGifts";
import { PINNED_SELECT, PinnedGift } from "@/lib/gifts";
import { Post, RawPost, POST_SELECT, withLiked } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";
import { formatBirth } from "@/lib/birthday";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  birth_date: string | null;
  verified: boolean;
  pinned: PinnedGift | null;
};

// одинаковый размер кнопок рядом с аватаркой (компьютер)
const SIDE_BTN = "h-10 w-36 !px-0 !py-0 !text-sm";

type Tab = "posts" | "reposts" | "saved" | "gifts";

async function fromJoin(data: unknown, myId: string, markRepost = false): Promise<Post[]> {
  const rows = ((data ?? []) as { created_at: string; post: RawPost | null }[]).filter(
    (r): r is { created_at: string; post: RawPost } => !!r.post
  );
  const posts = await withLiked(
    rows.map((r) => r.post),
    myId
  );
  return markRepost ? posts.map((p, i) => ({ ...p, repost_at: rows[i].created_at })) : posts;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { me } = useMe();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  const [saved, setSaved] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("posts");
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [aliases, setAliases] = useState<string[]>([]);
  const [giftOpen, setGiftOpen] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data: raw } = await supabase
      .from("profiles")
      .select(
        `id, username, display_name, avatar_url, cover_url, bio, birth_date, verified, ${PINNED_SELECT}`
      )
      .eq("username", username)
      .maybeSingle();
    const p = raw as unknown as Profile | null;

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
    setReposts(await fromJoin(e.data, me.id, true));
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

  async function openChat() {
    if (!profile) return;
    const { data, error } = await supabase.rpc("open_conversation", { other: profile.id });
    if (error || !data) {
      setError(error?.message ?? "Не удалось открыть чат");
      return;
    }
    router.push(`/messages/${data}`);
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
    { key: "gifts", label: "Подарки" },
  ];
  const current = tab === "saved" && !isMe ? "posts" : tab;
  const list =
    current === "posts" ? posts : current === "reposts" ? reposts : current === "saved" ? saved : [];
  const emptyText =
    current === "posts"
      ? "Публикаций пока нет."
      : current === "reposts"
      ? "Репостов пока нет."
      : "Здесь будут посты, которые вы сохраните.";

  const followBtn = (extra: string) => (
    <button
      onClick={toggleFollow}
      className={`${isFollowing ? "btn-ghost" : "btn-primary"} ${extra}`}
    >
      {isFollowing ? "Вы подписаны" : "Подписаться"}
    </button>
  );

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-line bg-white">
        <div className="h-36 bg-linear-to-r from-brand to-brand-deep sm:h-48">
          {profile.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="-mt-14 flex items-end justify-between">
            <div className="rounded-full ring-4 ring-white">
              <Avatar url={profile.avatar_url} name={name} size={112} />
            </div>

            {isMe ? (
              // редактирование только на компьютере; на телефоне есть меню аккаунта
              <Link href="/account/info" className="btn-ghost hidden md:inline-block">
                Редактировать
              </Link>
            ) : (
              <div className="hidden gap-2 sm:flex">
                <button onClick={openChat} className={`btn-ghost ${SIDE_BTN}`}>
                  Написать
                </button>
                {followBtn(SIDE_BTN)}
              </div>
            )}
          </div>

          {!isMe && (
            <div className="mt-4 flex gap-2 sm:hidden">
              <button onClick={openChat} className="btn-ghost h-10 flex-1 !py-0 !text-sm">
                Написать
              </button>
              {followBtn("h-10 flex-1 !py-0 !text-sm")}
            </div>
          )}

          <div className="mt-4">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <span className="min-w-0 truncate">
                <EmojiText text={name} />
              </span>
              <NameBadges
                verified={profile.verified}
                gift={profile.pinned}
                size={22}
                onGift={setGiftOpen}
              />
            </h1>
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
              <p className="mt-3 whitespace-pre-wrap text-[17px]">
                <EmojiText text={profile.bio} />
              </p>
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

      {current === "gifts" && (
        <ProfileGifts
          profileId={profile.id}
          username={profile.username}
          name={name}
          avatarUrl={profile.avatar_url}
          isMe={isMe}
          onChanged={load}
        />
      )}

      {current !== "gifts" && list.length === 0 && (
        <p className="py-8 text-center text-muted">{emptyText}</p>
      )}

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

      {giftOpen && (
        <GiftModal giftId={giftOpen} onClose={() => setGiftOpen(null)} onChanged={load} />
      )}
    </div>
  );
}
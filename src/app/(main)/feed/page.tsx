"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import { Post, POST_SELECT } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";

export default function FeedPage() {
  const { me } = useMe();
  const [tab, setTab] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const loadPosts = useCallback(async () => {
    let query = supabase
      .from("posts")
      .select(POST_SELECT)
      .order("created_at", { ascending: false })
      .limit(50);

    if (tab === "following") {
      const { data: f } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", me.id);
      const ids = (f ?? []).map((r) => r.following_id);
      if (ids.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }
      query = query.in("author_id", ids);
    }

    const { data, error } = await query;
    if (error) setError(error.message);
    else setPosts(data as unknown as Post[]);
    setLoading(false);
  }, [tab, me.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const { toggleLike, removePost } = usePostActions(me.id, setPosts, loadPosts, setError);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");

    const { error } = await supabase
      .from("posts")
      .insert({ author_id: me.id, content: text.trim() });

    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setText("");
    await loadPosts();
  }

  const name = me.display_name || me.username;

  return (
    <div className="space-y-4">
      <form
        onSubmit={publish}
        className="bg-white border border-line rounded-2xl p-4 shadow-sm"
      >
        <div className="flex gap-3">
          <Avatar url={me.avatar_url} name={name} size={44} />
          <textarea
            className="flex-1 resize-none bg-transparent outline-none placeholder:text-muted pt-2"
            rows={3}
            maxLength={500}
            placeholder="Что нового?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <span className="text-xs text-muted">{text.length}/500</span>
          <button disabled={sending || !text.trim()} className="btn-primary">
            {sending ? "Публикуем..." : "Опубликовать"}
          </button>
        </div>
      </form>

      <div className="flex gap-1 border-b border-line">
        {(
          [
            ["all", "Все"],
            ["following", "Подписки"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setLoading(true);
              setTab(key);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key
                ? "border-brand-strong text-brand-strong"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading && <p className="text-center text-muted py-8">Загрузка...</p>}

      {!loading && posts.length === 0 && (
        <p className="text-center text-muted py-10">
          {tab === "following"
            ? "Здесь появятся посты тех, на кого вы подпишетесь."
            : "Пока тут пусто. Напишите первый пост!"}
        </p>
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
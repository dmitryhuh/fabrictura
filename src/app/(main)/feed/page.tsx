"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";
import { Post, RawPost, POST_SELECT, withLiked } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";
import { checkImage, compressImage, imageExt } from "@/lib/images";

const PAGE = 20;

export default function FeedPage() {
  const { me } = useMe();
  const [tab, setTab] = useState<"all" | "following">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPage = useCallback(
    async (before?: string): Promise<{ rows: Post[]; more: boolean } | null> => {
      let query = supabase
        .from("posts")
        .select(POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(PAGE);

      if (before) query = query.lt("created_at", before);

      if (tab === "following") {
        const { data: f } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", me.id);
        const ids = (f ?? []).map((r) => r.following_id);
        if (ids.length === 0) return { rows: [], more: false };
        query = query.in("author_id", ids);
      }

      const { data, error } = await query;
      if (error) {
        setError(error.message);
        return null;
      }
      const rows = await withLiked(data as unknown as RawPost[], me.id);
      return { rows, more: rows.length === PAGE };
    },
    [tab, me.id]
  );

  const loadPosts = useCallback(async () => {
    const res = await fetchPage();
    if (res) {
      setPosts(res.rows);
      setHasMore(res.more);
    }
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function loadMore() {
    const last = posts[posts.length - 1];
    if (!last) return;
    setLoadingMore(true);
    const res = await fetchPage(last.created_at);
    if (res) {
      setPosts((prev) => [...prev, ...res.rows.filter((r) => !prev.some((p) => p.id === r.id))]);
      setHasMore(res.more);
    }
    setLoadingMore(false);
  }

    const { toggleLike, toggleRepost, toggleBookmark, removePost } = usePostActions(
    me.id,
    setPosts,
    loadPosts,
    setError
  );

  async function pickFile(f: File) {
    const problem = checkImage(f, 20);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");

    let small: File;
    try {
      small = await compressImage(f, 1600);
    } catch {
      setError("Не удалось обработать картинку");
      return;
    }
    const tooBig = checkImage(small, 5);
    if (tooBig) {
      setError(tooBig);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(small);
    setPreview(URL.createObjectURL(small));
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !file) return;
    setSending(true);
    setError("");

    let imageUrl: string | null = null;
    let path = "";
    if (file) {
      path = `${me.id}/${Date.now()}.${imageExt(file.type)}`;
      const { error: upErr } = await supabase.storage
        .from("post-images")
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setSending(false);
        setError(upErr.message);
        return;
      }
      imageUrl = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase
      .from("posts")
      .insert({ author_id: me.id, content: text.trim(), image_url: imageUrl });

    setSending(false);
    if (error) {
      if (path) await supabase.storage.from("post-images").remove([path]);
      setError(error.message);
      return;
    }
    setText("");
    clearFile();
    await loadPosts();
  }

  const name = me.display_name || me.username;

  return (
    <div className="space-y-5">
              <div className="sticky top-14 z-10 flex justify-center gap-1 border-b border-line bg-canvas/90 backdrop-blur md:top-0">
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
            className={`-mb-px border-b-2 px-5 py-2.5 text-sm font-medium transition ${
              tab === key
                ? "border-brand-strong text-brand-strong"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      
      <form
        onSubmit={publish}
        className="rounded-3xl border border-line bg-white p-5 shadow-sm"
      >
        <div className="flex gap-3">
          <Avatar url={me.avatar_url} name={name} size={52} />
          <textarea
            className="min-h-[44px] flex-1 resize-none bg-transparent pt-2 text-[16px] outline-none placeholder:text-muted"
            rows={1}
            maxLength={500}
            placeholder="Что нового?"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />
        </div>

        {preview && (
          <div className="relative mt-3">
            <img
              src={preview}
              alt=""
              className="max-h-80 w-full rounded-1g border border-line object-cover"
            />
            <button
              type="button"
              onClick={clearFile}
              aria-label="Убрать картинку"
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Добавить картинку"
              className="grid h-10 w-10 place-items-center rounded-full text-brand-strong transition hover:bg-brand-soft"
            >
              <ImagePlus size={22} />
            </button>
            <span className="text-xs text-muted">{text.length}/500</span>
          </div>
          <button disabled={sending || (!text.trim() && !file)} className="btn-primary">
            {sending ? "Публикуем..." : "Опубликовать"}
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = "";
          }}
        />
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading && <p className="py-8 text-center text-muted">Загрузка...</p>}

      {!loading && posts.length === 0 && (
        <p className="py-10 text-center text-muted">
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
          onRepost={toggleRepost}
          onBookmark={toggleBookmark}
          onDelete={removePost}
        />
      ))}

      {!loading && hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="btn-ghost mx-auto block disabled:opacity-50"
        >
          {loadingMore ? "Загружаем..." : "Показать ещё"}
        </button>
      )}
    </div>
  );
}
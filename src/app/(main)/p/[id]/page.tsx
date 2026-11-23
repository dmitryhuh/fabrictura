
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import EmojiText from "@/components/EmojiText";
import PostCard from "@/components/PostCard";
import { Post, RawPost, POST_SELECT, timeAgo, withLiked } from "@/lib/posts";
import { usePostActions } from "@/lib/usePostActions";

const MAX = 300;

type Comment = {
  id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  likes_count: number;
  liked: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

type RawComment = Omit<Comment, "likes_count" | "liked"> & {
  comment_likes: { count: number }[];
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();

  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle(),
      supabase
        .from("comments")
        .select(
          "id, content, created_at, edited_at, author_id, profiles!author_id(username, display_name, avatar_url), comment_likes(count)"
        )
        .eq("post_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (!p.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const raw = (c.data ?? []) as unknown as RawComment[];
    let mine = new Set<string>();
    if (raw.length > 0) {
      const { data: l } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", me.id)
        .in(
          "comment_id",
          raw.map((r) => r.id)
        );
      mine = new Set((l ?? []).map((x) => x.comment_id));
    }

    setPosts(await withLiked([p.data as unknown as RawPost], me.id));
    setComments(
      raw.map(({ comment_likes, ...r }) => ({
        ...r,
        likes_count: comment_likes?.[0]?.count ?? 0,
        liked: mine.has(r.id),
      }))
    );
    setLoading(false);
  }, [id, me.id]);

  useEffect(() => {
    load();
  }, [load]);

  const { toggleLike, toggleRepost, toggleBookmark, removePost, editPost } = usePostActions(
    me.id,
    setPosts,
    load,
    setError
  );

  async function handleDeletePost(post: Post) {
    const ok = await removePost(post);
    if (ok) router.replace("/feed");
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");

    const { error } = await supabase
      .from("comments")
      .insert({ post_id: id, author_id: me.id, content: text.trim() });

    setSending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setText("");
    await load();
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) {
      setError(error.message);
      return;
    }
    await load();
  }

  async function toggleCommentLike(c: Comment) {
    const on = c.liked;
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, liked: !on, likes_count: x.likes_count + (on ? -1 : 1) } : x
      )
    );
    const { error } = on
      ? await supabase.from("comment_likes").delete().eq("comment_id", c.id).eq("user_id", me.id)
      : await supabase.from("comment_likes").insert({ comment_id: c.id, user_id: me.id });
    if (error) load();
  }

  function startEditComment(c: Comment) {
    setError("");
    setDraft(c.content);
    setEditingId(c.id);
  }

  async function saveComment(c: Comment) {
    const content = draft.trim();
    if (!content) return;
    if (content === c.content) {
      setEditingId(null);
      return;
    }
    setSavingEdit(true);
    setError("");
    const { data, error } = await supabase
      .from("comments")
      .update({ content })
      .eq("id", c.id)
      .select("content, edited_at")
      .single();
    setSavingEdit(false);
    if (error) {
      setError(error.message);
      return;
    }
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, content: data.content, edited_at: data.edited_at } : x
      )
    );
    setEditingId(null);
  }

  if (loading) return <p className="py-16 text-center text-muted">Загрузка...</p>;
  if (notFound || !posts[0])
    return <p className="py-16 text-center text-muted">Пост не найден.</p>;

  const post = posts[0];
  const name = me.display_name || me.username;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/feed"
          aria-label="К ленте"
          className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold">Пост</h1>
      </div>

      <PostCard
        post={post}
        myId={me.id}
        onLike={toggleLike}
        onRepost={toggleRepost}
        onBookmark={toggleBookmark}
        onDelete={handleDeletePost}
        onEdit={editPost}
      />

      <form
        onSubmit={sendComment}
        className="flex gap-3 rounded-xl border border-line bg-white p-4"
      >
        <Avatar url={me.avatar_url} name={name} size={40} />
        <div className="min-w-0 flex-1">
          <textarea
            className="w-full resize-none bg-transparent pt-2 text-[16px] outline-none placeholder:text-muted"
            rows={1}
            maxLength={MAX}
            placeholder="Написать комментарий..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
          />
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <span className="text-xs text-muted">
              {text.length}/{MAX}
            </span>
            <button disabled={sending || !text.trim()} className="btn-primary !py-1.5 text-sm">
              {sending ? "Отправляем..." : "Отправить"}
            </button>
          </div>
        </div>
      </form>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <h2 className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Комментарии · {comments.length}
      </h2>

      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-white py-10 text-muted">
          <MessageSquare size={28} strokeWidth={1.6} />
          <p className="text-sm">Комментариев пока нет. Начните разговор.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {comments.map((c) => {
            const username = c.profiles?.username ?? "";
            const cname = c.profiles?.display_name || username || "?";
            const isAuthor = c.author_id === me.id;
            const canDelete = isAuthor || post.author_id === me.id;
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className="flex gap-3 border-b border-line px-4 py-3.5 last:border-b-0"
              >
                <Link href={`/u/${username}`} className="shrink-0">
                  <Avatar url={c.profiles?.avatar_url} name={cname} size={40} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/u/${username}`} className="min-w-0 truncate">
                      <span className="font-semibold hover:underline">{cname}</span>
                      <span className="text-sm text-muted">
                        {" "}@{username} · {timeAgo(c.created_at)}
                        {c.edited_at && " · изменено"}
                      </span>
                    </Link>
                    <div className="flex items-center gap-3">
                      {isAuthor && !isEditing && (
                        <button
                          onClick={() => startEditComment(c)}
                          aria-label="Редактировать комментарий"
                          className="text-muted transition hover:text-ink"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          aria-label="Удалить комментарий"
                          className="text-muted transition hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-1">
                      <textarea
                        autoFocus
                        className="input resize-none"
                        rows={2}
                        maxLength={MAX}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted">
                          {draft.length}/{MAX}
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="btn-ghost"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={() => saveComment(c)}
                            disabled={savingEdit || !draft.trim()}
                            className="btn-primary !py-1.5 text-sm"
                          >
                            {savingEdit ? "Сохраняем..." : "Сохранить"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        <EmojiText text={c.content} />
                      </p>
                      <button
                        onClick={() => toggleCommentLike(c)}
                        className={`-ml-2 mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition hover:bg-brand-soft ${
                          c.liked ? "text-rose-500" : "text-muted hover:text-rose-500"
                        }`}
                      >
                        <Heart size={16} className={c.liked ? "fill-current" : ""} />
                        {c.likes_count}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
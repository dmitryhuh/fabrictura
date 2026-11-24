"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Heart, MessageSquare, Pencil, Repeat2, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import EmojiText from "@/components/EmojiText";
import NameBadges from "@/components/NameBadges";
import GiftModal from "@/components/GiftModal";
import { Post, timeAgo } from "@/lib/posts";
import ImageViewer from "@/components/ImageViewer";

type Props = {
  post: Post;
  myId: string;
  onLike: (post: Post) => void;
  onRepost: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onDelete: (post: Post) => void;
  onEdit: (post: Post, content: string) => Promise<boolean>;
};

const btn =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted transition hover:bg-brand-soft";

export default function PostCard({
  post,
  myId,
  onLike,
  onRepost,
  onBookmark,
  onDelete,
  onEdit,
}: Props) {
  const username = post.profiles?.username ?? "";
  const name = post.profiles?.display_name || username || "?";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [origin, setOrigin] = useState<DOMRect | null>(null);
  const [giftOpen, setGiftOpen] = useState<string | null>(null);

  function startEdit() {
    setDraft(post.content);
    setEditing(true);
  }

  async function save() {
    const text = draft.trim();
    if (!text && !post.image_url) return;
    if (text === post.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const ok = await onEdit(post, text);
    setSaving(false);
    if (ok) setEditing(false);
  }

  return (
    <article className="rounded-xl border border-line bg-white p-4">
      {post.repost_at && (
        <p className="mb-2 flex items-center gap-1.5 pl-1 text-xs text-muted">
          <Repeat2 size={14} /> Репост
        </p>
      )}
      <div className="flex gap-3">
        <Link href={`/u/${username}`}>
          <Avatar url={post.profiles?.avatar_url} name={name} size={40} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <Link
                href={`/u/${username}`}
                className="max-w-[45%] shrink-0 truncate font-semibold hover:underline"
              >
                {name}
              </Link>
              <NameBadges
                verified={post.profiles?.verified}
                gift={post.profiles?.pinned}
                size={16}
                onGift={setGiftOpen}
              />
              <Link href={`/u/${username}`} className="min-w-0 truncate text-sm text-muted">
                @{username} · {timeAgo(post.created_at)}
                {post.edited_at && " · изменено"}
              </Link>
            </div>
            {post.author_id === myId && (
              <div className="flex shrink-0 items-center gap-3">
                {!editing && (
                  <button
                    onClick={startEdit}
                    aria-label="Редактировать пост"
                    className="text-muted transition hover:text-ink"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(post)}
                  aria-label="Удалить пост"
                  className="text-muted transition hover:text-red-500"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="mt-1">
              <textarea
                autoFocus
                className="input resize-none"
                rows={3}
                maxLength={500}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted">{draft.length}/500</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditing(false)} className="btn-ghost">
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || (!draft.trim() && !post.image_url)}
                    className="btn-primary !py-1.5 text-sm"
                  >
                    {saving ? "Сохраняем..." : "Сохранить"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            post.content && (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                <EmojiText text={post.content} />
              </p>
            )
          )}

          {post.image_url && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  setOrigin(e.currentTarget.querySelector("img")?.getBoundingClientRect() ?? null);
                  setViewing(true);
                }}
                aria-label="Открыть фото"
                className="mt-2 block w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image_url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-xl border border-line object-cover sm:aspect-[3/2]"
                />
              </button>
              {viewing && (
                <ImageViewer
                  images={[post.image_url]}
                  origin={origin}
                  onClose={() => setViewing(false)}
                />
              )}
            </>
          )}

          <div className="-ml-2.5 mt-2 flex items-center">
            <button
              onClick={() => onLike(post)}
              className={`${btn} ${post.liked ? "!text-rose-500" : "hover:!text-rose-500"}`}
            >
              <Heart size={18} className={post.liked ? "fill-current" : ""} />
              {post.likes_count}
            </button>
            <Link href={`/p/${post.id}`} className={`${btn} hover:!text-ink`}>
              <MessageSquare size={18} />
              {post.comments_count}
            </Link>
            <button
              onClick={() => onRepost(post)}
              className={`${btn} ${post.reposted ? "!text-emerald-600" : "hover:!text-emerald-600"}`}
            >
              <Repeat2 size={18} />
              {post.reposts_count}
            </button>
            <button
              onClick={() => onBookmark(post)}
              aria-label="В избранное"
              className={`${btn} ${post.bookmarked ? "!text-amber-400" : "hover:!text-amber-400"}`}
            >
              <Bookmark size={18} className={post.bookmarked ? "fill-current" : ""} />
            </button>
          </div>
        </div>
      </div>
      {giftOpen && <GiftModal giftId={giftOpen} onClose={() => setGiftOpen(null)} />}
    </article>
  );
}
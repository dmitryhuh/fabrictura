import Link from "next/link";
import { Bookmark, Heart, MessageSquare, Repeat2, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Post, timeAgo } from "@/lib/posts";

type Props = {
  post: Post;
  myId: string;
  onLike: (post: Post) => void;
  onRepost: (post: Post) => void;
  onBookmark: (post: Post) => void;
  onDelete: (post: Post) => void;
};

const btn =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-muted transition hover:bg-brand-soft";

export default function PostCard({ post, myId, onLike, onRepost, onBookmark, onDelete }: Props) {
  const username = post.profiles?.username ?? "";
  const name = post.profiles?.display_name || username || "?";

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
            <Link href={`/u/${username}`} className="min-w-0 truncate">
              <span className="font-semibold hover:underline">{name}</span>
              <span className="text-sm text-muted">
                {" "}@{username} · {timeAgo(post.created_at)}
              </span>
            </Link>
            {post.author_id === myId && (
              <button
                onClick={() => onDelete(post)}
                aria-label="Удалить пост"
                className="text-muted transition hover:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {post.content && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
              {post.content}
            </p>
          )}

          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              className="mt-2 max-h-[32rem] w-full rounded-lg border border-line object-cover"
            />
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
    </article>
  );
}
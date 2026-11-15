import Link from "next/link";
import { Heart, MessageSquare, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Post, timeAgo } from "@/lib/posts";

type Props = {
  post: Post;
  myId: string;
  onLike: (post: Post) => void;
  onDelete: (post: Post) => void;
};

export default function PostCard({ post, myId, onLike, onDelete }: Props) {
  const liked = post.liked;
  const username = post.profiles?.username ?? "";
  const name = post.profiles?.display_name || username || "?";

  return (
    <article className="rounded-3xl border border-line bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex gap-4">
        <Link href={`/u/${username}`}>
          <Avatar url={post.profiles?.avatar_url} name={name} size={52} />
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
                <Trash2 size={18} />
              </button>
            )}
          </div>

          {post.content && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[17px] leading-relaxed">
              {post.content}
            </p>
          )}

          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              loading="lazy"
              className="mt-3 max-h-[32rem] w-full rounded-2xl border border-line object-cover"
            />
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => onLike(post)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition ${
                liked
                  ? "border-brand bg-brand-soft text-brand-strong"
                  : "border-line text-muted hover:bg-brand-soft"
              }`}
            >
              <Heart size={17} className={liked ? "fill-current" : ""} />
              {post.likes_count}
            </button>
            <Link
              href={`/p/${post.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-sm text-muted transition hover:bg-brand-soft"
            >
              <MessageSquare size={17} />
              {post.comments_count}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
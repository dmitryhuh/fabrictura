import Link from "next/link";
import { Heart, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Post, timeAgo } from "@/lib/posts";

type Props = {
  post: Post;
  myId: string;
  onLike: (post: Post) => void;
  onDelete: (id: string) => void;
};

export default function PostCard({ post, myId, onLike, onDelete }: Props) {
  const liked = post.likes.some((l) => l.user_id === myId);
  const username = post.profiles?.username ?? "";
  const name = post.profiles?.display_name || username || "?";

  return (
    <article className="bg-white border border-line rounded-2xl p-4 shadow-sm transition hover:shadow-md">
      <div className="flex gap-3">
        <Link href={`/u/${username}`}>
          <Avatar url={post.profiles?.avatar_url} name={name} size={44} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/u/${username}`} className="min-w-0 truncate">
              <span className="font-semibold hover:underline">{name}</span>
              <span className="text-muted text-sm">
                {" "}@{username} · {timeAgo(post.created_at)}
              </span>
            </Link>
            {post.author_id === myId && (
              <button
                onClick={() => onDelete(post.id)}
                aria-label="Удалить пост"
                className="text-muted hover:text-red-500 transition"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words">{post.content}</p>

          <button
            onClick={() => onLike(post)}
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
              liked
                ? "bg-brand-soft border-brand text-brand-strong"
                : "border-line text-muted hover:bg-brand-soft"
            }`}
          >
            <Heart size={16} className={liked ? "fill-current" : ""} />
            {post.likes.length}
          </button>
        </div>
      </div>
    </article>
  );
}
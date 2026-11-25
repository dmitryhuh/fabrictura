import { supabase } from "@/lib/supabase/client";
import { PinnedGift, PINNED_SELECT } from "@/lib/gifts";

export type Badge = "staff" | "official";

export type Post = {
  id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  author_id: string;
  image_url: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    badge: Badge | null; pinned: PinnedGift | null;
  } | null;
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  // когда пост репостнули (только в профиле, для постов-репостов)
  repost_at?: string | null;
};

// как пост приходит из базы, до обработки
export type RawPost = Omit<
  Post,
  | "likes_count"
  | "comments_count"
  | "reposts_count"
  | "liked"
  | "reposted"
  | "bookmarked"
  | "repost_at"
> & {
  likes: { count: number }[];
  comments: { count: number }[];
  reposts: { count: number }[];
};

export const POST_SELECT = `id, content, created_at, edited_at, author_id, image_url, profiles!author_id(username, display_name, avatar_url, badge, ${PINNED_SELECT}), likes(count), comments(count), reposts(count)`;

// превращает посты из базы в готовые для показа и отмечает мои лайки, репосты и избранное
export async function withLiked(rows: RawPost[], myId: string): Promise<Post[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const mine = (table: "likes" | "reposts" | "bookmarks") =>
    supabase.from(table).select("post_id").eq("user_id", myId).in("post_id", ids);

  const [l, r, b] = await Promise.all([mine("likes"), mine("reposts"), mine("bookmarks")]);
  const setOf = (d: { post_id: string }[] | null) => new Set((d ?? []).map((x) => x.post_id));
  const liked = setOf(l.data);
  const reposted = setOf(r.data);
  const saved = setOf(b.data);

  return rows.map(({ likes, comments, reposts, ...rest }) => ({
    ...rest,
    likes_count: likes?.[0]?.count ?? 0,
    comments_count: comments?.[0]?.count ?? 0,
    reposts_count: reposts?.[0]?.count ?? 0,
    liked: liked.has(rest.id),
    reposted: reposted.has(rest.id),
    bookmarked: saved.has(rest.id),
  }));
}

export function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "только что";
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  return new Date(iso).toLocaleDateString("ru-RU");
}
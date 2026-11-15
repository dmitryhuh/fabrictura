import { supabase } from "@/lib/supabase/client";

export type Post = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  image_url: string | null;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  likes_count: number;
  comments_count: number;
  liked: boolean;
};

// как пост приходит из базы, до обработки
export type RawPost = Omit<Post, "likes_count" | "comments_count" | "liked"> & {
  likes: { count: number }[];
  comments: { count: number }[];
};

export const POST_SELECT =
  "id, content, created_at, author_id, image_url, profiles!author_id(username, display_name, avatar_url), likes(count), comments(count)";

// превращает посты из базы в готовые для показа и отмечает, какие лайкнул я
export async function withLiked(rows: RawPost[], myId: string): Promise<Post[]> {
  if (rows.length === 0) return [];
  const { data } = await supabase
    .from("likes")
    .select("post_id")
    .eq("user_id", myId)
    .in(
      "post_id",
      rows.map((r) => r.id)
    );
  const mine = new Set((data ?? []).map((l) => l.post_id));
  return rows.map(({ likes, comments, ...rest }) => ({
    ...rest,
    likes_count: likes?.[0]?.count ?? 0,
    comments_count: comments?.[0]?.count ?? 0,
    liked: mine.has(rest.id),
  }));
}

export function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "только что";
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  return new Date(iso).toLocaleDateString("ru-RU");
}
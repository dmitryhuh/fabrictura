export type Post = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  likes: { user_id: string }[];
};

export const POST_SELECT =
  "id, content, created_at, author_id, profiles!author_id(username, display_name, avatar_url), likes(user_id)";

export function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return "только что";
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  return new Date(iso).toLocaleDateString("ru-RU");
}
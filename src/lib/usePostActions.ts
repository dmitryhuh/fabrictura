"use client";

import { Dispatch, SetStateAction } from "react";
import { supabase } from "@/lib/supabase/client";
import { Post } from "@/lib/posts";

export function usePostActions(
  myId: string,
  setPosts: Dispatch<SetStateAction<Post[]>>,
  reload: () => unknown,
  onError: (message: string) => void
) {
  function patch(id: string, change: (p: Post) => Post) {
    setPosts((prev) => prev.map((p) => (p.id === id ? change(p) : p)));
  }

  async function toggleLike(post: Post) {
    const on = post.liked;
    patch(post.id, (p) => ({ ...p, liked: !on, likes_count: p.likes_count + (on ? -1 : 1) }));

    const { error } = on
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", myId)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: myId });
    if (error) reload();
  }

  async function toggleRepost(post: Post) {
    const on = post.reposted;
    patch(post.id, (p) => ({
      ...p,
      reposted: !on,
      reposts_count: p.reposts_count + (on ? -1 : 1),
    }));

    const { error } = on
      ? await supabase.from("reposts").delete().eq("post_id", post.id).eq("user_id", myId)
      : await supabase.from("reposts").insert({ post_id: post.id, user_id: myId });
    if (error) reload();
  }

  async function toggleBookmark(post: Post) {
    const on = post.bookmarked;
    patch(post.id, (p) => ({ ...p, bookmarked: !on }));

    const { error } = on
      ? await supabase.from("bookmarks").delete().eq("post_id", post.id).eq("user_id", myId)
      : await supabase.from("bookmarks").insert({ post_id: post.id, user_id: myId });
    if (error) reload();
  }

  async function removePost(post: Post): Promise<boolean> {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      onError(error.message);
      return false;
    }
    if (post.image_url) {
      const marker = "/post-images/";
      const i = post.image_url.indexOf(marker);
      if (i !== -1) {
        await supabase.storage
          .from("post-images")
          .remove([post.image_url.slice(i + marker.length)]);
      }
    }
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    return true;
  }

  return { toggleLike, toggleRepost, toggleBookmark, removePost };
}
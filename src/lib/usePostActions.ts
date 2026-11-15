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
  async function toggleLike(post: Post) {
    const liked = post.liked;

    setPosts((prev) =>
      prev.map((p) =>
        p.id !== post.id
          ? p
          : { ...p, liked: !liked, likes_count: p.likes_count + (liked ? -1 : 1) }
      )
    );

    const { error } = liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", myId)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: myId });

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

  return { toggleLike, removePost };
}
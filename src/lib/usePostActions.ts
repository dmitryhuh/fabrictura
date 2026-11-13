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
    const liked = post.likes.some((l) => l.user_id === myId);

    setPosts((prev) =>
      prev.map((p) =>
        p.id !== post.id
          ? p
          : {
              ...p,
              likes: liked
                ? p.likes.filter((l) => l.user_id !== myId)
                : [...p.likes, { user_id: myId }],
            }
      )
    );

    const { error } = liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", myId)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: myId });

    if (error) reload();
  }

  async function removePost(id: string) {
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) {
      onError(error.message);
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return { toggleLike, removePost };
}
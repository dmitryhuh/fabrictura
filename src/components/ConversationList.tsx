"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import { ConversationItem, listTime } from "@/lib/messages";

export default function ConversationList({ activeId }: { activeId: string | null }) {
  const { me } = useMe();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("conversation_list");
    if (error) setError(error.message);
    else {
      setError("");
      setItems((data ?? []) as ConversationItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // AppShell сообщает о новых и прочитанных сообщениях
    window.addEventListener("msg-new", load);
    return () => window.removeEventListener("msg-new", load);
  }, [load]);

  return (
    <>
      <h1 className="border-b border-line px-4 py-3 text-xl font-bold">Сообщения</h1>

      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
        {error && <p className="px-4 py-3 text-sm text-red-500">{error}</p>}
        {loading && <p className="py-10 text-center text-muted">Загрузка...</p>}

        {!loading && !error && items.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-muted">
            Диалогов пока нет. Найдите человека через{" "}
            <Link href="/search" className="font-medium text-ink underline">
              поиск
            </Link>{" "}
            и нажмите «Написать» в его профиле.
          </p>
        )}

        {items.map((c) => {
          const name = c.other_name || c.other_username;
          const preview = `${c.last_sender === me.id ? "Вы: " : ""}${
            c.last_content || (c.last_has_image ? "Фото" : "")
          }`;
          return (
            <Link
              key={c.conv_id}
              href={`/messages/${c.conv_id}`}
              className={`flex items-center gap-3 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-brand-soft ${
                activeId === c.conv_id ? "bg-brand-soft" : ""
              }`}
            >
              <Avatar url={c.other_avatar} name={name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{name}</p>
                  <span className="shrink-0 text-xs text-muted">{listTime(c.last_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm text-muted">{preview}</p>
                  {c.unread_count > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white">
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
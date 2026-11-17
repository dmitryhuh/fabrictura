"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, ImagePlus, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import { checkImage, compressImage, imageExt } from "@/lib/images";
import {
  MAX_LEN,
  MESSAGE_BUCKET,
  MESSAGE_COLUMNS,
  Message,
  clock,
  dayLabel,
  signImages,
} from "@/lib/messages";

const PAGE = 30;

// на телефоне чат открывается поверх всего экрана, на компьютере встаёт в правый столбец
const SHELL =
  "fixed inset-0 z-30 flex flex-col bg-canvas md:static md:z-auto md:h-full md:overflow-hidden md:rounded-xl md:border md:border-line md:bg-white";

type Other = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const { me, refreshUnreadMessages } = useMe();

  const [other, setOther] = useState<Other | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const markRead = useCallback(async () => {
    await supabase.rpc("mark_read", { conv: id });
    await refreshUnreadMessages();
    window.dispatchEvent(new Event("msg-new"));
  }, [id, refreshUnreadMessages]);

  const load = useCallback(async () => {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, user1, user2")
      .eq("id", id)
      .maybeSingle();

    if (!conv) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const otherId = conv.user1 === me.id ? conv.user2 : conv.user1;
    const [p, m] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", otherId)
        .maybeSingle(),
      supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", id)
        .order("created_at", { ascending: false })
        .limit(PAGE),
    ]);

    if (!p.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const rows = ((m.data ?? []) as unknown as Message[]).reverse();
    const urls = await signImages(rows.flatMap((r) => (r.image_path ? [r.image_path] : [])));

    stickRef.current = true;
    setOther(p.data as Other);
    setMessages(rows);
    setSigned(urls);
    setHasMore((m.data ?? []).length === PAGE);
    setLoading(false);

    if (rows.some((r) => r.recipient_id === me.id && !r.read_at)) markRead();
  }, [id, me.id, markRead]);

  useEffect(() => {
    load();
  }, [load]);

  // новые и прочитанные сообщения приходят сразу
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        async (payload) => {
          const m = payload.new as Message;
          if (m.image_path) {
            const urls = await signImages([m.image_path]);
            setSigned((prev) => ({ ...prev, ...urls }));
          }
          stickRef.current = true;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.recipient_id === me.id) markRead();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, read_at: m.read_at } : x)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, me.id, markRead]);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function stickToBottom() {
    const el = listRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }

  async function loadMore() {
    const first = messages[0];
    const el = listRef.current;
    if (!first || !el) return;
    setLoadingMore(true);
    const prevHeight = el.scrollHeight;

    const { data } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", id)
      .lt("created_at", first.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);

    const rows = ((data ?? []) as unknown as Message[]).reverse();
    const urls = await signImages(rows.flatMap((r) => (r.image_path ? [r.image_path] : [])));

    stickRef.current = false;
    setSigned((prev) => ({ ...prev, ...urls }));
    setMessages((prev) => [...rows.filter((r) => !prev.some((p) => p.id === r.id)), ...prev]);
    setHasMore((data ?? []).length === PAGE);
    setLoadingMore(false);
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  async function pickFile(f: File) {
    const problem = checkImage(f, 20);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");

    let small: File;
    try {
      small = await compressImage(f, 1600);
    } catch {
      setError("Не удалось обработать картинку");
      return;
    }
    const tooBig = checkImage(small, 5);
    if (tooBig) {
      setError(tooBig);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setFile(small);
    setPreview(URL.createObjectURL(small));
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (sending || !other || (!text.trim() && !file)) return;
    setSending(true);
    setError("");

    let path: string | null = null;
    if (file) {
      path = `${id}/${crypto.randomUUID()}.${imageExt(file.type)}`;
      const { error: upErr } = await supabase.storage
        .from(MESSAGE_BUCKET)
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setSending(false);
        setError(upErr.message);
        return;
      }
    }

    const { data, error: insErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: me.id,
        recipient_id: other.id,
        content: text.trim(),
        image_path: path,
      })
      .select(MESSAGE_COLUMNS)
      .single();

    if (insErr || !data) {
      setSending(false);
      if (path) await supabase.storage.from(MESSAGE_BUCKET).remove([path]);
      setError(insErr?.message ?? "Не удалось отправить");
      return;
    }

    const m = data as unknown as Message;
    if (path) {
      const urls = await signImages([path]);
      setSigned((prev) => ({ ...prev, ...urls }));
    }
    stickRef.current = true;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    setText("");
    clearFile();
    if (areaRef.current) areaRef.current.style.height = "auto";
    setSending(false);
    window.dispatchEvent(new Event("msg-new"));
  }

  if (loading) {
    return (
      <div className={SHELL}>
        <p className="grid flex-1 place-items-center text-muted">Загрузка...</p>
      </div>
    );
  }

  if (notFound || !other) {
    return (
      <div className={SHELL}>
        <div className="grid flex-1 place-items-center p-6 text-center text-muted">
          <div className="space-y-3">
            <p>Диалог не найден.</p>
            <Link href="/messages" className="btn-ghost inline-block">
              К сообщениям
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const otherName = other.display_name || other.username;

  return (
    <div className={SHELL}>
      <header className="flex items-center gap-2 border-b border-line bg-white px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <Link
          href="/messages"
          aria-label="К сообщениям"
          className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink md:hidden"
        >
          <ArrowLeft size={20} />
        </Link>
        <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-3">
          <Avatar url={other.avatar_url} name={otherName} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{otherName}</p>
            <p className="truncate text-xs text-muted">@{other.username}</p>
          </div>
        </Link>
      </header>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-canvas px-3 py-4"
      >
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-ghost mx-auto mb-2 block disabled:opacity-50"
          >
            {loadingMore ? "Загружаем..." : "Показать ранние"}
          </button>
        )}

        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">Напишите первое сообщение.</p>
        )}

        {messages.map((m, i) => {
          const mine = m.sender_id === me.id;
          const newDay = i === 0 || dayLabel(messages[i - 1].created_at) !== dayLabel(m.created_at);
          const url = m.image_path ? signed[m.image_path] : null;
          return (
            <div key={m.id}>
              {newDay && (
                <p className="py-2 text-center text-xs font-medium text-muted">
                  {dayLabel(m.created_at)}
                </p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                    mine
                      ? "rounded-br-md bg-ink text-white"
                      : "rounded-bl-md border border-line bg-white"
                  }`}
                >
                  {m.image_path &&
                    (url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt=""
                          onLoad={stickToBottom}
                          className="mb-1 max-h-72 w-64 max-w-full rounded-lg object-cover sm:w-72"
                        />
                      </a>
                    ) : (
                      <div className="mb-1 h-40 w-64 max-w-full animate-pulse rounded-lg bg-brand-soft sm:w-72" />
                    ))}
                  {m.content && (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                      {m.content}
                    </p>
                  )}
                  <p
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] ${
                      mine ? "text-white/60" : "text-muted"
                    }`}
                  >
                    {clock(m.created_at)}
                    {mine &&
                      (m.read_at ? (
                        <CheckCheck size={14} aria-label="Прочитано" />
                      ) : (
                        <Check size={14} aria-label="Отправлено" />
                      ))}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={send}
        className="border-t border-line bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {preview && (
          <div className="relative mb-2 inline-block">
            <img src={preview} alt="" className="h-20 rounded-lg border border-line object-cover" />
            <button
              type="button"
              onClick={clearFile}
              aria-label="Убрать картинку"
              className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white hover:bg-black"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {error && <p className="mb-2 text-sm text-red-500">{error}</p>}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Добавить картинку"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
          >
            <ImagePlus size={22} />
          </button>
          <textarea
            ref={areaRef}
            className="input max-h-32 min-h-11 min-w-0 flex-1 resize-none !py-2.5"
            rows={1}
            maxLength={MAX_LEN}
            placeholder="Сообщение"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              // на компьютере Enter отправляет, Shift+Enter переносит строку
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            disabled={sending || (!text.trim() && !file)}
            aria-label="Отправить"
            className="btn-primary grid h-11 w-11 shrink-0 place-items-center !p-0"
          >
            <Send size={18} />
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = "";
          }}
        />
      </form>
    </div>
  );
}
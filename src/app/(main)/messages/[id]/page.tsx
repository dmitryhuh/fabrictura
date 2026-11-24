"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, ImagePlus, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useMe } from "@/components/MeContext";
import Avatar from "@/components/Avatar";
import EmojiButton, { insertEmoji } from "@/components/EmojiButton";
import EmojiText, { bigEmojiCount } from "@/components/EmojiText";
import { checkImage, compressImage, imageExt } from "@/lib/images";
import ImageViewer from "@/components/ImageViewer";
import GiftMessage from "@/components/GiftMessage";
import GiftModal from "@/components/GiftModal";
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


const SHELL =
  "fixed inset-0 z-30 flex flex-col overflow-hidden bg-brand-soft md:relative md:inset-auto md:z-auto md:h-full md:rounded-xl md:border md:border-line";

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
  const [giftOpen, setGiftOpen] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    images: string[];
    start: number;
    origin: DOMRect | null;
  } | null>(null);
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

  function openImage(url: string, msgId: string) {
    const images = messages.flatMap((x) =>
      x.image_path && signed[x.image_path] ? [signed[x.image_path]] : []
    );
    const el = document.querySelector<HTMLElement>(`[data-msg-img="${msgId}"]`);
    setViewer({
      images,
      start: Math.max(0, images.indexOf(url)),
      origin: el ? el.getBoundingClientRect() : null,
    });
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
      <header className="absolute inset-x-0 top-0 z-10 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-white/90 p-2 backdrop-blur">
          <Link
            href="/messages"
            aria-label="К сообщениям"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink md:hidden"
          >
            <ArrowLeft size={20} />
          </Link>
          <Link href={`/u/${other.username}`} className="flex min-w-0 items-center gap-3 pl-1">
            <Avatar url={other.avatar_url} name={otherName} size={40} />
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{otherName}</p>
              <p className="truncate text-xs text-muted">@{other.username}</p>
            </div>
          </Link>
        </div>
      </header>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-[calc(5rem+env(safe-area-inset-top))]"
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
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
          const first = newDay || prev.sender_id !== m.sender_id;
          const last =
            !next ||
            next.sender_id !== m.sender_id ||
            dayLabel(next.created_at) !== dayLabel(m.created_at);
          const url = m.image_path ? signed[m.image_path] : null;
          const big = !m.image_path ? bigEmojiCount(m.content ?? "") : 0;
          const BIG = ["", "h-16 w-16", "h-12 w-12", "h-10 w-10"][big];
          return (
            <div key={m.id}>
              {newDay && (
                <p className="my-3 flex justify-center">
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-muted">
                    {dayLabel(m.created_at)}
                  </span>
                </p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"} ${first ? "mt-2" : "mt-0.5"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl ${big ? "px-1" : "px-3 py-1.5"} ${
                    big
                      ? ""
                      : mine
                      ? `bg-ink text-white ${last ? "rounded-br-sm" : ""}`
                      : `border border-line bg-white ${last ? "rounded-bl-sm" : ""}`
                  }`}
                >
                  {m.gift_id && <GiftMessage giftId={m.gift_id} mine={mine} onOpen={setGiftOpen} />}

                  {m.image_path &&
                    (url ? (
                        <button
                          type="button"
                          data-msg-img={m.id}
                          onClick={() => openImage(url, m.id)}
                          className="block cursor-zoom-in"
                        >
                          <img
                            src={url}
                            alt=""
                            onLoad={stickToBottom}
                            className="mb-1 max-h-72 w-64 max-w-full rounded-xl object-cover sm:w-72"
                          />
                        </button>                        
                    ) : (
                      <div className="mb-1 h-40 w-64 max-w-full animate-pulse rounded-xl bg-brand-soft sm:w-72" />
                    ))}
                  {m.content && !m.gift_id &&
                    (big ? (
                      <p className="leading-none">
                        <EmojiText
                          text={m.content}
                          emojiClassName={`inline-block ${BIG} align-middle`}
                        />
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        <EmojiText text={m.content} />
                      </p>
                    ))}
                  <p
                    className={`flex items-center justify-end gap-1 text-[11px] leading-tight ${
                      mine && !big ? "text-white/60" : "text-muted"
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
        className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
      >
        {preview && (
          <div className="relative mb-2 inline-block rounded-xl border border-line bg-white p-1.5">
            <img src={preview} alt="" className="h-20 rounded-lg object-cover" />
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

        <div className="flex items-end gap-1 rounded-3xl border border-line bg-white p-1.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Добавить картинку"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink"
          >
            <ImagePlus size={22} />
          </button>
          <EmojiButton
            onPick={(emoji) => insertEmoji(areaRef.current, text, emoji, MAX_LEN, setText, true)}
          />
          <textarea
            ref={areaRef}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-base outline-none placeholder:text-muted"
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
              if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            disabled={sending || (!text.trim() && !file)}
            aria-label="Отправить"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white transition hover:bg-brand-hover active:scale-95 disabled:opacity-40"
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
        
      {giftOpen && <GiftModal giftId={giftOpen} onClose={() => setGiftOpen(null)} />}

        {viewer && (
          <ImageViewer
            images={viewer.images}
            start={viewer.start}
            origin={viewer.origin}
            onClose={() => setViewer(null)}
          />
        )}
    </div>
  );
}
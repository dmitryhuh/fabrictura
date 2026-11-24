import { supabase } from "@/lib/supabase/client";


export const MESSAGE_BUCKET = "message-images";
export const MAX_LEN = 2000;

export const MESSAGE_COLUMNS =
  "id, conversation_id, sender_id, recipient_id, content, image_path, created_at, read_at, gift_id";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
  gift_id: string | null;

};

// строка из функции conversation_list()
export type ConversationItem = {
  conv_id: string;
  other_id: string;
  other_username: string;
  other_name: string | null;
  other_avatar: string | null;
  last_content: string;
  last_has_image: boolean;
  last_sender: string;
  last_at: string;
  unread_count: number;
};

// временные ссылки на картинки из приватного бакета (4 часа)
export async function signImages(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage
    .from(MESSAGE_BUCKET)
    .createSignedUrls(unique, 60 * 60 * 4);
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}

export function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function daysAgo(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - day.getTime()) / 86400000);
}

// разделитель дней внутри чата
export function dayLabel(iso: string) {
  const diff = daysAgo(iso);
  if (diff <= 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// время в списке диалогов
export function listTime(iso: string) {
  const diff = daysAgo(iso);
  if (diff <= 0) return clock(iso);
  if (diff === 1) return "Вчера";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}
// ПУТЬ: src/components/EmojiText.tsx
"use client";

import { useState } from "react";
import type { ReactNode } from "react";

// Картинки эмодзи Apple из пакета emoji-datasource-apple (через jsDelivr, версия зафиксирована).
// Сами изображения принадлежат Apple.
const CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@16.0.0/img/apple/64";

// флаги, клавиши (1️⃣) и обычные эмодзи, включая составные через ZWJ и с цветом кожи.
// Строим через RegExp, а не литерал, чтобы не зависеть от целевой версии JS в tsconfig.
const EMOJI_RE = new RegExp(
  "(?:\\p{Regional_Indicator}{2})|(?:[#*0-9]\\uFE0F?\\u20E3)|" +
    "(?:\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?" +
    "(?:\\u200D\\p{Extended_Pictographic}(?:\\uFE0F|\\p{Emoji_Modifier})?)*)",
  "gu"
);

function codes(char: string) {
  return Array.from(char).map((c) => (c.codePointAt(0) ?? 0).toString(16).padStart(4, "0"));
}

// имя файла: сначала как есть, затем без селектора вариации FE0F (у части эмодзи файл назван так)
function candidates(char: string): string[] {
  const full = codes(char);
  const bare = full.filter((c) => c !== "fe0f");
  const list = [full.join("-")];
  if (bare.length !== full.length && bare.length > 0) list.push(bare.join("-"));
  return list;
}

export function Emoji({ char }: { char: string }) {
  const [i, setI] = useState(0);
  const urls = candidates(char);
  // нет картинки: показываем обычный системный символ
  if (i >= urls.length) return <>{char}</>;
  return (
    <img
      src={`${CDN}/${urls[i]}.png`}
      alt={char}
      draggable={false}
      loading="lazy"
      onError={() => setI(i + 1)}
      className="inline-block h-[1.25em] w-[1.25em] align-[-0.25em]"
    />
  );
}

// текст, в котором эмодзи заменены на картинки Apple
export default function EmojiText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI_RE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(<Emoji key={at} char={m[0]} />);
    last = at + m[0].length;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
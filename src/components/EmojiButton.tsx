// ПУТЬ: src/components/EmojiButton.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";
import { Emoji } from "@/components/EmojiText";

const CATEGORIES = [
  { icon: "😀", name: "Смайлы", list: "😀 😃 😄 😁 😆 😅 😂 🤣 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃" },
  { icon: "👍", name: "Жесты", list: "👋 🤚 🖐️ ✋ 🖖 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 💋" },
  { icon: "❤️", name: "Сердца и символы", list: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☯️ 🔥 ✨ 🌟 ⭐ 💫 💥 💢 💦 💨 💤 🎉 🎊 💯 ✅ ❌ ❓ ❗ ⚡ ☀️ 🌈 ☁️ ❄️" },
  { icon: "🐶", name: "Животные и природа", list: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐢 🐍 🐙 🐬 🐳 🦈 🐊 🌵 🌲 🌴 🌸 🌹 🌻 🍀 🍁 🌍 🌙" },
  { icon: "🍕", name: "Еда", list: "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🍞 🧀 🍳 🥓 🍔 🍟 🍕 🌭 🌮 🍿 🍣 🍜 🍝 🍩 🍪 🎂 🍰 🍫 🍬 🍭 ☕ 🍵 🍺 🍷 🥂 🍸 🥤" },
  { icon: "⚽", name: "Активности и предметы", list: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎱 🏓 🥊 🎮 🕹️ 🎲 🎯 🎵 🎶 🎤 🎧 🎸 🎹 🎬 📷 📱 💻 ⌨️ 🖥️ 💡 📚 ✏️ 🎁 🏆 🥇 🚗 ✈️ 🚀 ⏰ 🔑 💰 💎 🔒 🔔 📌 🛒" },
];

type Props = {
  onPick: (emoji: string) => void;
  // куда раскрывать панель и к какому краю кнопки прижимать
  placement?: "top" | "bottom";
  align?: "left" | "right";
  buttonClassName?: string;
};

export default function EmojiButton({
  onPick,
  placement = "top",
  align = "left",
  buttonClassName = "grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition hover:bg-brand-soft hover:text-ink",
}: Props) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // onMouseDown с preventDefault не даёт полю ввода потерять фокус (на телефоне не закроется клавиатура)
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-label="Смайлики"
        aria-expanded={open}
        onMouseDown={keepFocus}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        <Smile size={22} />
      </button>

      {open && (
        <div
          className={`absolute z-30 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-2 ${
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          <div className="mb-1.5 flex gap-1 border-b border-line pb-1.5">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                onMouseDown={keepFocus}
                onClick={() => setCat(i)}
                className={`grid h-8 w-8 place-items-center rounded-lg text-lg transition ${
                  i === cat ? "bg-brand-soft" : "hover:bg-brand-soft"
                }`}
              >
                <Emoji char={c.icon} />
              </button>
            ))}
          </div>
          <div className="grid max-h-52 grid-cols-8 gap-0.5 overflow-y-auto">
            {CATEGORIES[cat].list.split(" ").map((e) => (
              <button
                key={e}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => onPick(e)}
                className="grid h-8 w-8 place-items-center rounded-lg text-xl transition hover:bg-brand-soft"
              >
                <Emoji char={e} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// вставляет смайлик в место курсора; max считается так же, как maxLength у поля
export function insertEmoji(
  el: HTMLTextAreaElement | null,
  value: string,
  emoji: string,
  max: number,
  set: (v: string) => void,
  autoGrow = false
) {
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = value.slice(0, start) + value.slice(end > start ? end : start);
  const result = next.slice(0, start) + emoji + next.slice(start);
  if (result.length > max) return;
  set(result);
  requestAnimationFrame(() => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(start + emoji.length, start + emoji.length);
    if (autoGrow) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  });
}
"use client";

import { useEffect, useRef, useState } from "react";
import GiftArt from "@/components/GiftArt";
import { GiftBackdrop, GiftModel, GiftPattern } from "@/lib/gifts";

export type ReelItem = { model: GiftModel; backdrop: GiftBackdrop; pattern: GiftPattern | null };

export const REEL_MS = 4200;
const TILE = 120;
const GAP = 8;

export default function GiftReel({ items, target }: { items: ReelItem[]; target: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [go, setGo] = useState(false);

  useEffect(() => {
    const w = box.current?.clientWidth ?? 0;
    const end = -(target * (TILE + GAP) + TILE / 2 - w / 2);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setGo(true);
        setX(end);
      })
    );
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="grid h-64 place-items-center bg-brand-soft">
      <div ref={box} className="relative w-full overflow-hidden py-3">
        <div
          className="flex will-change-transform"
          style={{
            gap: GAP,
            transform: `translateX(${x}px)`,
            transition: go ? `transform ${REEL_MS}ms cubic-bezier(0.1, 0.7, 0.1, 1)` : "none",
          }}
        >
          {items.map((it, i) => (
            <div key={i} className="shrink-0" style={{ width: TILE }}>
              <GiftArt model={it.model} backdrop={it.backdrop} pattern={it.pattern} />
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute inset-y-1.5 left-1/2 -translate-x-1/2 rounded-2xl ring-2 ring-ink"
          style={{ width: TILE + 8 }}
        />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-brand-soft to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-brand-soft to-transparent" />
      </div>
    </div>
  );
}
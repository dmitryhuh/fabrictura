"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Props = {
  images: string[];
  start?: number;
  origin?: DOMRect | null; // где было превью: оттуда фото «раскрывается»
  onClose: () => void;
};

const DUR = 260;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const NAV =
  "absolute top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25";

export default function ImageViewer({ images, start = 0, origin = null, onClose }: Props) {
  const first = Math.min(Math.max(start, 0), images.length - 1);
  const [i, setI] = useState(first);
  const [shown, setShown] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const touchX = useRef<number | null>(null);
  const played = useRef(false);
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // смещение и масштаб, чтобы фото совпало с превью
  const fromRect = useCallback((rect: DOMRect) => {
    const el = imgRef.current;
    if (!el) return "scale(0.92)";
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return "scale(0.92)";
    const dx = rect.left + rect.width / 2 - (r.left + r.width / 2);
    const dy = rect.top + rect.height / 2 - (r.top + r.height / 2);
    return `translate(${dx}px, ${dy}px) scale(${rect.width / r.width})`;
  }, []);

    const fit = useCallback(() => {
    const el = imgRef.current;
    if (!el || !el.naturalWidth || !el.naturalHeight) return;
    const s = Math.min(
        (window.innerWidth - 32) / el.naturalWidth,
        (window.innerHeight - 32) / el.naturalHeight
    );
    el.style.width = `${el.naturalWidth * s}px`;
    el.style.height = `${el.naturalHeight * s}px`;
    }, []);

  const play = useCallback(() => {
    const el = imgRef.current;
    if (!el || played.current) return;
    played.current = true;
    el.style.transition = "none";
    el.style.transform = origin ? fromRect(origin) : "scale(0.92)";
    el.style.opacity = origin ? "1" : "0";
    void el.offsetWidth; // фиксируем стартовое положение
    el.style.transition = `transform ${DUR}ms ${EASE}, opacity ${DUR}ms ${EASE}`;
    el.style.transform = "none";
    el.style.opacity = "1";
    setShown(true);
  }, [origin, fromRect]);

    useEffect(() => {
    if (imgRef.current?.complete) {
        fit();
        play();
    }
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
    }, [fit, play]);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = imgRef.current;
    setShown(false);
    if (el) {
      el.style.transition = `transform ${DUR}ms ${EASE}, opacity ${DUR}ms ${EASE}`;
      if (origin && i === first) {
        el.style.transform = fromRect(origin);
      } else {
        el.style.transform = "scale(0.92)";
        el.style.opacity = "0";
      }
    }
    timer.current = setTimeout(onClose, DUR);
  }, [origin, i, first, fromRect, onClose]);

  const go = useCallback(
    (d: number) => setI((c) => Math.min(Math.max(c + d, 0), images.length - 1)),
    [images.length]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [go, close]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  if (images.length === 0) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={close}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
      style={{ opacity: shown ? 1 : 0, transition: `opacity ${DUR}ms ease` }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        aria-label="Закрыть"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
      >
        <X size={22} />
      </button>

      {images.length > 1 && (
        <p className="absolute left-4 top-[max(1.25rem,env(safe-area-inset-top))] rounded-full bg-white/15 px-3 py-1 text-sm text-white backdrop-blur">
          {i + 1} / {images.length}
        </p>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={images[i]}
        alt=""
        draggable={false}
        onLoad={() => {
        fit();
        play();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "calc(100vw - 2rem)", maxHeight: "calc(100dvh - 2rem)" }}
        className="select-none rounded-2xl object-contain"
      />

      {i > 0 && (
        <button
          type="button"
          aria-label="Назад"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className={`${NAV} left-3`}
        >
          <ChevronLeft size={26} />
        </button>
      )}
      {i < images.length - 1 && (
        <button
          type="button"
          aria-label="Вперёд"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className={`${NAV} right-3`}
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>,
    document.body
  );
}
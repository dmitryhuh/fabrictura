"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import { GiftBackdrop, GiftModel, GiftPattern, giftUrl } from "@/lib/gifts";
import { PATTERN_PATHS, PATTERN_POINTS } from "@/lib/giftPatterns";

async function loadLottie() {
  return (await import("lottie-web/build/player/lottie_light")).default;
}

// Снимки первого кадра для моделей без PNG: делаются по одному и запоминаются
const snapshots = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();

function snapshot(path: string): Promise<string | null> {
  const hit = snapshots.get(path);
  if (hit) return Promise.resolve(hit);
  const job = queue.then(async (): Promise<string | null> => {
    const again = snapshots.get(path);
    if (again) return again;
    const lottie = await loadLottie();
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-9999px;top:0;width:256px;height:256px;pointer-events:none";
    document.body.appendChild(host);
    let anim: AnimationItem | undefined;
    try {
      anim = lottie.loadAnimation({
        container: host,
        renderer: "svg",
        loop: false,
        autoplay: false,
        path: giftUrl(path),
      });
      const a = anim;
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          a.addEventListener("DOMLoaded", () => resolve());
          a.addEventListener("data_failed", () => reject(new Error("data_failed")));
        }),
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
      a.goToAndStop(0, true);
      const svg = host.querySelector("svg");
      if (!svg) return null;
      const url =
        "data:image/svg+xml;charset=utf-8," +
        encodeURIComponent(new XMLSerializer().serializeToString(svg));
      snapshots.set(path, url);
      return url;
    } finally {
      anim?.destroy();
      host.remove();
    }
  });
  queue = job.catch(() => null);
  return job.catch(() => null);
}

// Узор: PNG красится в цвет узора фона (как в Telegram), без PNG рисуются запасные фигуры
function PatternLayer({ backdrop, pattern }: { backdrop: GiftBackdrop; pattern: GiftPattern }) {
  const id = "pm" + useId().replace(/[^a-zA-Z0-9]/g, "");

  if (pattern.png_path) {
    const href = giftUrl(pattern.png_path);
    return (
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id={id} style={{ maskType: "alpha" }}>
            {PATTERN_POINTS.map((p, i) => (
              <image
                key={i}
                href={href}
                x={-p.s / 2}
                y={-p.s / 2}
                width={p.s}
                height={p.s}
                opacity={p.o}
                transform={`translate(${p.x} ${p.y}) rotate(${p.rot})`}
              />
            ))}
          </mask>
        </defs>
        <rect width="100" height="100" fill={backdrop.pattern_color} mask={`url(#${id})`} />
      </svg>
    );
  }

  const d = PATTERN_PATHS[pattern.key];
  if (!d) return null;
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
      <g fill={backdrop.pattern_color} fillRule="evenodd">
        {PATTERN_POINTS.map((p, i) => (
          <path
            key={i}
            d={d}
            opacity={p.o}
            transform={`translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.s / 24}) translate(-12 -12)`}
          />
        ))}
      </g>
    </svg>
  );
}

type Props = {
  model: GiftModel | null;
  backdrop?: GiftBackdrop | null;
  pattern?: GiftPattern | null;
  animate?: boolean; // живая анимация (только в открытой карточке)
  loop?: boolean; // по умолчанию играет один раз
  className?: string;
};

export default function GiftArt({
  model,
  backdrop = null,
  pattern = null,
  animate = false,
  loop = false,
  className = "",
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [snapState, setSnapState] = useState<{ path: string; url: string } | null>(null);

  const path = model?.lottie_path ?? null;
  const png = model?.png_path ?? null;
  const snap = path
    ? snapshots.get(path) ?? (snapState?.path === path ? snapState.url : null)
    : null;
  const needSnap = !animate && !png && !!path && !snap;

  // снимок делаем только когда карточка попала на экран
  useEffect(() => {
    if (!needSnap || !path || !root.current) return;
    let off = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        snapshot(path).then((url) => {
          if (!off && url) setSnapState({ path, url });
        });
      },
      { rootMargin: "200px" }
    );
    io.observe(root.current);
    return () => {
      off = true;
      io.disconnect();
    };
  }, [needSnap, path]);

  useEffect(() => {
    if (!animate || !path || !live.current) return;
    let dead = false;
    let anim = null as AnimationItem | null;
    loadLottie().then((lottie) => {
      if (dead || !live.current) return;
      anim = lottie.loadAnimation({
        container: live.current,
        renderer: "svg",
        loop,
        autoplay: true,
        path: giftUrl(path),
      });
      anim.addEventListener("DOMLoaded", () => setReadyPath(path));
    });
    return () => {
      dead = true;
      anim?.destroy();
    };
  }, [animate, path, loop]);

  const still = png ? giftUrl(png) : snap;
  const showStill = !!still && !(animate && readyPath === path);

  const bg = backdrop
    ? `radial-gradient(circle at 50% 40%, ${backdrop.center_color}, ${backdrop.edge_color})`
    : "linear-gradient(135deg, #EFEFF1, #E4E4E7)";

  return (
    <div
      ref={root}
      className={`relative aspect-square overflow-hidden rounded-xl ${className}`}
      style={{ background: bg }}
    >
      {backdrop && pattern && <PatternLayer backdrop={backdrop} pattern={pattern} />}
      {showStill && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={still}
          alt={model?.name ?? ""}
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain p-3"
        />
      )}
      {animate && <div ref={live} className="absolute inset-0 p-3" />}
    </div>
  );
}
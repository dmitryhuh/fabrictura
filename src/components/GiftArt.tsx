"use client";

import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";
import { GiftBackdrop, GiftModel, giftUrl } from "@/lib/gifts";

type Props = {
  model: GiftModel | null;
  backdrop?: GiftBackdrop | null;
  animate?: boolean;
  className?: string;
};

export default function GiftArt({ model, backdrop = null, animate = false, className = "" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const path = model?.lottie_path;
  const usePng = !animate && !!model?.png_path;

  useEffect(() => {
    if (usePng || !path || !box.current) return;
    let dead = false;
    let anim = null as AnimationItem | null;
    import("lottie-web").then(({ default: lottie }) => {
      if (dead || !box.current) return;
      const a = lottie.loadAnimation({
        container: box.current,
        renderer: "svg",
        loop: animate,
        autoplay: animate,
        path: giftUrl(path),
      });
      // без анимации показываем первый кадр
      if (!animate) a.addEventListener("DOMLoaded", () => a.goToAndStop(0, true));
      anim = a;
    });
    return () => {
      dead = true;
      anim?.destroy();
    };
  }, [path, usePng, animate]);

  const bg = backdrop
    ? `radial-gradient(circle at 50% 40%, ${backdrop.center_color}, ${backdrop.edge_color})`
    : "linear-gradient(135deg, #EFEFF1, #E4E4E7)";

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-xl ${className}`}
      style={{ background: bg }}
    >
      {usePng && model?.png_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={giftUrl(model.png_path)}
          alt={model.name}
          loading="lazy"
          draggable={false}
          className="absolute inset-0 h-full w-full object-contain p-3"
        />
      ) : (
        <div ref={box} className="absolute inset-0 p-3" />
      )}
    </div>
  );
}
// Запасные фигуры (если у узора нет PNG), сетка 24x24
export const PATTERN_PATHS: Record<string, string> = {
  star: "M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.1L12 17.6 5.7 21.3l1.7-7.1L2 9.5l7.1-.6z",
  heart:
    "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 4.5 6.4 4.5c2.1 0 3.8 1.2 5.6 3.3 1.8-2.1 3.5-3.3 5.6-3.3 3.8 0 5.5 3.9 4 7.3C19.5 16.4 12 21 12 21z",
  circle: "M12 4a8 8 0 100 16 8 8 0 000-16z",
  drop: "M12 2.5S5 10 5 14.5a7 7 0 0014 0C19 10 12 2.5 12 2.5z",
  moon: "M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z",
  triangle: "M12 3l10 18H2z",
  cross: "M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z",
  diamond: "M12 2l8 10-8 10-8-10z",
  ring: "M12 3a9 9 0 100 18 9 9 0 000-18zm0 4a5 5 0 110 10 5 5 0 010-10z",
  bolt: "M13 2L4 14h6l-1 8 9-12h-6z",
};

type Point = { x: number; y: number; s: number; o: number; rot: number };

// кольца символов вокруг центра: ближе крупнее и ярче, дальше мельче и тусклее
const RINGS = [
  { r: 30, n: 7, s: 11, o: 0.5, off: 0 },
  { r: 41, n: 11, s: 9, o: 0.38, off: 0.5 },
  { r: 52, n: 14, s: 8, o: 0.26, off: 0.25 },
];

export const PATTERN_POINTS: Point[] = RINGS.flatMap((ring, ri) =>
  Array.from({ length: ring.n }, (_, i) => {
    const a = ((i + ring.off) / ring.n) * Math.PI * 2;
    return {
      x: 50 + Math.cos(a) * ring.r,
      y: 50 + Math.sin(a) * ring.r,
      s: ring.s,
      o: ring.o,
      rot: ((i * 53 + ri * 17) % 60) - 30,
    };
  })
);
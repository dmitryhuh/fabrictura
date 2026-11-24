type Point = { x: number; y: number; s: number; o: number; rot: number };

// кольца символов вокруг центра: ближе крупнее и ярче, дальше мельче и тусклее
const RINGS = [
  { r: 30, n: 5, s: 11, o: 0.5, off: 0 },
  { r: 42, n: 7, s: 9, o: 0.38, off: 0.5 },
  { r: 53, n: 9, s: 8, o: 0.26, off: 0.25 },
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
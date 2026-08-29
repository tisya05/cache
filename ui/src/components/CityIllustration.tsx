import { useEffect, useState } from "react";

/**
 * Picks one of five pre-rendered isometric city illustrations based on the
 * REAL block count from ledger state -- never fabricated. Replaces
 * IsometricCity (the Kenney-tile procedural renderer, kept in the repo as a
 * fallback -- see that file) as the primary City visual.
 */
const LEVELS: { max: number; src: string }[] = [
  { max: 0, src: "/city/city-1.jpeg" },
  { max: 4, src: "/city/city-2.jpeg" },
  { max: 12, src: "/city/city-3.jpeg" },
  { max: 24, src: "/city/city-4.jpeg" },
  { max: Infinity, src: "/city/city-5.jpeg" },
];

export function cityImageForBlocks(blocks: number): string {
  return LEVELS.find((l) => blocks <= l.max)!.src;
}

export function CityIllustration({ blocks }: { blocks: number }) {
  const target = cityImageForBlocks(blocks);
  const [current, setCurrent] = useState(target);
  const [fadingIn, setFadingIn] = useState(false);

  useEffect(() => {
    if (target === current) return;
    // Cross-fade: mount the new image at opacity 0, then flip it to 1 next
    // frame so the CSS transition actually animates instead of snapping.
    setCurrent(target);
    setFadingIn(false);
    const id = requestAnimationFrame(() => setFadingIn(true));
    return () => cancelAnimationFrame(id);
  }, [target, current]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl">
      <img
        src={current}
        alt="Your isometric city, built from earned blocks"
        className="absolute inset-0 h-full w-full object-contain transition-opacity duration-700"
        style={{ opacity: fadingIn || current === target ? 1 : 0 }}
        onLoad={() => setFadingIn(true)}
      />
    </div>
  );
}

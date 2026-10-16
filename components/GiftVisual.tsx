"use client";
import { useState } from "react";
import GiftArt from "./GiftArt";

// Real photos (CC BY / BY-SA, see README credits). Bundled locally so nothing
// depends on hotlinking. Unknown/custom gift ids fall back to original SVG art.
const PHOTOS: Record<string, string> = {
  g15: "/gifts/g15.png?v=3",
  g25: "/gifts/g25.png?v=3",
  g50: "/gifts/g50.png?v=3",
  g100: "/gifts/g100.png?v=3",
};

export default function GiftVisual({ giftId, theme, thumb, image, frame }: { giftId: string; theme: string; thumb?: boolean; image?: string; frame?: { scale: number; x: number; y: number } }) {
  const [err, setErr] = useState(false);
  const src = (!err && image) ? image : PHOTOS[giftId];
  if (!src || err) return <GiftArt giftId={giftId} theme={theme} />;
  const s = frame?.scale ?? 1, fx = frame?.x ?? 0, fy = frame?.y ?? 0;
  const t = s !== 1 || fx !== 0 || fy !== 0 ? { transform: `scale(${s}) translate(${fx}%, ${fy}%)` } : undefined;
  if (thumb) return <img className="gthumb" src={src} alt="" loading="lazy" style={t} onError={() => setErr(true)} />;
  return (
    <div className="photo">
      <img src={src} alt="" loading="lazy" style={t} onError={() => setErr(true)} />
    </div>
  );
}

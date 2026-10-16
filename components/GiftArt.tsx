"use client";
// Original SVG illustrations — one unique composition per gift.
export default function GiftArt({ giftId, theme }: { giftId: string; theme: string }) {
  if (giftId === "g15") return (
    <svg viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="mBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6ee7b7"/><stop offset="1" stopColor="#14b8a6"/></linearGradient>
        <linearGradient id="mRib" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fef3c7"/><stop offset="1" stopColor="#fbbf24"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="30" ry="7" fill="#0f172a" opacity=".12" />
      <rect x="28" y="66" width="64" height="36" rx="10" fill="url(#mBox)" />
      <rect x="55" y="66" width="10" height="36" fill="url(#mRib)" opacity=".9" />
      <rect x="24" y="56" width="72" height="14" rx="7" fill="#10b8a6" />
      {/* teddy */}
      <circle cx="46" cy="42" r="9" fill="#d6a87c" /><circle cx="74" cy="42" r="9" fill="#d6a87c" />
      <circle cx="46" cy="42" r="4" fill="#f5d7b3" /><circle cx="74" cy="42" r="4" fill="#f5d7b3" />
      <circle cx="60" cy="50" r="15" fill="#e3b98d" />
      <ellipse cx="60" cy="55" rx="7" ry="5.5" fill="#f7e3c6" />
      <circle cx="54" cy="47" r="2.2" fill="#1f2937" /><circle cx="66" cy="47" r="2.2" fill="#1f2937" />
      <ellipse cx="60" cy="53" rx="2.4" ry="1.8" fill="#92400e" />
      <path d="M40 62 q20 12 40 0" stroke="#fbbf24" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  );
  if (giftId === "g25") return (
    <svg viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="sBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7dd3fc"/><stop offset="1" stopColor="#6366f1"/></linearGradient>
        <linearGradient id="sCry" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#bae6fd"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="30" ry="7" fill="#0f172a" opacity=".12" />
      <rect x="30" y="68" width="60" height="34" rx="10" fill="url(#sBox)" />
      <rect x="55" y="68" width="10" height="34" fill="#fff" opacity=".85" />
      {/* crystal */}
      <path d="M60 12 L78 38 L60 62 L42 38 Z" fill="url(#sCry)" stroke="#38bdf8" strokeWidth="2" />
      <path d="M42 38 H78 M60 12 V62" stroke="#38bdf8" strokeWidth="1.4" opacity=".6" />
      <circle cx="88" cy="30" r="3" fill="#f0abfc" /><circle cx="34" cy="26" r="2.4" fill="#fde68a" /><circle cx="92" cy="58" r="2" fill="#fff" />
      <rect x="26" y="58" width="68" height="13" rx="6.5" fill="#1e3a8a" />
      <path d="M60 58 v13" stroke="#fbbf24" strokeWidth="5" />
    </svg>
  );
  if (giftId === "g50") return (
    <svg viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="lBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c4b5fd"/><stop offset="1" stopColor="#8b5cf6"/></linearGradient>
      </defs>
      <ellipse cx="60" cy="106" rx="32" ry="7" fill="#0f172a" opacity=".14" />
      {/* stars bg */}
      <path d="M30 30 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5z" fill="#fde68a" />
      <path d="M92 22 l2 4.4 4.4 2 -4.4 2 -2 4.4 -2 -4.4 -4.4 -2 4.4 -2z" fill="#f9a8d4" />
      <rect x="28" y="66" width="64" height="36" rx="12" fill="url(#lBox)" />
      <rect x="54" y="66" width="12" height="36" fill="#f5f3ff" opacity=".9" />
      <rect x="24" y="56" width="72" height="14" rx="7" fill="#6d28d9" />
      {/* crown */}
      <path d="M42 44 L46 28 L54 38 L60 24 L66 38 L74 28 L78 44 Z" fill="#fbbf24" stroke="#b45309" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="60" cy="49" r="3" fill="#ef4444" />
    </svg>
  );
  return (
    <svg viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="pCh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fcd34d"/><stop offset="1" stopColor="#f97316"/></linearGradient>
        <radialGradient id="pGlow" cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#fef9c3"/><stop offset="1" stopColor="#fb923c" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="60" cy="58" r="44" fill="url(#pGlow)" opacity=".8" />
      <ellipse cx="60" cy="106" rx="32" ry="7" fill="#0f172a" opacity=".15" />
      <rect x="26" y="70" width="68" height="32" rx="9" fill="#92400e" />
      <rect x="26" y="70" width="68" height="10" rx="5" fill="url(#pCh)" />
      <rect x="55" y="70" width="10" height="32" fill="url(#pCh)" />
      <circle cx="60" cy="86" r="6" fill="#fde68a" stroke="#b45309" strokeWidth="2" />
      <path d="M46 66 q-6 -14 4 -20 q2 8 8 10 q0 -8 6 -12 q4 10 -2 18" fill="#34d399" />
      <path d="M74 66 q6 -14 -4 -20 q-2 8 -8 10 q0 -8 -6 -12 q-4 10 2 18" fill="#2dd4bf" />
      <path d="M60 52 l2.2 4.6 4.6 2.2 -4.6 2.2 -2.2 4.6 -2.2 -4.6 -4.6 -2.2 4.6 -2.2z" fill="#fff" />
    </svg>
  );
}

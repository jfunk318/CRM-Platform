import type { CSSProperties, ReactNode } from "react";
import type { ArtKey } from "@/lib/store/banner-art";

// SVG banner art in the store's colors (CSS variables set by its theme), so
// one drawing suits every team and brand. Deterministic, so the server and
// browser draw the same thing; `uid` keeps gradient ids apart when several
// are on one page.

const A = "var(--accent)";
const S = "var(--st-subtle)";
const B = "var(--st-bg)";
const T = "var(--st-text)";
const mix = (color: string, pct: number, base = "transparent") => `color-mix(in srgb, ${color} ${pct}%, ${base})`;
const fill = (c: string): CSSProperties => ({ fill: c });
const stroke = (c: string): CSSProperties => ({ stroke: c, fill: "none" });
const W = "#ffffff";
const K = "#000000";

/** A closed wobbly ring around (cx, cy), for contour lines. */
function ring(cx: number, cy: number, r: number, k: number) {
  const pts: string[] = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const rr = r * (1 + 0.16 * Math.sin(3 * a + k * 0.4) + 0.07 * Math.sin(7 * a - k * 0.2));
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * 0.72 * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

const STARS = [
  [120, 60], [260, 140], [410, 40], [560, 110], [700, 30], [880, 90], [1010, 50], [1160, 130], [1290, 40], [1420, 100], [1540, 60], [340, 230], [960, 200], [1480, 220], [70, 250], [640, 210],
];

function draw(art: ArtKey, uid: string): ReactNode {
  const id = (n: string) => `${uid}-${n}`;
  switch (art) {
    case "shapes":
      return (
        <>
          <defs>
            <pattern id={id("dots")} width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="2.4" style={fill(mix(A, 35))} />
            </pattern>
          </defs>
          <rect width="1600" height="640" style={fill(S)} />
          <circle cx="1240" cy="190" r="330" style={fill(mix(A, 14))} />
          <circle cx="1470" cy="540" r="210" style={fill(mix(A, 30))} />
          <rect x="1300" y="40" width="250" height="170" fill={`url(#${id("dots")})`} />
          <circle cx="960" cy="470" r="150" strokeWidth="2" style={stroke(mix(A, 45))} />
          <circle cx="960" cy="470" r="108" strokeWidth="2" style={stroke(mix(A, 25))} />
          <rect x="1070" y="330" width="170" height="170" rx="26" transform="rotate(18 1155 415)" style={fill(mix(A, 24))} />
          <circle cx="1120" cy="120" r="24" style={fill(A)} />
          <path d="M760 150 q40 -40 80 0 t80 0 t80 0 t80 0" strokeWidth="7" strokeLinecap="round" style={stroke(A)} />
          <path d="M1380 330 l60 0 M1410 300 l0 60" strokeWidth="7" strokeLinecap="round" style={stroke(mix(A, 70))} />
        </>
      );
    case "lines":
      return (
        <>
          <rect width="1600" height="640" style={fill(S)} />
          {Array.from({ length: 24 }, (_, i) => (
            <path key={i} d={`M-50 ${120 + i * 16} C 500 ${-60 + i * 34}, 1000 ${640 - i * 10}, 1650 ${60 + i * 22}`} strokeWidth="1.6" style={stroke(mix(A, 12 + i * 2.6))} />
          ))}
          <circle cx="1330" cy="150" r="70" style={fill(mix(A, 18))} />
        </>
      );
    case "speed":
      return (
        <>
          <defs>
            <pattern id={id("dots")} width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="9" r="3.2" style={fill(mix(W, 26))} />
            </pattern>
            <linearGradient id={id("fade")} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0.45" stopColor="#000" />
              <stop offset="1" stopColor="#fff" />
            </linearGradient>
            <mask id={id("mask")}>
              <rect width="1600" height="640" fill={`url(#${id("fade")})`} />
            </mask>
          </defs>
          <rect width="1600" height="640" style={fill(A)} />
          <rect width="1600" height="640" fill={`url(#${id("dots")})`} mask={`url(#${id("mask")})`} />
          <g transform="skewX(-24)">
            <rect x="1060" y="0" width="110" height="640" style={fill(mix(W, 12))} />
            <rect x="1200" y="0" width="34" height="640" style={fill(mix(W, 20))} />
            <rect x="1270" y="0" width="240" height="640" style={fill(mix(K, 14))} />
            <rect x="1540" y="0" width="70" height="640" style={fill(mix(W, 16))} />
            <rect x="1650" y="0" width="16" height="640" style={fill(mix(W, 34))} />
            <rect x="1700" y="0" width="200" height="640" style={fill(mix(K, 10))} />
          </g>
          <rect x="0" y="600" width="1600" height="10" style={fill(mix(W, 22))} />
          <rect x="0" y="620" width="1600" height="20" style={fill(mix(K, 16))} />
        </>
      );
    case "field": {
      const numbers = [10, 20, 30, 40, 50, 40, 30, 20, 10];
      return (
        <>
          <rect width="1600" height="640" style={fill(A)} />
          <rect width="1600" height="640" style={fill(mix(K, 12))} />
          {Array.from({ length: 18 }, (_, i) => {
            const x = 35 + i * 90;
            return (
              <g key={i}>
                <line x1={x} y1="0" x2={x} y2="640" strokeWidth="3" style={stroke(mix(W, 24))} />
                {[1, 2, 3, 4].map((h) => (
                  <g key={h}>
                    <line x1={x + h * 18} y1="214" x2={x + h * 18} y2="236" strokeWidth="3" style={stroke(mix(W, 18))} />
                    <line x1={x + h * 18} y1="404" x2={x + h * 18} y2="426" strokeWidth="3" style={stroke(mix(W, 18))} />
                  </g>
                ))}
                {i % 2 === 1 && (
                  <>
                    <text x={x} y="590" textAnchor="middle" fontSize="76" fontWeight="700" style={{ fill: mix(W, 16), fontFamily: "var(--st-font-heading)" }}>{numbers[(i - 1) / 2]}</text>
                    <text x={x} y="590" textAnchor="middle" fontSize="76" fontWeight="700" transform={`rotate(180 ${x} 320)`} style={{ fill: mix(W, 16), fontFamily: "var(--st-font-heading)" }}>{numbers[(i - 1) / 2]}</text>
                  </>
                )}
              </g>
            );
          })}
        </>
      );
    }
    case "grid":
      return (
        <>
          <defs>
            <radialGradient id={id("glow")} cx="50%" cy="60%" r="55%">
              <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.55 }} />
              <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            </radialGradient>
            <linearGradient id={id("fade")} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.6" stopColor="#fff" />
            </linearGradient>
            <mask id={id("mask")}>
              <rect y="380" width="1600" height="260" fill={`url(#${id("fade")})`} />
            </mask>
          </defs>
          <rect width="1600" height="640" style={fill(B)} />
          <rect width="1600" height="640" fill={`url(#${id("glow")})`} />
          {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.4} style={fill(mix(T, 60))} />)}
          <g mask={`url(#${id("mask")})`}>
            {Array.from({ length: 41 }, (_, i) => i - 20).map((i) => (
              <line key={i} x1={800 + i * 14} y1="380" x2={800 + i * 170} y2="640" strokeWidth="1.5" style={stroke(mix(A, 55))} />
            ))}
            {Array.from({ length: 9 }, (_, k) => {
              const y = 380 + 260 * ((k + 1) / 9) ** 1.8;
              return <line key={k} x1="0" y1={y} x2="1600" y2={y} strokeWidth="1.5" style={stroke(mix(A, 35 + k * 6))} />;
            })}
          </g>
          <line x1="0" y1="380" x2="1600" y2="380" strokeWidth="2" style={stroke(A)} />
        </>
      );
    case "aurora":
      return (
        <>
          <defs>
            <filter id={id("blur")} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="70" />
            </filter>
          </defs>
          <rect width="1600" height="640" style={fill(B)} />
          <g filter={`url(#${id("blur")})`}>
            <ellipse cx="380" cy="190" rx="430" ry="110" transform="rotate(-12 380 190)" style={fill(mix(A, 60))} />
            <ellipse cx="1180" cy="290" rx="470" ry="130" transform="rotate(10 1180 290)" style={fill(mix(mix(A, 50, "#8b5cf6"), 55))} />
            <ellipse cx="820" cy="560" rx="540" ry="100" style={fill(mix(mix(A, 45, "#10b981"), 35))} />
          </g>
          {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y * 2.2} r={i % 3 ? 1.4 : 2.2} style={fill(mix(T, 55))} />)}
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M-40 ${300 + i * 40} C 400 ${180 + i * 30}, 1000 ${460 - i * 20}, 1640 ${260 + i * 30}`} strokeWidth="1.2" style={stroke(mix(T, 18))} />
          ))}
        </>
      );
    case "deco":
      return (
        <>
          <defs>
            <pattern id={id("fan")} width="160" height="160" patternUnits="userSpaceOnUse">
              {[[80, 80], [0, 160], [160, 160], [0, 0], [160, 0]].map(([cx, cy], j) =>
                [18, 36, 54, 72, 80].map((r) => (
                  <path key={`${j}-${r}`} d={`M${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} strokeWidth={r === 80 ? 1.6 : 1} style={stroke(mix(A, r === 80 ? 70 : 45))} />
                )),
              )}
            </pattern>
            <radialGradient id={id("hole")} cx="50%" cy="50%" r="60%">
              <stop offset="0.35" stopColor="#000" />
              <stop offset="0.85" stopColor="#fff" />
            </radialGradient>
            <mask id={id("mask")}>
              <rect width="1600" height="640" fill={`url(#${id("hole")})`} />
            </mask>
          </defs>
          <rect width="1600" height="640" style={fill(S)} />
          <rect width="1600" height="640" fill={`url(#${id("fan")})`} mask={`url(#${id("mask")})`} />
          <rect x="28" y="28" width="1544" height="584" strokeWidth="1.4" style={stroke(mix(A, 70))} />
          <rect x="40" y="40" width="1520" height="560" strokeWidth="0.8" style={stroke(mix(A, 50))} />
          <path d="M770 80 L800 50 L830 80 M770 560 L800 590 L830 560" strokeWidth="1.4" style={stroke(A)} />
        </>
      );
    case "silk":
      return (
        <>
          <defs>
            <linearGradient id={id("sheen")} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.04 }} />
              <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0.32 }} />
            </linearGradient>
          </defs>
          <rect width="1600" height="640" style={fill(S)} />
          {[420, 480, 545, 610].map((y, i) => (
            <g key={y}>
              <path d={`M0 ${y} C 420 ${y - 150 + i * 20}, 900 ${y + 150}, 1600 ${y - 90} L1600 640 L0 640 Z`} fill={`url(#${id("sheen")})`} />
              <path d={`M0 ${y} C 420 ${y - 150 + i * 20}, 900 ${y + 150}, 1600 ${y - 90}`} strokeWidth="1" style={stroke(mix(A, 55))} />
            </g>
          ))}
          {[90, 140].map((y, i) => (
            <path key={y} d={`M500 0 C 800 ${y + 60}, 1150 ${y - 50}, 1600 ${y + 70} L1600 0 Z`} fill={`url(#${id("sheen")})`} opacity={0.7 - i * 0.2} />
          ))}
        </>
      );
    case "hills": {
      const trees = [[180, 430], [215, 424], [250, 432], [1250, 392], [1290, 386], [1330, 395], [1370, 404]];
      return (
        <>
          <rect width="1600" height="640" style={fill(S)} />
          <circle cx="1180" cy="210" r="88" style={fill(mix(A, 32))} />
          <path d="M300 150 l14 10 l14 -10 M350 120 l11 8 l11 -8 M400 165 l9 6 l9 -6" strokeWidth="3" strokeLinecap="round" style={stroke(mix(T, 35))} />
          <path d="M0 380 C 200 300, 380 330, 560 360 S 900 260, 1120 330 S 1450 300, 1600 340 V640 H0Z" style={fill(mix(A, 24, B))} />
          <path d="M0 450 C 250 380, 500 430, 760 410 S 1200 360, 1600 430 V640 H0Z" style={fill(mix(A, 45, B))} />
          {trees.map(([x, y]) => <path key={x} d={`M${x} ${y - 64} L${x - 20} ${y + 4} L${x + 20} ${y + 4} Z`} style={fill(mix(A, 62, T))} />)}
          <path d="M0 520 C 300 470, 600 540, 900 500 S 1350 470, 1600 520 V640 H0Z" style={fill(mix(A, 70, T))} />
          <path d="M0 590 C 400 560, 900 610, 1600 570 V640 H0Z" style={fill(mix(A, 55, T))} />
        </>
      );
    }
    case "topo":
      return (
        <>
          <rect width="1600" height="640" style={fill(S)} />
          {Array.from({ length: 16 }, (_, k) => (
            <path key={`a${k}`} d={ring(1170, 250, 22 + k * 30, k)} strokeWidth={k % 5 === 4 ? 2.2 : 1.2} style={stroke(mix(A, k % 5 === 4 ? 60 : 32))} />
          ))}
          {Array.from({ length: 11 }, (_, k) => (
            <path key={`b${k}`} d={ring(330, 560, 20 + k * 32, k + 3)} strokeWidth={k % 5 === 4 ? 2.2 : 1.2} style={stroke(mix(A, k % 5 === 4 ? 60 : 32))} />
          ))}
          <path d="M1162 244 l8 -14 l8 14 Z" style={fill(A)} />
        </>
      );
  }
}

/** Fills its (positioned) parent with the art. */
export function BannerArt({ art, uid, className = "", anchor = "center" }: { art: ArtKey; uid: string; className?: string; /** Which side to keep when cropped to a narrower box: the drawings' focal points are on the right. */ anchor?: "center" | "right" }) {
  return (
    <svg viewBox="0 0 1600 640" preserveAspectRatio={anchor === "right" ? "xMaxYMid slice" : "xMidYMid slice"} className={`absolute inset-0 h-full w-full ${className}`} aria-hidden="true" data-art={art}>
      {draw(art, uid)}
    </svg>
  );
}

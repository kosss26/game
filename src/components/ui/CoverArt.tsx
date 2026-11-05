/**
 * Процедурные SVG-обложки историй. Без внешних изображений: лёгкие,
 * чёткие на любом экране, в одном стиле.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pine(x: number, base: number, h: number): string {
  const w = h * 0.36;
  const tiers = 4;
  let d = `M${x},${base - h}`;
  for (let i = 1; i <= tiers; i++) {
    const y = base - h + (h * 0.85 * i) / tiers;
    const half = (w / 2) * (0.45 + (0.55 * i) / tiers);
    d += ` L${x + half},${y} L${x + half * 0.45},${y}`;
  }
  d += ` L${x + w * 0.06},${base} L${x - w * 0.06},${base}`;
  for (let i = tiers; i >= 1; i--) {
    const y = base - h + (h * 0.85 * i) / tiers;
    const half = (w / 2) * (0.45 + (0.55 * i) / tiers);
    d += ` L${x - half * 0.45},${y} L${x - half},${y}`;
  }
  return d + " Z";
}

function forestRow(seed: number, base: number, minH: number, maxH: number, step: number): string {
  const r = rng(seed);
  let d = "";
  for (let x = -20; x < 420; x += step * (0.6 + r() * 0.7)) {
    d += pine(x, base + r() * 6, minH + r() * (maxH - minH)) + " ";
  }
  return d + `M-20,${base} H420 V320 H-20 Z`;
}

function Stars({ seed, count, maxY }: { seed: number; count: number; maxY: number }) {
  const r = rng(seed);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const big = r() > 0.9;
        return <circle key={i} cx={r() * 400} cy={r() * maxY} r={big ? 1.3 : 0.6 + r() * 0.5} fill="white" opacity={0.25 + r() * 0.6} />;
      })}
    </g>
  );
}

function Forest() {
  return (
    <>
      <defs>
        <linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#070912" />
          <stop offset="0.55" stopColor="#111a33" />
          <stop offset="1" stopColor="#1d2b4a" />
        </linearGradient>
        <radialGradient id="fmoon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f4f1e6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f4f1e6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ffog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9fb3d9" stopOpacity="0" />
          <stop offset="1" stopColor="#9fb3d9" stopOpacity="0.22" />
        </linearGradient>
        <radialGradient id="fwin" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="320" fill="url(#fsky)" />
      <Stars seed={7} count={90} maxY={170} />
      <circle cx="300" cy="78" r="70" fill="url(#fmoon)" />
      <circle cx="300" cy="78" r="22" fill="#efeadb" />
      <circle cx="292" cy="72" r="4" fill="#d9d3c2" opacity="0.7" />
      <circle cx="308" cy="86" r="3" fill="#d9d3c2" opacity="0.6" />
      <path d={forestRow(3, 210, 50, 90, 22)} fill="#16213a" />
      {/* Корпус санатория */}
      <g>
        <rect x="120" y="168" width="150" height="62" fill="#0e1528" />
        <polygon points="112,170 195,140 278,170" fill="#0c1222" />
        <rect x="186" y="150" width="18" height="22" fill="#0e1528" />
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={i} x={132 + i * 22} y={186} width="10" height="14" fill={i === 4 ? "#ffcf7a" : "#1a2440"} />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <rect key={`b${i}`} x={132 + i * 22} y={208} width="10" height="14" fill="#1a2440" />
        ))}
        <circle cx="225" cy="193" r="18" fill="url(#fwin)" />
      </g>
      <path d={forestRow(11, 250, 70, 120, 26)} fill="#0b1120" />
      <rect y="200" width="400" height="80" fill="url(#ffog)" />
      <path d={forestRow(23, 300, 90, 150, 34)} fill="#05070e" />
    </>
  );
}

function Noir() {
  const r = rng(42);
  const buildings = Array.from({ length: 14 }, (_, i) => ({ x: i * 30 - 10, w: 22 + r() * 18, h: 80 + r() * 140 }));
  return (
    <>
      <defs>
        <linearGradient id="nsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0a10" />
          <stop offset="1" stopColor="#2a1f3d" />
        </linearGradient>
      </defs>
      <rect width="400" height="320" fill="url(#nsky)" />
      {buildings.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={320 - b.h} width={b.w} height={b.h} fill="#0b0b12" />
          {Array.from({ length: Math.floor(b.h / 16) }, (_, j) =>
            r() > 0.78 ? <rect key={j} x={b.x + 4 + (j % 2) * 8} y={330 - b.h + j * 14} width="4" height="6" fill="#f2c66d" opacity={0.5 + r() * 0.5} /> : null
          )}
        </g>
      ))}
      {Array.from({ length: 70 }, (_, i) => {
        const x = r() * 420;
        const y = r() * 320;
        return <line key={i} x1={x} y1={y} x2={x - 4} y2={y + 16} stroke="#9aa7c7" strokeOpacity="0.2" strokeWidth="1" />;
      })}
    </>
  );
}

function Romance() {
  return (
    <>
      <defs>
        <linearGradient id="rsky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b0b1d" />
          <stop offset="0.6" stopColor="#4a1838" />
          <stop offset="1" stopColor="#f08a7a" />
        </linearGradient>
      </defs>
      <rect width="400" height="320" fill="url(#rsky)" />
      <Stars seed={5} count={50} maxY={200} />
      <circle cx="200" cy="230" r="90" fill="#ffb59a" opacity="0.25" />
      <circle cx="200" cy="230" r="50" fill="#ffd1b8" opacity="0.4" />
      <path d="M0 270 Q100 240 200 262 T400 255 V320 H0 Z" fill="#1a0915" />
    </>
  );
}

function Thriller() {
  return (
    <>
      <defs>
        <radialGradient id="tsky" cx="0.5" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#3a0d10" />
          <stop offset="1" stopColor="#070505" />
        </radialGradient>
      </defs>
      <rect width="400" height="320" fill="url(#tsky)" />
      <path d="M0 320 L120 160 L160 200 L210 120 L260 210 L300 170 L400 320 Z" fill="#050303" />
      <circle cx="210" cy="90" r="14" fill="#ff4a4a" opacity="0.8" />
      <circle cx="210" cy="90" r="40" fill="#ff4a4a" opacity="0.12" />
    </>
  );
}

function Mystery() {
  return (
    <>
      <defs>
        <linearGradient id="msky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#05101a" />
          <stop offset="1" stopColor="#0f3a4a" />
        </linearGradient>
      </defs>
      <rect width="400" height="320" fill="url(#msky)" />
      <Stars seed={9} count={70} maxY={220} />
      <path d="M0 250 Q200 210 400 250 V320 H0 Z" fill="#06141d" />
      <path d="M190 250 L196 120 L204 120 L210 250 Z" fill="#081a25" />
      <polygon points="200,105 186,122 214,122" fill="#081a25" />
      <path d="M200 112 L380 60 L380 90 Z" fill="#f7f3c2" opacity="0.12" />
    </>
  );
}

function Winter() {
  const r = rng(91);
  return (
    <>
      <defs>
        <linearGradient id="wsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c1118" />
          <stop offset="0.6" stopColor="#1f2c3c" />
          <stop offset="1" stopColor="#3a4a5c" />
        </linearGradient>
        <linearGradient id="wice" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d9fb3" stopOpacity="0.55" />
          <stop offset="1" stopColor="#d9e3ee" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="wwin" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd48a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffd48a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wlamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#bfe3ff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#bfe3ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="320" fill="url(#wsky)" />
      {/* дальний берег */}
      <path d={forestRow(41, 172, 22, 44, 14)} fill="#2a3746" />
      {/* дом на холме */}
      <g>
        <path d="M58 150 L120 112 L182 150 Z" fill="#141b25" />
        <rect x="70" y="148" width="100" height="44" fill="#18212d" />
        <rect x="112" y="122" width="16" height="12" fill="#ffd48a" opacity="0.9" />
        <circle cx="120" cy="128" r="22" fill="url(#wwin)" />
        <rect x="84" y="160" width="12" height="14" fill="#2b3644" />
        <rect x="144" y="160" width="12" height="14" fill="#2b3644" />
        <path d="M58 150 L120 112 L182 150" fill="none" stroke="#dfe8f2" strokeWidth="3" opacity="0.85" />
      </g>
      {/* лёд */}
      <path d="M0 205 Q200 190 400 205 V320 H0 Z" fill="url(#wice)" />
      {/* лодочный сарай и мостки */}
      <g>
        <rect x="258" y="176" width="70" height="36" fill="#111821" />
        <path d="M250 178 L293 156 L336 178 Z" fill="#0d131b" />
        <path d="M250 178 L293 156 L336 178" fill="none" stroke="#e6eef6" strokeWidth="2.5" opacity="0.9" />
        <rect x="286" y="190" width="14" height="22" fill="#05080c" />
        <rect x="322" y="206" width="60" height="4" fill="#0f151d" />
        <circle cx="292" cy="200" r="30" fill="url(#wlamp)" />
      </g>
      {/* тропинка следов */}
      {Array.from({ length: 9 }, (_, i) => (
        <ellipse key={i} cx={160 + i * 12 + (i % 2) * 4} cy={196 + i * 1.6} rx="2.2" ry="1.2" fill="#55657a" opacity="0.7" />
      ))}
      <path d={forestRow(63, 320, 70, 130, 30)} fill="#070a0f" />
      {/* снег */}
      {Array.from({ length: 130 }, (_, i) => (
        <circle key={i} cx={r() * 400} cy={r() * 320} r={0.6 + r() * 1.6} fill="white" opacity={0.35 + r() * 0.5} />
      ))}
    </>
  );
}

const STYLES: Record<string, () => React.JSX.Element> = {
  forest: Forest,
  winter: Winter,
  noir: Noir,
  romance: Romance,
  thriller: Thriller,
  mystery: Mystery,
};

export function CoverArt({ style, className = "" }: { style?: string | null; className?: string }) {
  const Art = STYLES[style || "forest"] || Forest;
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <Art />
    </svg>
  );
}

export const COVER_STYLES = Object.keys(STYLES);

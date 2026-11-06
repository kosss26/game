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

function Aurora() {
  const r = rng(77);
  return (
    <>
      <defs>
        <linearGradient id="asky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#050812" />
          <stop offset="0.55" stopColor="#0d1a2b" />
          <stop offset="1" stopColor="#14263a" />
        </linearGradient>
        <linearGradient id="aur1" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3cf2a5" stopOpacity="0" />
          <stop offset="0.3" stopColor="#3cf2a5" stopOpacity="0.55" />
          <stop offset="0.7" stopColor="#6ad7ff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#b48cff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="aur2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <mask id="aurm">
          <rect width="400" height="320" fill="url(#aur2)" />
        </mask>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1624" />
          <stop offset="1" stopColor="#04070c" />
        </linearGradient>
        <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="320" fill="url(#asky)" />
      <Stars seed={13} count={70} maxY={150} />
      {/* северное сияние */}
      <g mask="url(#aurm)">
        <path d="M-20 70 C 60 20, 120 120, 200 60 S 330 10, 420 80 L420 140 C 330 70, 260 150, 190 110 S 60 80, -20 130 Z" fill="url(#aur1)" opacity="0.8" />
        <path d="M-20 40 C 80 90, 150 10, 230 50 S 360 90, 420 30 L420 70 C 340 120, 260 40, 200 90 S 60 30, -20 80 Z" fill="url(#aur1)" opacity="0.45" />
        {Array.from({ length: 26 }, (_, i) => (
          <rect key={i} x={i * 16 + r() * 6} y={30 + r() * 30} width="2" height={40 + r() * 60} fill="#7affc8" opacity={0.12 + r() * 0.15} />
        ))}
      </g>
      {/* особняк */}
      <g>
        <rect x="40" y="150" width="250" height="90" fill="#0a111c" />
        <rect x="120" y="128" width="90" height="24" fill="#0a111c" />
        <path d="M112 130 L165 108 L218 130 Z" fill="#08101a" />
        {Array.from({ length: 9 }, (_, i) =>
          [160, 192].map(y => {
            const lit = (i === 3 && y === 160) || (i === 4 && y === 160) || (i === 5 && y === 160) || r() > 0.82;
            return <rect key={`${i}-${y}`} x={52 + i * 26} y={y} width="12" height="20" rx="1" fill={lit ? "#ffcf7a" : "#16233a"} opacity={lit ? 0.92 : 1} />;
          })
        )}
        <circle cx="165" cy="170" r="42" fill="url(#lamp)" opacity="0.45" />
      </g>
      <path d="M290 160 h80 v80 h-80z" fill="#070d16" />
      {/* набережная и фонари */}
      <rect x="0" y="238" width="400" height="6" fill="#1b2a3c" />
      {[30, 120, 210, 300, 380].map(x => (
        <g key={x}>
          <rect x={x} y="214" width="2" height="24" fill="#2b3a4d" />
          <circle cx={x + 1} cy="213" r="2.5" fill="#ffd38a" />
          <circle cx={x + 1} cy="213" r="12" fill="url(#lamp)" opacity="0.6" />
        </g>
      ))}
      {/* вода и отражения */}
      <rect x="0" y="244" width="400" height="76" fill="url(#water)" />
      {Array.from({ length: 34 }, (_, i) => {
        const x = r() * 400;
        const y = 250 + r() * 66;
        const warm = r() > 0.55;
        return <rect key={i} x={x} y={y} width={8 + r() * 30} height="1.4" fill={warm ? "#ffcf7a" : "#5fe0b0"} opacity={0.15 + r() * 0.3} />;
      })}
      {/* мост */}
      <path d="M250 244 Q 330 200 410 244" fill="none" stroke="#1d2d40" strokeWidth="8" />
    </>
  );
}


function Perseids() {
  const r = rng(444);
  const meteors = [
    { x: 300, y: 30, len: 120 },
    { x: 220, y: 70, len: 70 },
    { x: 360, y: 90, len: 90 },
    { x: 150, y: 20, len: 55 },
    { x: 260, y: 125, len: 40 },
  ];
  return (
    <>
      <defs>
        <linearGradient id="psky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07061a" />
          <stop offset="0.6" stopColor="#1a1440" />
          <stop offset="1" stopColor="#2c1f52" />
        </linearGradient>
        <linearGradient id="ptrail" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#e9e4ff" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="pgreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6dffb5" stopOpacity="0" />
          <stop offset="1" stopColor="#b9ffd8" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="pglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="priver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1640" />
          <stop offset="1" stopColor="#07061a" />
        </linearGradient>
      </defs>
      <rect width="400" height="320" fill="url(#psky)" />
      <Stars seed={44} count={120} maxY={210} />
      {/* кольцо — петля */}
      <circle cx="120" cy="96" r="58" fill="none" stroke="#8b7cf6" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="2 5" />
      <circle cx="120" cy="96" r="44" fill="none" stroke="#8b7cf6" strokeOpacity="0.18" strokeWidth="1" />
      {/* метеоры */}
      {meteors.map((m, i) => (
        <line key={i} x1={m.x - m.len} y1={m.y - m.len * 0.55} x2={m.x} y2={m.y} stroke="url(#ptrail)" strokeWidth={i === 0 ? 2.2 : 1.4} strokeLinecap="round" />
      ))}
      {/* Фонарщик — зелёный */}
      <line x1="40" y1="110" x2="118" y2="150" stroke="url(#pgreen)" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="118" cy="150" r="2.6" fill="#d9ffe9" />
      {/* холм и башня */}
      <path d="M0 240 C 60 200, 140 196, 210 236 L 210 320 L 0 320 Z" fill="#0b0920" />
      <g fill="#05040f">
        <rect x="96" y="150" width="8" height="64" />
        <rect x="124" y="150" width="8" height="64" />
        <path d="M90 214 L138 214 L132 150 L96 150 Z" opacity="0.9" />
        <rect x="84" y="128" width="60" height="26" rx="3" />
        <path d="M80 130 L114 112 L148 130 Z" />
      </g>
      <rect x="108" y="136" width="6" height="8" fill="#ffcf7a" opacity="0.9" />
      <circle cx="111" cy="140" r="14" fill="url(#pglow)" opacity="0.5" />
      {/* городок */}
      <path d="M200 252 h200 v20 h-200z" fill="#0a0820" />
      {Array.from({ length: 22 }, (_, i) => {
        const x = 205 + i * 9 + r() * 3;
        const h = 6 + r() * 16;
        return <rect key={i} x={x} y={252 - h} width="7" height={h} fill="#0a0820" />;
      })}
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={`w${i}`} x={208 + r() * 186} y={236 + r() * 14} width="2" height="2" fill="#ffcf7a" opacity={0.5 + r() * 0.5} />
      ))}
      {/* река и мост */}
      <rect x="0" y="268" width="400" height="52" fill="url(#priver)" />
      {Array.from({ length: 26 }, (_, i) => (
        <rect key={`r${i}`} x={r() * 400} y={272 + r() * 44} width={6 + r() * 26} height="1.2" fill={r() > 0.7 ? "#b9ffd8" : "#e9e4ff"} opacity={0.12 + r() * 0.25} />
      ))}
      <path d="M180 268 L 400 262" stroke="#14112e" strokeWidth="7" />
      {[200, 250, 300, 350].map(x => (
        <rect key={x} x={x} y={262 - (x - 180) * 0.027} width="3" height="14" fill="#14112e" />
      ))}
      <rect x="282" y="259" width="26" height="4" fill="#e0a34a" opacity="0.7" />
    </>
  );
}

const STYLES: Record<string, () => React.JSX.Element> = {
  perseids: Perseids,
  forest: Forest,
  winter: Winter,
  aurora: Aurora,
  noir: Noir,
  romance: Romance,
  thriller: Thriller,
  mystery: Mystery,
};

const ILLUSTRATIONS: Record<string, string> = {
  perseids: "petlya", winter: "beliy-shum", forest: "tihiy-chas", aurora: "severnoe-siyanie", radio: "ne-spitsya",
};

export function CoverArt({ style, className = "", thumbnail = false, priority = false }: { style?: string | null; className?: string; thumbnail?: boolean; priority?: boolean }) {
  const cover = ILLUSTRATIONS[style || "forest"];
  if (cover) {
    // Decorative cover: the surrounding card already names the story.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/story-covers/${cover}-${thumbnail ? 320 : 640}.webp`}
        srcSet={thumbnail ? undefined : `/story-covers/${cover}-640.webp 640w, /story-covers/${cover}-1200.webp 1200w`}
        sizes={thumbnail ? undefined : "(max-width: 480px) 100vw, 480px"}
        width={thumbnail ? 320 : 1200} height={thumbnail ? 213 : 800}
        alt="" className={`story-illustration ${className}`}
        loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : undefined} decoding="async"
      />
    );
  }
  const Art = STYLES[style || "forest"] || Forest;
  return (
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <Art />
    </svg>
  );
}

export const COVER_STYLES = Object.keys(STYLES);

import type { SVGProps } from "react";

const PATHS = {
  back: "M15 18l-6-6 6-6",
  chevron: "M9 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
  send: "M4 12l16-8-6 16-2.5-6.5L4 12z",
  lock: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checks: "M2 12.5l4.5 4.5L15 7.5M10 15.5l1.5 1.5L21 7.5",
  clock: "M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  play: "M8 5.5v13l11-6.5-11-6.5z",
  bolt: "M13 3L5 14h6l-1 7 8-11h-6l1-7z",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3-5-1s3 1 5 1zm0 0c1.5-3 5-3 5-1s-3 1-5 1z",
  share: "M12 4v11M7 9l5-5 5 5M5 14v5h14v-5",
  refresh: "M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h13",
  moon: "M20 14.5A8 8 0 119.5 4a6.5 6.5 0 0010.5 10.5z",
  trophy: "M8 4h8v5a4 4 0 01-8 0V4zM8 6H4v1a4 4 0 004 4M16 6h4v1a4 4 0 01-4 4M10 20h4M12 13v7",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  forward: "M14 5l7 7-7 7M21 12H9a6 6 0 00-6 6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  users: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7.5M22 21a7 7 0 00-4-6.3",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  phoneMissed: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2zM16 3l5 5M21 3l-5 5",
  video: "M3 7h12v10H3zM15 10l6-3v10l-6-3",
  wifiOff: "M2 8.5a16 16 0 0120 0M5 12a11 11 0 0114 0M8.5 15.5a6 6 0 017 0M12 19h.01M3 3l18 18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 1.9, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const filled = name === "play" || name === "star";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

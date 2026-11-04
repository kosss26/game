import type { Character } from "@/lib/types/database";

const FALLBACK = ["#8b7cff", "#e17076", "#4fae9b", "#e0a34a", "#5aa0e6", "#c06fd4"];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function characterColor(id: string, c?: Character | null): string {
  return c?.color || FALLBACK[hash(id) % FALLBACK.length];
}

export function Avatar({
  id,
  character,
  size = 40,
  online,
  className = "",
}: {
  id: string;
  character?: Character | null;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const color = characterColor(id, character);
  const initials = character?.initials || (character?.name || id).slice(0, 1).toUpperCase();
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
        style={{
          background: `linear-gradient(145deg, ${color} 0%, ${color}99 100%)`,
          fontSize: size * 0.42,
          boxShadow: `0 6px 18px -8px ${color}`,
        }}
      >
        {initials}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-ink ${online ? "bg-ok" : "bg-faint"}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Icon, type IconName } from "./Icon";

export function Brand({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-2 text-white shadow-glow ${size === "sm" ? "h-7 w-7" : "h-9 w-9"}`}
      >
        <Icon name="moon" size={size === "sm" ? 15 : 19} strokeWidth={2.2} />
      </span>
      <span className={`font-display font-bold tracking-tight text-fg ${size === "sm" ? "text-[17px]" : "text-[22px]"}`}>Полночь</span>
    </span>
  );
}

export function FullscreenLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-ink">
      <div className="animate-float">
        <Brand />
      </div>
      <div className="typing-dots flex gap-1">
        <span />
        <span />
        <span />
      </div>
      {label && <p className="text-[14px] text-faint">{label}</p>}
    </div>
  );
}

export function ErrorState({
  icon = "wifiOff",
  title,
  text,
  action,
  href,
  actionLabel = "Повторить",
}: {
  icon?: IconName;
  title: string;
  text?: string;
  action?: () => void;
  href?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-8 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.05] text-muted ring-1 ring-white/[0.06]">
        <Icon name={icon} size={28} />
      </span>
      <h2 className="text-[19px] font-semibold text-fg">{title}</h2>
      {text && <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-muted">{text}</p>}
      {action && (
        <button className="btn-primary mt-6" onClick={action}>
          {actionLabel}
        </button>
      )}
      {href && (
        <Link className="btn-secondary mt-6" href={href}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

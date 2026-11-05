"use client";

import Link from "next/link";
import { useId } from "react";
import { Icon } from "./Icon";

export function MidnightMark() {
  const id = useId().replace(/:/g, "");
  return (
    <svg width="31" height="37" viewBox="0 0 32 38" fill="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="3" y1="0" x2="29" y2="37" gradientUnits="userSpaceOnUse"><stop stopColor="#eee7ff" /><stop offset=".55" stopColor="#c2a8ff" /><stop offset="1" stopColor="#8061ce" /></linearGradient></defs>
      <path d="M27 4A17 17 0 1 0 27 34A16 16 0 0 1 27 4Z" fill={`url(#${id})`} />
      <path d="M16.5 32V18a6 6 0 0 1 11 0v14L22 35.5V19l5.5-1" stroke="#b8a1f5" strokeWidth="1.15" strokeLinejoin="round" />
    </svg>
  );
}

export function LibraryAvatar({ name, photo, large = false }: { name?: string | null; photo?: string | null; large?: boolean }) {
  return (
    <span className={`library-avatar${large ? " library-avatar-large" : ""}`}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" referrerPolicy="no-referrer" />
      ) : <span>{name?.trim().slice(0, 1).toUpperCase() || <Icon name="user" size={large ? 34 : 19} />}</span>}
    </span>
  );
}

export function LibraryHeader({ profile = false, name, photo, admin = false }: { profile?: boolean; name?: string | null; photo?: string | null; admin?: boolean }) {
  return (
    <header className="library-header">
      <Link href="/" className="library-brand" aria-label="Полночь — главная"><MidnightMark /><span>Полночь</span></Link>
      <div className="library-header-actions">
        {admin && <Link href="/admin" className="library-studio" aria-label="Открыть студию"><Icon name="settings" size={18} /></Link>}
        {profile ? <span className="library-page-label">Профиль</span> : <Link href="/profile" aria-label="Открыть профиль"><LibraryAvatar name={name} photo={photo} /></Link>}
      </div>
    </header>
  );
}

export function LibraryNav({ active }: { active: "stories" | "profile" }) {
  return (
    <nav className="library-nav" aria-label="Основная навигация">
      <Link href="/" className={active === "stories" ? "is-active" : ""} aria-current={active === "stories" ? "page" : undefined}>
        <svg width="26" height="24" viewBox="0 0 28 25" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="M14 5C10 1 5 1 1 2v18c5-1 9 0 13 3 4-3 8-4 13-3V2c-4-1-9-1-13 3Zm0 0v18" /></svg>
        <span>Истории</span>
      </Link>
      <Link href="/profile" className={active === "profile" ? "is-active" : ""} aria-current={active === "profile" ? "page" : undefined}><Icon name="user" size={26} strokeWidth={1.6} /><span>Профиль</span></Link>
    </nav>
  );
}

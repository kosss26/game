"use client";

import Link from "next/link";
import { Icon } from "./Icon";

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

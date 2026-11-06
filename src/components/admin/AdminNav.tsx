"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminLogout } from "@/lib/actions/auth";

const NAV = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/stories", label: "Истории" },
  { href: "/admin/players", label: "Игроки" },
  { href: "/admin/analytics", label: "Аналитика" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 border-b border-tg-border bg-tg-bg-secondary/95 backdrop-blur pt-safe">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-bold text-tg-text">Полночь · Студия</h1>
          <p className="text-xs text-tg-text-hint">Истории и игроки</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-tg-accent">
            К приложению
          </Link>
          <button
            onClick={async () => {
              await adminLogout();
              router.push("/admin/login");
            }}
            className="text-tg-text-hint"
          >
            Выйти
          </button>
        </div>
      </div>
      <nav className="mx-auto flex max-w-3xl border-t border-tg-border">
        {NAV.map(item => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 py-3 text-center text-sm transition-colors ${
                active ? "border-b-2 border-tg-accent bg-tg-accent/5 text-tg-accent" : "text-tg-text-secondary"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

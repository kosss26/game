"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/types/database";

interface AdminNavProps {
  userName: string;
  role: AdminRole | null;
}

export function AdminNav({ userName, role }: AdminNavProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/admin", label: "Главная", icon: "🏠" },
    { href: "/admin/stories", label: "Истории", icon: "📚" },
    { href: "/admin/analytics", label: "Аналитика", icon: "📊" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-tg-bg-secondary border-b border-tg-border">
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-tg-text">Админ-панель</h1>
          <p className="text-xs text-tg-text-hint">
            {userName} • {getRoleName(role)}
          </p>
        </div>
        <Link href="/" className="text-tg-accent text-sm">
          К историям →
        </Link>
      </div>
      
      <nav className="flex border-t border-tg-border">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3 text-center text-sm transition-colors ${
              pathname === item.href
                ? "text-tg-accent border-b-2 border-tg-accent bg-tg-accent/5"
                : "text-tg-text-secondary"
            }`}
          >
            <span className="mr-1">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function getRoleName(role: AdminRole | null): string {
  switch (role) {
    case "admin":
      return "Администратор";
    case "editor":
      return "Редактор";
    case "viewer":
      return "Просмотр";
    default:
      return "Неизвестно";
  }
}

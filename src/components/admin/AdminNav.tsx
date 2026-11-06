"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { adminLogout } from "@/lib/actions/auth";
import { Icon, type IconName } from "@/components/ui/Icon";
import { confirmStudioLeave } from "./useUnsavedChanges";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Обзор", icon: "moon" },
  { href: "/admin/stories", label: "Истории", icon: "book" },
  { href: "/admin/players", label: "Игроки", icon: "users" },
  { href: "/admin/analytics", label: "Аналитика", icon: "bolt" },
];
export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const logout = async () => {
    if (!confirmStudioLeave()) return;
    setBusy(true);
    setError(false);
    try {
      await adminLogout();
      router.push("/admin/login");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a href="#studio-content" className="studio-skip">
        К содержимому
      </a>
      <header className="studio-sidebar">
        <div className="studio-brand-row">
          <Link href="/admin" className="studio-brand">
            <span className="studio-brand-mark">
              <Icon name="moon" size={23} />
            </span>
            <span>
              <strong>Полночь</strong>
              <small>СТУДИЯ ИСТОРИЙ</small>
            </span>
          </Link>
          <div className="studio-mobile-actions">
            <Link
              href="/"
              className="studio-mobile-app"
              aria-label="Открыть приложение"
            >
              <Icon name="forward" size={20} />
            </Link>
            <button
              className="studio-mobile-app"
              disabled={busy}
              onClick={logout}
              aria-label="Выйти из студии"
            >
              <Icon name="lock" size={18} />
            </button>
          </div>
        </div>
        <p className="studio-nav-caption">Рабочее пространство</p>
        <nav className="studio-navigation" aria-label="Разделы студии">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href) ||
                  (item.href === "/admin/stories" &&
                    pathname.startsWith("/admin/days/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active ? "is-active" : ""}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
                {active && <i />}
              </Link>
            );
          })}
        </nav>
        <div className="studio-sidebar-bottom">
          <p>
            Слова становятся
            <br />
            историями.
          </p>
          <Link href="/" className="studio-app-link">
            <Icon name="play" size={15} />
            Открыть приложение
            <Icon name="forward" size={15} />
          </Link>
          <button className="studio-logout" disabled={busy} onClick={logout}>
            {busy ? "Выходим…" : "Выйти из студии"}
          </button>
          {error && (
            <span role="alert" className="studio-error-text">
              Не удалось выйти. Повторите.
            </span>
          )}
        </div>
      </header>
    </>
  );
}

"use client";
import { useEffect } from "react";

const editors = new Set<symbol>();
export function confirmStudioLeave() {
  return (
    !editors.size ||
    window.confirm(
      "Есть несохранённые изменения. Покинуть редактор и потерять их?",
    )
  );
}
function beforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}
function beforeNavigation(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey
  )
    return;
  const anchor =
    event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>("a[href]")
      : null;
  if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download"))
    return;
  const url = new URL(anchor.href, location.href);
  if (
    url.pathname === location.pathname &&
    url.search === location.search &&
    url.origin === location.origin
  )
    return;
  if (!confirmStudioLeave()) {
    event.preventDefault();
    event.stopPropagation();
  }
}

/** One navigation warning even when several editor panels contain unsaved work. */
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const id = Symbol();
    if (!editors.size) {
      window.addEventListener("beforeunload", beforeUnload);
      document.addEventListener("click", beforeNavigation, true);
      try {
        window.Telegram?.WebApp.enableClosingConfirmation?.();
      } catch {
        /* old Telegram */
      }
    }
    editors.add(id);
    return () => {
      editors.delete(id);
      if (!editors.size) {
        window.removeEventListener("beforeunload", beforeUnload);
        document.removeEventListener("click", beforeNavigation, true);
        try {
          window.Telegram?.WebApp.disableClosingConfirmation?.();
        } catch {
          /* old Telegram */
        }
      }
    };
  }, [dirty]);
}

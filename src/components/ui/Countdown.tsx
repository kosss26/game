"use client";

import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatDuration(ms: number, compact = false): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return compact ? `${d} д ${h} ч` : `${d} д ${h} ч ${m} мин`;
  if (h > 0) return compact ? `${h} ч ${m} мин` : `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Обратный отсчёт до даты; onDone вызывается один раз */
export function Countdown({ until, onDone, compact }: { until: string | number; onDone?: () => void; compact?: boolean }) {
  const target = typeof until === "number" ? until : new Date(until).getTime();
  const now = useNow(1000);
  const left = target - now;
  useEffect(() => {
    if (left <= 0 && onDone) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0]);
  return <span className="tabular-nums">{formatDuration(left, compact)}</span>;
}

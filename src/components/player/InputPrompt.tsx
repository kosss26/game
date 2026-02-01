"use client";

import { useState, useRef, useEffect } from "react";
import type { SnapshotScene } from "@/lib/types/database";

interface InputPromptProps {
  scene: SnapshotScene;
  onSubmit: (value: string) => void;
}

export function InputPrompt({ scene, onSubmit }: InputPromptProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const placeholder = scene.meta?.input_placeholder || "Введите ответ...";

  return (
    <form onSubmit={handleSubmit} className="mt-4 animate-slide-up">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-tg-bg-secondary border border-tg-border rounded-xl px-4 py-3 text-tg-text placeholder-tg-text-hint focus:outline-none focus:border-tg-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="px-4 py-3 bg-tg-accent text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-opacity active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
}

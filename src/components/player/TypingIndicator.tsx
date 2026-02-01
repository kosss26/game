"use client";

export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bubble-npc px-4 py-3">
        <div className="typing-indicator flex items-center gap-1">
          <span className="w-2 h-2 bg-tg-text-secondary rounded-full" />
          <span className="w-2 h-2 bg-tg-text-secondary rounded-full" />
          <span className="w-2 h-2 bg-tg-text-secondary rounded-full" />
        </div>
      </div>
    </div>
  );
}

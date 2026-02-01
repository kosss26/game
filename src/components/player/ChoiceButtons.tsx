"use client";

import type { SnapshotChoice } from "@/lib/types/database";

interface ChoiceButtonsProps {
  choices: SnapshotChoice[];
  onSelect: (choice: SnapshotChoice) => void;
}

export function ChoiceButtons({ choices, onSelect }: ChoiceButtonsProps) {
  return (
    <div className="mt-4 space-y-2 animate-slide-up">
      {choices.map((choice, index) => (
        <button
          key={choice.id}
          onClick={() => onSelect(choice)}
          className="w-full choice-button text-left px-4 py-3 rounded-xl text-tg-text text-[15px] active:scale-[0.98] transition-all"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

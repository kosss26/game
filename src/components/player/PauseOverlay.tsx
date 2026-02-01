"use client";

import { useState, useEffect } from "react";

interface PauseOverlayProps {
  duration: number;
  onComplete: () => void;
}

export function PauseOverlay({ duration, onComplete }: PauseOverlayProps) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1000) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  const seconds = Math.ceil(remaining / 1000);
  const progress = 1 - remaining / duration;

  return (
    <div className="fixed inset-0 pause-overlay z-50 flex flex-col items-center justify-center animate-fade-in">
      <div className="relative w-32 h-32 mb-6">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="56"
            stroke="#5288c1"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${progress * 352} 352`}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold text-white">{seconds}</span>
        </div>
      </div>
      
      <p className="text-lg text-white/80 text-center px-8">
        Немного терпения...
      </p>
      <p className="text-sm text-white/50 mt-2">
        История продолжится через несколько секунд
      </p>
    </div>
  );
}

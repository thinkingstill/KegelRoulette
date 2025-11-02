"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type PlayerSlice = { label: string };

export default function RouletteWheel({
  players,
  winnerIndex,
  onSpinEnd,
  sizeClass = "w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80",
}: {
  players: PlayerSlice[];
  winnerIndex?: number;
  onSpinEnd?: () => void;
  sizeClass?: string;
}) {
  const segments = players.length || 1;
  const anglePer = 360 / segments;
  const [rotation, setRotation] = useState(0);
  const animatingRef = useRef(false);

  const colors = useMemo(
    () => ["#FDE68A", "#C4B5FD", "#93C5FD", "#FCA5A5", "#86EFAC", "#A5B4FC", "#FBCFE8", "#FDBA74"],
    []
  );

  useEffect(() => {
    if (winnerIndex == null || segments === 0) return;
    // compute target angle so that pointer (top) lands on winnerIndex
    // pointer at 0deg; target center angle is winnerIndex * anglePer + anglePer/2
    const targetCenter = winnerIndex * anglePer + anglePer / 2;
    // We rotate negative so the segment moves under the pointer
    const target = 360 * 5 + (360 - targetCenter); // 5 loops + align
    animatingRef.current = true;
    setRotation(target);
    const timer = setTimeout(() => {
      animatingRef.current = false;
      onSpinEnd?.();
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winnerIndex, segments]);

  const pointedName = typeof winnerIndex === "number" ? players[winnerIndex]?.label : players[0]?.label;

  return (
    <div className={`relative ${sizeClass} mx-auto`}
    >
      {/* Pointer */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-20 w-0 h-0 border-l-8 border-r-8 border-b-[16px] border-l-transparent border-r-transparent border-b-red-500" />
      {pointedName && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 z-30 px-3 py-1 rounded-full bg-black text-white text-xs shadow">
          {pointedName}
        </div>
      )}
      {/* Wheel */}
      <div
        className="relative w-full h-full rounded-full overflow-hidden shadow-xl transition-transform"
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: "3s", transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0, 1)" }}
      >
        {Array.from({ length: segments }).map((_, i) => {
          const rotate = i * anglePer;
          const bg = colors[i % colors.length];
          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 origin-top-left"
              style={{ transform: `rotate(${rotate}deg)`, width: "50%", height: "50%" }}
            >
              <div
                className="absolute left-0 top-0"
                style={{
                  width: "200%",
                  height: "200%",
                  clipPath: `polygon(0% 0%, 100% 0%, 0% 100%)`,
                  background: bg,
                }}
              />
              <div
                className="absolute left-1/2 -translate-x-1/2 top-3 text-[11px] sm:text-xs font-semibold text-gray-800 whitespace-nowrap"
                style={{ transform: `rotate(${-rotate}deg)` }}
              >
                {players[i]?.label ?? `玩家${i + 1}`}
              </div>
            </div>
          );
        })}
      </div>
      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white shadow z-10 flex items-center justify-center">
        🎯
      </div>
    </div>
  );
}
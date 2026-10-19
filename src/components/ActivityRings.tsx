import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Timer, Accessibility } from 'lucide-react';
import { ActivityRingItem, DataMode } from '../types/health';

interface ActivityRingsProps {
  rings: ActivityRingItem[];
  dataMode: DataMode;
  reducedMotion: boolean;
}

export const ActivityRings: React.FC<ActivityRingsProps> = ({
  rings,
  dataMode,
  reducedMotion,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const radii = [86, 64, 42];
  const strokeWidth = 14;
  const center = 110;

  return (
    <div className="rounded-2xl nexus-glass p-5 sm:p-6 flex flex-col justify-between space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-lg">Activity Rings</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tiến trình vận động hàng ngày (Move • Exercise • Stand)
          </p>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/35">
          {dataMode === 'demo' ? 'DEMO IMU DATA' : 'IMU ESTIMATION'}
        </span>
      </div>

      {/* Concentric SVG Activity Rings */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
        <div className="relative w-56 h-56 shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90 overflow-visible">
            <defs>
              {rings.map((ring) => (
                <linearGradient
                  key={`grad-${ring.id}`}
                  id={`ring-grad-${ring.id}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={ring.colorStart} />
                  <stop offset="100%" stopColor={ring.colorEnd} />
                </linearGradient>
              ))}
            </defs>

            {rings.map((ring, idx) => {
              const r = radii[idx];
              const circumference = 2 * Math.PI * r;
              const offset = circumference - (ring.percentage / 100) * circumference;
              const isHovered = hoveredId === ring.id;

              return (
                <g
                  key={ring.id}
                  onMouseEnter={() => setHoveredId(ring.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="cursor-pointer"
                >
                  {/* Background Track */}
                  <circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.12)"
                    strokeWidth={strokeWidth}
                  />
                  {/* Animated Progress Arc */}
                  <motion.circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke={`url(#ring-grad-${ring.id})`}
                    strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={
                      reducedMotion
                        ? { strokeDashoffset: offset }
                        : { strokeDashoffset: circumference }
                    }
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, delay: idx * 0.15, ease: 'easeOut' }}
                    style={{
                      filter: isHovered
                        ? `drop-shadow(0 0 10px ${ring.colorStart})`
                        : `drop-shadow(0 0 4px ${ring.colorStart}66)`,
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Center Summary Readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            {hoveredId ? (
              (() => {
                const active = rings.find((r) => r.id === hoveredId)!;
                return (
                  <>
                    <span
                      className="text-[10px] font-mono-tech font-bold uppercase tracking-wider"
                      style={{ color: active.colorStart }}
                    >
                      {active.label}
                    </span>
                    <span className="font-display font-bold text-xl text-white">
                      {active.percentage}%
                    </span>
                    <span className="text-[10px] font-mono-tech text-slate-400">
                      {active.current}/{active.goal} {active.unit}
                    </span>
                  </>
                );
              })()
            ) : (
              <>
                <span className="text-[10px] font-mono-tech text-slate-400 uppercase">
                  TỔNG TIẾN ĐỘ
                </span>
                <span className="font-display font-bold text-2xl text-cyan-300">
                  {Math.round(
                    rings.reduce((acc, r) => acc + r.percentage, 0) / rings.length
                  )}
                  %
                </span>
              </>
            )}
          </div>
        </div>

        {/* Ring Legend & Interactive Details */}
        <div className="flex-1 w-full space-y-3">
          {rings.map((ring) => {
            const isHovered = hoveredId === ring.id;
            const Icon =
              ring.id === 'move'
                ? Flame
                : ring.id === 'exercise'
                ? Timer
                : Accessibility;

            return (
              <div
                key={ring.id}
                onMouseEnter={() => setHoveredId(ring.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  borderColor: isHovered ? ring.colorStart : 'rgba(148, 163, 184, 0.14)',
                }}
                className="p-3 rounded-xl bg-slate-900/60 border transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        backgroundColor: `${ring.colorStart}22`,
                        color: ring.colorStart,
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-mono-tech font-bold text-slate-200">
                        {ring.label} — {ring.vietnameseLabel}
                      </div>
                      <div className="text-[11px] text-slate-400">{ring.description}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <div
                      className="font-mono-tech font-bold text-sm"
                      style={{ color: ring.colorStart }}
                    >
                      {ring.current} / {ring.goal} {ring.unit}
                    </div>
                    <div className="text-[11px] font-mono-tech text-slate-400">
                      Hoàn thành {ring.percentage}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

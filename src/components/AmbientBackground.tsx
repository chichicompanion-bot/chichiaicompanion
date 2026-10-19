import React, { useEffect, useState } from 'react';

interface AmbientBackgroundProps {
  reducedMotion: boolean;
  isLightMode: boolean;
}

const PARTICLES = [
  { id: 1, left: '12%', top: '18%', size: 3, delay: '0s', duration: '14s' },
  { id: 2, left: '28%', top: '65%', size: 2, delay: '2s', duration: '18s' },
  { id: 3, left: '46%', top: '24%', size: 3, delay: '1s', duration: '16s' },
  { id: 4, left: '68%', top: '72%', size: 2, delay: '3s', duration: '20s' },
  { id: 5, left: '82%', top: '30%', size: 3, delay: '0.5s', duration: '15s' },
  { id: 6, left: '91%', top: '60%', size: 2, delay: '4s', duration: '17s' },
  { id: 7, left: '18%', top: '84%', size: 2, delay: '1.5s', duration: '19s' },
  { id: 8, left: '58%', top: '48%', size: 3, delay: '2.5s', duration: '16s' },
];

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  reducedMotion,
  isLightMode,
}) => {
  const [cursorOffset, setCursorOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;

    let rafId: number | null = null;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const normX = (e.clientX / window.innerWidth - 0.5) * 36;
        const normY = (e.clientY / window.innerHeight - 0.5) * 36;
        setCursorOffset({ x: normX, y: normY });
        rafId = null;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
    >
      {/* Subtle Tech Grid */}
      <div className="absolute inset-0 nexus-tech-grid opacity-75" />

      {/* Diffused Ambient Cyan & Teal Light Orbs reacting smoothly via GPU translate3d */}
      <div
        style={{
          transform: `translate3d(${cursorOffset.x}px, ${cursorOffset.y}px, 0)`,
          transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="absolute inset-0"
      >
        <div
          className={`absolute -top-36 -left-24 w-[34rem] h-[34rem] rounded-full blur-3xl ${
            isLightMode ? 'bg-sky-400/15' : 'bg-cyan-500/10'
          }`}
        />
        <div
          className={`absolute top-1/3 -right-28 w-[30rem] h-[30rem] rounded-full blur-3xl ${
            isLightMode ? 'bg-emerald-400/15' : 'bg-teal-500/8'
          }`}
        />
        <div
          className={`absolute -bottom-40 left-1/3 w-[36rem] h-[24rem] rounded-full blur-3xl ${
            isLightMode ? 'bg-indigo-400/10' : 'bg-sky-600/8'
          }`}
        />
      </div>

      {/* Subtle Signal Connection Lines SVG */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="nexusSignalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#00F0FF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path
          d="M 0 180 Q 420 120 840 210 T 1680 160"
          fill="none"
          stroke="url(#nexusSignalGrad)"
          strokeWidth="1"
        />
        <path
          d="M 0 640 Q 520 710 1040 610 T 1920 670"
          fill="none"
          stroke="url(#nexusSignalGrad)"
          strokeWidth="1"
        />
      </svg>

      {/* Lightweight Micro-Particles */}
      {!reducedMotion &&
        PARTICLES.map((p) => (
          <span
            key={p.id}
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
            className={`absolute rounded-full animate-pulse ${
              isLightMode ? 'bg-sky-500/35' : 'bg-cyan-400/40 shadow-[0_0_8px_#00F0FF]'
            }`}
          />
        ))}
    </div>
  );
};

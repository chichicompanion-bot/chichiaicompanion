import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Cpu, ShieldCheck, FastForward } from 'lucide-react';

interface CinematicIntroProps {
  visible: boolean;
  onComplete: () => void;
  reducedMotion: boolean;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({
  visible,
  onComplete,
  reducedMotion,
}) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      const fastTimer = setTimeout(onComplete, 350);
      return () => clearTimeout(fastTimer);
    }

    setStep(1);
    const t1 = setTimeout(() => setStep(2), 550);
    const t2 = setTimeout(() => setStep(3), 1250);
    const t3 = setTimeout(() => onComplete(), 2550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [visible, onComplete, reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nexus-cinematic-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(10px)', transition: { duration: 0.45, ease: 'easeInOut' } }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#040710] text-[#F0F6FC] overflow-hidden select-none"
        >
          {/* 1. Slow moving cyan light sweep */}
          <motion.div
            initial={{ x: '-60%', opacity: 0 }}
            animate={{ x: '60%', opacity: [0, 0.55, 0.25] }}
            transition={{ duration: 2.4, ease: 'easeInOut' }}
            className="absolute w-[42rem] h-[42rem] rounded-full bg-cyan-500/15 blur-3xl pointer-events-none"
          />

          {/* 2. Tech grid & signal lines forming */}
          <div className="absolute inset-0 nexus-tech-grid opacity-60" />

          {/* 3. NEXUS HEALTH wordmark fade-in + blur-to-sharp */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-2xl">
            <motion.div
              initial={{ scale: 0.85, opacity: 0, filter: 'blur(12px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 mb-4 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/30 text-cyan-300 text-xs font-mono-tech uppercase tracking-[0.25em]"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>ESP32-S3 • MAX30102 BIOMEDICAL TELEMETRY OS</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 14, filter: 'blur(14px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.85, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-4xl sm:text-6xl font-bold tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-teal-300 drop-shadow-[0_0_28px_rgba(0,240,255,0.35)]"
            >
              NEXUS HEALTH
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: step >= 2 ? 0.85 : 0 }}
              transition={{ duration: 0.45 }}
              className="mt-3 text-sm sm:text-base text-slate-400 font-light tracking-wide"
            >
              Hệ thống Giám sát Sinh học Thông minh & Phân tích Tín hiệu Quang học Thời gian thực
            </motion.p>

            {/* 4. Glowing Optical PPG / Radar Sweep running horizontally across screen */}
            <div className="relative w-72 sm:w-96 h-16 mt-8 flex items-center justify-center overflow-hidden">
              <svg
                viewBox="0 0 400 80"
                className="w-full h-full overflow-visible"
              >
                <defs>
                  <linearGradient id="introWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.05" />
                    <stop offset="50%" stopColor="#00F0FF" stopOpacity="1" />
                    <stop offset="85%" stopColor="#FF2E54" stopOpacity="1" />
                    <stop offset="100%" stopColor="#00E5A3" stopOpacity="0.9" />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M 0 45 L 75 45 L 92 38 L 105 45 L 122 45 L 135 55 L 148 12 L 162 66 L 176 34 L 190 45 L 265 45 L 280 16 L 294 64 L 310 35 L 325 45 L 400 45"
                  fill="none"
                  stroke="url(#introWaveGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0.2 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 1.55, delay: 0.35, ease: 'easeInOut' }}
                  style={{ filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.7))' }}
                />
              </svg>
            </div>

            {/* Boot Sequence Telemetry Status */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs font-mono-tech text-slate-400">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                KHỞI TẠO CẢM BIẾN QUANG HỌC...
              </span>
              {step >= 2 && (
                <span className="flex items-center gap-1.5 text-emerald-300">
                  <Activity className="w-3.5 h-3.5" />
                  ĐỒNG BỘ CHUỖI TELEMETRY
                </span>
              )}
              {step >= 3 && (
                <span className="flex items-center gap-1.5 text-sky-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  SẴN SÀNG TRUY CẬP
                </span>
              )}
            </div>
          </div>

          {/* Skip Intro Button */}
          <button
            type="button"
            onClick={onComplete}
            className="absolute bottom-8 right-8 z-20 flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700/80 bg-slate-900/70 hover:bg-slate-800/90 hover:border-cyan-400/50 text-xs font-mono-tech text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
          >
            <span>BỎ QUA INTRO</span>
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

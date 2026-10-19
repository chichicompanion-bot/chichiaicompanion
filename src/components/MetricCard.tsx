import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Droplets,
  Activity,
  Thermometer,
  Footprints,
  Moon,
  BrainCircuit,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { MetricCardData, MetricKey } from '../types/health';

interface MetricCardProps {
  metric: MetricCardData;
  index: number;
  reducedMotion: boolean;
  isSelected?: boolean;
  onSelect?: (key: MetricKey) => void;
}

const METRIC_ICONS: Record<MetricKey, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  heartRate: Heart,
  spo2: Droplets,
  hrv: Activity,
  skinTemp: Thermometer,
  steps: Footprints,
  sleep: Moon,
  stress: BrainCircuit,
};

export const MetricCard: React.FC<MetricCardProps> = ({
  metric,
  index,
  reducedMotion,
  isSelected = false,
  onSelect,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState({
    hovered: false,
    mouseX: 140,
    mouseY: 80,
    rotateX: 0,
    rotateY: 0,
  });

  // Animated count-up for initial mount
  const [displayNumber, setDisplayNumber] = useState<number | null>(metric.value);
  const hasCountedRef = useRef(false);

  useEffect(() => {
    if (metric.value === null) {
      setDisplayNumber(null);
      return;
    }

    if (reducedMotion || hasCountedRef.current) {
      setDisplayNumber(metric.value);
      return;
    }

    hasCountedRef.current = true;
    const target = metric.value;
    const start = target * 0.65;
    const duration = 850;
    const startTime = performance.now();

    let raf: number;
    const animateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      setDisplayNumber(
        Number.isInteger(target) ? Math.round(current) : Math.round(current * 10) / 10
      );
      if (progress < 1) {
        raf = requestAnimationFrame(animateCount);
      }
    };

    raf = requestAnimationFrame(animateCount);
    return () => cancelAnimationFrame(raf);
  }, [metric.value, reducedMotion]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normX = x / rect.width - 0.5;
    const normY = y / rect.height - 0.5;

    setHoverState({
      hovered: true,
      mouseX: x,
      mouseY: y,
      rotateX: -normY * 5,
      rotateY: normX * 5,
    });
  };

  const handleMouseLeave = () => {
    setHoverState((prev) => ({
      ...prev,
      hovered: false,
      rotateX: 0,
      rotateY: 0,
    }));
  };

  const Icon = METRIC_ICONS[metric.key];

  // Build SVG mini-sparkline path
  const sparkPoints = metric.sparkline;
  let sparkPath = '';
  if (sparkPoints.length > 1) {
    const vals = sparkPoints.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    const width = 120;
    const height = 34;

    sparkPath = sparkPoints
      .map((pt, i) => {
        const px = (i / (sparkPoints.length - 1)) * width;
        const py = height - ((pt.value - min) / span) * (height - 8) - 4;
        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join(' ');
  }

  const formattedMainValue =
    metric.key === 'sleep'
      ? metric.formattedValue
      : displayNumber !== null
      ? metric.key === 'steps'
        ? Math.round(displayNumber).toLocaleString('vi-VN')
        : `${displayNumber}`
      : '--';

  return (
    <motion.div
      ref={cardRef}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHoverState((s) => ({ ...s, hovered: true }))}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect && onSelect(metric.key)}
      style={{
        transform: hoverState.hovered
          ? `perspective(900px) translateY(-5px) rotateX(${hoverState.rotateX.toFixed(2)}deg) rotateY(${hoverState.rotateY.toFixed(2)}deg)`
          : 'perspective(900px) translateY(0px) rotateX(0deg) rotateY(0deg)',
        borderColor:
          hoverState.hovered || isSelected ? metric.accentColor : 'var(--border-subtle)',
        boxShadow:
          hoverState.hovered || isSelected
            ? `0 16px 38px -10px ${metric.glowColor}, 0 0 18px -4px ${metric.glowColor}`
            : undefined,
        transition:
          'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.25s ease, box-shadow 0.25s ease',
      }}
      className="relative rounded-2xl nexus-glass p-5 overflow-hidden cursor-pointer select-none flex flex-col justify-between"
    >
      {/* Cursor-following soft spotlight on card surface */}
      <div
        aria-hidden="true"
        style={{
          opacity: hoverState.hovered ? 1 : 0,
          background: `radial-gradient(260px circle at ${hoverState.mouseX}px ${hoverState.mouseY}px, ${metric.glowColor}, transparent 75%)`,
          transition: 'opacity 0.3s ease',
        }}
        className="pointer-events-none absolute inset-0 z-0"
      />

      <div className="relative z-10">
        {/* Card Header: Icon + Titles + Freshness Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              style={{
                borderColor: `${metric.accentColor}55`,
                backgroundColor: `${metric.accentColor}18`,
              }}
              className="w-10 h-10 rounded-xl border flex items-center justify-center transition-transform duration-300"
            >
              <Icon
                style={{ color: metric.accentColor }}
                className={`w-5 h-5 transition-transform duration-300 ${
                  hoverState.hovered ? 'scale-110' : ''
                } ${metric.key === 'heartRate' && !reducedMotion ? 'animate-pulse' : ''}`}
              />
            </div>
            <div>
              <div className="text-[11px] font-mono-tech font-bold tracking-[0.14em] text-slate-400">
                {metric.title}
              </div>
              <div className="text-xs text-slate-300 font-medium">{metric.vietnameseTitle}</div>
            </div>
          </div>

          {/* Data Freshness Badge: LIVE, DEMO, or STALE */}
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono-tech font-semibold border ${
              metric.freshness === 'LIVE'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                : metric.freshness === 'DEMO'
                ? 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {metric.freshness}
          </span>
        </div>

        {/* Main Value + Mini Sparkline */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-display font-bold text-3xl sm:text-4xl tracking-tight transition-all duration-200 ${
                  hoverState.hovered ? 'brightness-125 drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]' : ''
                }`}
              >
                {formattedMainValue}
              </span>
              <span className="text-xs font-mono-tech text-slate-400 uppercase">
                {metric.unit}
              </span>
            </div>

            {/* Delta comparison */}
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              {metric.deltaPercent !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-mono-tech font-medium ${
                    metric.deltaPercent >= 0 ? 'text-emerald-400' : 'text-sky-400'
                  }`}
                >
                  {metric.deltaPercent >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                </span>
              )}
              <span className="truncate">{metric.deltaLabel}</span>
            </div>
          </div>

          {/* Mini SVG Sparkline */}
          {sparkPath && (
            <div className="w-28 h-9 shrink-0">
              <svg viewBox="0 0 120 34" className="w-full h-full overflow-visible">
                <path
                  d={sparkPath}
                  fill="none"
                  stroke={metric.accentColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    filter: hoverState.hovered
                      ? `drop-shadow(0 0 6px ${metric.accentColor})`
                      : 'none',
                  }}
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Sensor Hardware & Timestamp */}
      <div className="relative z-10 mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
        <span className="truncate max-w-[65%]" title={metric.sensorSource}>
          {metric.sensorSource}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-slate-400">
          <Clock className="w-3 h-3 text-cyan-400" />
          {metric.measuredAt}
        </span>
      </div>
    </motion.div>
  );
};

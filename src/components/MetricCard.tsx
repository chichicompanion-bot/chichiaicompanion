import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const METRIC_ICONS: Record<
  MetricKey,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  heartRate: Heart,
  spo2: Droplets,
  hrv: Activity,
  skinTemp: Thermometer,
  steps: Footprints,
  sleep: Moon,
  stress: BrainCircuit,
};

export const MetricCard: React.FC<MetricCardProps> = React.memo(
  ({ metric, reducedMotion, isSelected = false, onSelect }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    // Animated count-up only on initial mount
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
      const start = target * 0.75;
      const duration = 600;
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

    // Zero-re-render hover handler: directly mutates CSS variables via rAF
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (reducedMotion || !cardRef.current || rafRef.current !== null) return;
      const clientX = e.clientX;
      const clientY = e.clientY;

      rafRef.current = requestAnimationFrame(() => {
        const el = cardRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const x = clientX - rect.left;
          const y = clientY - rect.top;
          const normX = x / rect.width - 0.5;
          const normY = y / rect.height - 0.5;

          el.style.setProperty('--mouse-x', `${x.toFixed(0)}px`);
          el.style.setProperty('--mouse-y', `${y.toFixed(0)}px`);
          el.style.setProperty('--rot-x', `${(-normY * 3.5).toFixed(2)}deg`);
          el.style.setProperty('--rot-y', `${(normX * 3.5).toFixed(2)}deg`);
        }
        rafRef.current = null;
      });
    };

    const handleMouseLeave = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const el = cardRef.current;
      if (el) {
        el.style.setProperty('--rot-x', '0deg');
        el.style.setProperty('--rot-y', '0deg');
      }
    };

    const Icon = METRIC_ICONS[metric.key];

    const sparkPath = useMemo(() => {
      const sparkPoints = metric.sparkline;
      if (sparkPoints.length <= 1) return '';
      const vals = sparkPoints.map((p) => p.value);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const span = max - min || 1;
      const width = 120;
      const height = 34;

      return sparkPoints
        .map((pt, i) => {
          const px = (i / (sparkPoints.length - 1)) * width;
          const py = height - ((pt.value - min) / span) * (height - 8) - 4;
          return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`;
        })
        .join(' ');
    }, [metric.sparkline]);

    const formattedMainValue =
      metric.key === 'sleep'
        ? metric.formattedValue
        : displayNumber !== null
        ? metric.key === 'steps'
          ? Math.round(displayNumber).toLocaleString('vi-VN')
          : `${displayNumber}`
        : '--';

    return (
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={() => onSelect && onSelect(metric.key)}
        style={
          {
            '--card-accent': metric.accentColor,
            '--card-glow': metric.glowColor,
            borderColor: isSelected ? metric.accentColor : undefined,
          } as React.CSSProperties
        }
        className="nexus-metric-card relative rounded-2xl nexus-glass p-3.5 sm:p-5 overflow-hidden cursor-pointer select-none flex flex-col justify-between group"
      >
        {/* Pure CSS cursor spotlight */}
        <div
          aria-hidden="true"
          className="nexus-card-spotlight pointer-events-none absolute inset-0 z-0"
        />

        <div className="relative z-10">
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div
                style={{
                  borderColor: `${metric.accentColor}55`,
                  backgroundColor: `${metric.accentColor}18`,
                }}
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
              >
                <Icon style={{ color: metric.accentColor }} className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-mono-tech font-bold tracking-[0.14em] text-slate-400">
                  {metric.title}
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {metric.vietnameseTitle}
                </div>
              </div>
            </div>

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
                <span className="font-display font-bold text-3xl sm:text-4xl tracking-tight group-hover:brightness-110 transition-all">
                  {formattedMainValue}
                </span>
                <span className="text-xs font-mono-tech text-slate-400 uppercase">
                  {metric.unit}
                </span>
              </div>

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
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 mt-4 pt-3 border-t border-slate-800/70 flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
          <span className="truncate max-w-[60%] group-hover:hidden" title={metric.sensorSource}>
            {metric.sensorSource}
          </span>
          <span
            style={{ color: metric.accentColor }}
            className="hidden group-hover:inline-flex items-center gap-1 font-semibold truncate max-w-[65%]"
          >
            Bấm để mở sơ đồ chi tiết ↗
          </span>
          <span className="flex items-center gap-1 shrink-0 text-slate-400">
            <Clock className="w-3 h-3 text-cyan-400" />
            {metric.measuredAt}
          </span>
        </div>
      </div>
    );
  }
);

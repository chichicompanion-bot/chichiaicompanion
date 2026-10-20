import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Heart, Droplets, Activity, Thermometer } from 'lucide-react';
import {
  DataMode,
  MetricCardData,
  MetricKey,
  TelemetryTimeSeriesPoint,
} from '../types/health';

interface FloatingHeartChartsHUDProps {
  visible: boolean;
  onClose: () => void;
  metrics: MetricCardData[];
  series: TelemetryTimeSeriesPoint[];
  dataMode: DataMode;
  isLiveConnected: boolean;
  reducedMotion: boolean;
}

interface ChartConfig {
  key: MetricKey;
  label: string;
  unit: string;
  strokeColor: string;
  glowColor: string;
  borderColor: string;
  positionClass: string;
  staggerIndex: number; // Diagonal order: Top-Left (0) -> Bottom-Right (1) -> Top-Right (2) -> Bottom-Left (3)
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  extractValue: (pt: TelemetryTimeSeriesPoint) => number | null;
}

const FLOATING_CHART_CONFIGS: ChartConfig[] = [
  {
    key: 'heartRate',
    label: 'Heart Rate',
    unit: 'BPM',
    strokeColor: '#ff4d6d',
    glowColor: 'rgba(255, 77, 109, 0.35)',
    borderColor: 'rgba(0, 240, 255, 0.32)',
    positionClass: 'lg:top-5 lg:left-5',
    staggerIndex: 0,
    icon: Heart,
    extractValue: (pt) => pt.heartRate,
  },
  {
    key: 'spo2',
    label: 'Blood Oxygen • SpO₂',
    unit: '%',
    strokeColor: '#00f0ff',
    glowColor: 'rgba(0, 240, 255, 0.35)',
    borderColor: 'rgba(0, 240, 255, 0.35)',
    positionClass: 'lg:top-5 lg:right-5',
    staggerIndex: 2,
    icon: Droplets,
    extractValue: (pt) => pt.spo2,
  },
  {
    key: 'hrv',
    label: 'Heart Rate Variability',
    unit: 'ms',
    strokeColor: '#00e5a3',
    glowColor: 'rgba(0, 229, 163, 0.35)',
    borderColor: 'rgba(0, 229, 163, 0.35)',
    positionClass: 'lg:bottom-12 lg:left-5',
    staggerIndex: 3,
    icon: Activity,
    extractValue: (pt) => pt.hrv,
  },
  {
    key: 'skinTemp',
    label: 'Skin Temperature',
    unit: '°C',
    strokeColor: '#f59e0b',
    glowColor: 'rgba(245, 158, 11, 0.35)',
    borderColor: 'rgba(0, 240, 255, 0.32)',
    positionClass: 'lg:bottom-12 lg:right-5',
    staggerIndex: 1,
    icon: Thermometer,
    extractValue: (pt) => pt.skinTemp,
  },
];

interface SingleGlassChartPanelProps {
  config: ChartConfig;
  metric?: MetricCardData;
  series: TelemetryTimeSeriesPoint[];
  dataMode: DataMode;
  isLiveConnected: boolean;
  reducedMotion: boolean;
}

const SingleGlassChartPanel: React.FC<SingleGlassChartPanelProps> = ({
  config,
  metric,
  series,
  dataMode,
  isLiveConnected,
  reducedMotion,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const Icon = config.icon;

  // Use last 18 points for a crisp, fast mini line chart
  const validPoints = React.useMemo(() => {
    if (dataMode === 'live' && !isLiveConnected) {
      return [];
    }
    const slice = series.slice(-18);
    return slice
      .map((pt) => ({
        time: pt.timeLabel,
        value: config.extractValue(pt),
      }))
      .filter((d): d is { time: string; value: number } => d.value !== null && !Number.isNaN(d.value));
  }, [series, dataMode, isLiveConnected, config]);

  const width = 228;
  const height = 54;
  const padX = 6;
  const padY = 7;

  const geometry = React.useMemo(() => {
    if (validPoints.length < 2) return null;
    const vals = validPoints.map((p) => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;

    const coords = validPoints.map((pt, i) => {
      const x = padX + (i / (validPoints.length - 1)) * (width - padX * 2);
      const y = height - padY - ((pt.value - min) / span) * (height - padY * 2);
      return { x, y, time: pt.time, value: pt.value };
    });

    // Smooth cubic bezier SVG path
    let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const midX = ((curr.x + next.x) / 2).toFixed(1);
      linePath += ` C ${midX} ${curr.y.toFixed(1)}, ${midX} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }

    const last = coords[coords.length - 1];
    const first = coords[0];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

    return { coords, linePath, areaPath, last };
  }, [validPoints]);

  const activePoint =
    hoverIdx !== null && geometry?.coords[hoverIdx]
      ? geometry.coords[hoverIdx]
      : null;

  const displayValue =
    dataMode === 'live' && !isLiveConnected
      ? '--'
      : metric?.formattedValue ?? (geometry?.last ? `${geometry.last.value}` : '--');

  return (
    <motion.div
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.94, y: 10 }
      }
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.94, y: 6 }
      }
      transition={{
        duration: 0.28,
        delay: reducedMotion ? 0 : config.staggerIndex * 0.09,
        ease: [0.16, 1, 0.3, 1],
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
      style={{
        borderColor: config.borderColor,
        background:
          'linear-gradient(145deg, rgba(6, 13, 28, 0.82) 0%, rgba(10, 21, 42, 0.74) 100%)',
        boxShadow:
          '0 14px 32px -8px rgba(0, 0, 0, 0.65), inset 0 1px 0 0 rgba(0, 240, 255, 0.16)',
      }}
      className={`nexus-heart-hud-glass pointer-events-auto lg:absolute ${config.positionClass} w-full lg:w-[258px] h-[136px] rounded-[14px] border backdrop-blur-md p-3.5 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1 hover:brightness-110 select-none overflow-hidden`}
    >
      {/* Subtle Ambient Reflection from the 3D Heart */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 opacity-25"
        style={{
          background: `radial-gradient(circle at 50% 100%, rgba(255, 46, 84, 0.28), transparent 65%)`,
        }}
      />

      {/* Top Header: Title + Current Value + Mode Badge */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon style={{ color: config.strokeColor }} className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[11px] font-mono-tech font-semibold tracking-wide text-slate-300 truncate">
              {config.label}
            </span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span
              className="font-display font-bold text-2xl tracking-tight"
              style={{ color: '#f8fafc' }}
            >
              {activePoint ? activePoint.value : displayValue}
            </span>
            <span
              className="text-[11px] font-mono-tech font-semibold"
              style={{ color: config.strokeColor }}
            >
              {config.unit}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span
            className={`px-1.5 py-0.5 rounded text-[9px] font-mono-tech font-bold border ${
              dataMode === 'demo'
                ? 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                : isLiveConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                : 'bg-rose-500/15 text-rose-300 border-rose-400/35'
            }`}
          >
            {dataMode === 'demo' ? 'DEMO' : isLiveConnected ? 'LIVE' : 'NO DATA'}
          </span>
          {activePoint && (
            <span className="mt-1 text-[9px] font-mono-tech text-cyan-300">
              {activePoint.time}
            </span>
          )}
        </div>
      </div>

      {/* Progressive Line Chart or Insufficient Live Data State */}
      <div className="relative z-10 h-[56px] w-full mt-1">
        {geometry ? (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-full overflow-visible"
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={`hudGrad-${config.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.strokeColor} stopOpacity="0.34" />
                <stop offset="100%" stopColor={config.strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Area under curve */}
            <motion.path
              d={geometry.areaPath}
              fill={`url(#hudGrad-${config.key})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: config.staggerIndex * 0.09 + 0.15 }}
            />

            {/* Smooth animated line draw (400-700ms) */}
            <motion.path
              d={geometry.linePath}
              fill="none"
              stroke={config.strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0, opacity: 0.4 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 0.58,
                delay: reducedMotion ? 0 : config.staggerIndex * 0.09 + 0.08,
                ease: 'easeOut',
              }}
            />

            {/* Glowing Live Dot at Latest Point */}
            <circle
              cx={geometry.last.x}
              cy={geometry.last.y}
              r="3.2"
              fill={config.strokeColor}
            />
            <circle
              cx={geometry.last.x}
              cy={geometry.last.y}
              r="6.5"
              fill="none"
              stroke={config.strokeColor}
              strokeWidth="1.2"
              opacity="0.55"
            />

            {/* Hover Indicator */}
            {activePoint && (
              <>
                <line
                  x1={activePoint.x}
                  y1={2}
                  x2={activePoint.x}
                  y2={height - 2}
                  stroke="rgba(248, 250, 252, 0.35)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="4"
                  fill="#ffffff"
                  stroke={config.strokeColor}
                  strokeWidth="2"
                />
              </>
            )}

            {/* Invisible Hover Columns for Smooth Tooltip Scrubbing */}
            {geometry.coords.map((pt, idx) => {
              const colW = width / geometry.coords.length;
              return (
                <rect
                  key={idx}
                  x={idx * colW}
                  y={0}
                  width={colW}
                  height={height}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              );
            })}
          </svg>
        ) : (
          <div className="h-full w-full flex items-center justify-center rounded-lg bg-slate-950/50 border border-slate-800/70 px-2 text-center">
            <span className="text-[10px] font-mono-tech text-slate-400">
              Chưa đủ dữ liệu LIVE từ cảm biến ESP32
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const FloatingHeartChartsHUD: React.FC<FloatingHeartChartsHUDProps> = ({
  visible,
  onClose,
  metrics,
  series,
  dataMode,
  isLiveConnected,
  reducedMotion,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Close Button Pill at Top Center of the 3D Stage */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="lg:absolute lg:top-3 lg:left-1/2 lg:-translate-x-1/2 z-30 flex justify-center mb-2 lg:mb-0"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#070f22]/90 hover:bg-[#0d1b38] border border-cyan-400/45 text-[11px] font-mono-tech text-cyan-200 shadow-lg cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5 text-cyan-400" />
              <span>Đóng 4 biểu đồ (hoặc Chuột phải lần nữa)</span>
            </button>
          </motion.div>

          {/* 4 Floating Glass Panels Container */}
          <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-3 lg:mt-0 lg:block lg: pointer-events-none lg:absolute lg:inset-0">
            {FLOATING_CHART_CONFIGS.map((cfg) => (
              <SingleGlassChartPanel
                key={cfg.key}
                config={cfg}
                metric={metrics.find((m) => m.key === cfg.key)}
                series={series}
                dataMode={dataMode}
                isLiveConnected={isLiveConnected}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

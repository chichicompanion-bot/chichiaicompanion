import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X,
  Heart,
  Droplets,
  Activity,
  Thermometer,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
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
  iconBg: string;
  iconBorder: string;
  yTicks: [number, number, number];
  desktopPositionStyle: React.CSSProperties;
  mobilePositionStyle: React.CSSProperties;
  originOffset: { x: string; y: string };
  leaderLine: {
    startX: number;
    startY: number;
    elbowX: number;
    elbowY: number;
    endX: number;
    endY: number;
    dotColor: string;
  };
  staggerOpenMs: number;
  staggerCloseMs: number;
  defaultDelta: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  extractValue: (pt: TelemetryTimeSeriesPoint) => number | null;
}

const FLOATING_CHART_CONFIGS: ChartConfig[] = [
  {
    key: 'heartRate',
    label: 'Heart Rate',
    unit: 'BPM',
    strokeColor: '#ff4d6d',
    iconBg: 'rgba(255, 77, 109, 0.14)',
    iconBorder: 'rgba(255, 77, 109, 0.48)',
    yTicks: [40, 80, 120],
    desktopPositionStyle: { top: '32px', left: '24px' },
    mobilePositionStyle: { top: '10px', left: '8px' },
    originOffset: { x: '48px', y: '28px' },
    leaderLine: {
      startX: 392,
      startY: 192,
      elbowX: 358,
      elbowY: 158,
      endX: 312,
      endY: 158,
      dotColor: '#ff4d6d',
    },
    staggerOpenMs: 0,
    staggerCloseMs: 90,
    defaultDelta: '+2.6% so với trước',
    icon: Heart,
    extractValue: (pt) => pt.heartRate,
  },
  {
    key: 'spo2',
    label: 'Blood Oxygen',
    unit: '%',
    strokeColor: '#00f0ff',
    iconBg: 'rgba(0, 240, 255, 0.14)',
    iconBorder: 'rgba(0, 240, 255, 0.48)',
    yTicks: [90, 95, 100],
    desktopPositionStyle: { top: '32px', right: '24px' },
    mobilePositionStyle: { top: '10px', right: '8px' },
    originOffset: { x: '-48px', y: '28px' },
    leaderLine: {
      startX: 608,
      startY: 192,
      elbowX: 642,
      elbowY: 158,
      endX: 688,
      endY: 158,
      dotColor: '#00f0ff',
    },
    staggerOpenMs: 55,
    staggerCloseMs: 60,
    defaultDelta: '+0.4% so với trước',
    icon: Droplets,
    extractValue: (pt) => pt.spo2,
  },
  {
    key: 'hrv',
    label: 'HRV',
    unit: 'ms',
    strokeColor: '#00e5a3',
    iconBg: 'rgba(0, 229, 163, 0.14)',
    iconBorder: 'rgba(0, 229, 163, 0.48)',
    yTicks: [20, 50, 80],
    desktopPositionStyle: { bottom: '86px', left: '24px' },
    mobilePositionStyle: { bottom: '52px', left: '8px' },
    originOffset: { x: '48px', y: '-28px' },
    leaderLine: {
      startX: 368,
      startY: 388,
      elbowX: 338,
      elbowY: 418,
      endX: 312,
      endY: 418,
      dotColor: '#00e5a3',
    },
    staggerOpenMs: 110,
    staggerCloseMs: 30,
    defaultDelta: '+6.3% so với trước',
    icon: Activity,
    extractValue: (pt) => pt.hrv,
  },
  {
    key: 'skinTemp',
    label: 'Skin Temperature',
    unit: '°C',
    strokeColor: '#f59e0b',
    iconBg: 'rgba(245, 158, 11, 0.14)',
    iconBorder: 'rgba(245, 158, 11, 0.48)',
    yTicks: [34, 36, 38],
    desktopPositionStyle: { bottom: '86px', right: '24px' },
    mobilePositionStyle: { bottom: '52px', right: '8px' },
    originOffset: { x: '-48px', y: '-28px' },
    leaderLine: {
      startX: 632,
      startY: 388,
      elbowX: 662,
      elbowY: 418,
      endX: 688,
      endY: 418,
      dotColor: '#f59e0b',
    },
    staggerOpenMs: 165,
    staggerCloseMs: 0,
    defaultDelta: '+0.2% so với trước',
    icon: Thermometer,
    extractValue: (pt) => pt.skinTemp,
  },
];

interface SingleGlassChartPanelProps {
  config: ChartConfig;
  visible: boolean;
  metric?: MetricCardData;
  series: TelemetryTimeSeriesPoint[];
  dataMode: DataMode;
  isLiveConnected: boolean;
  reducedMotion: boolean;
}

const SingleGlassChartPanel: React.FC<SingleGlassChartPanelProps> = React.memo(
  ({
    config,
    visible,
    metric,
    series,
    dataMode,
    isLiveConnected,
    reducedMotion,
  }) => {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);
    const Icon = config.icon;

    const validPoints = useMemo(() => {
      if (dataMode === 'live' && !isLiveConnected) {
        return [];
      }
      return series
        .slice(-24)
        .map((pt) => ({
          time: pt.timeLabel,
          value: config.extractValue(pt),
        }))
        .filter(
          (d): d is { time: string; value: number } =>
            d.value !== null && !Number.isNaN(d.value)
        );
    }, [series, dataMode, isLiveConnected, config]);

    const svgW = 216;
    const svgH = 62;
    const padL = 4;
    const padR = 4;
    const padT = 4;
    const padB = 4;

    const geometry = useMemo(() => {
      const cleanPoints = validPoints.filter((p) => p && Number.isFinite(p.value));
      if (cleanPoints.length < 2) return null;
      const [minTick, , maxTick] = config.yTicks;
      const vals = cleanPoints.map((p) => Number(p.value));
      const min = Math.min(minTick, ...vals);
      const max = Math.max(maxTick, ...vals);
      const span = max > min ? max - min : 1;

      const coords = cleanPoints.map((pt, i) => {
        const x =
          padL + (i / (cleanPoints.length - 1)) * (svgW - padL - padR);
        const y =
          svgH - padB - ((pt.value - min) / span) * (svgH - padT - padB);
        return {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : svgH - padB,
          time: pt.time,
          value: pt.value,
        };
      });

      const safeCoords = coords.filter((c) => Number.isFinite(c.x) && Number.isFinite(c.y));
      if (safeCoords.length < 2) return null;

      const linePath = safeCoords
        .map(
          (c, idx) =>
            `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
        )
        .join(' ');

      const last = safeCoords[safeCoords.length - 1];
      const first = safeCoords[0];
      const areaPath = `${linePath} L ${last.x.toFixed(1)} ${svgH} L ${first.x.toFixed(1)} ${svgH} Z`;

      const timeLabels = [0, 0.33, 0.66, 1].map((t) => {
        const idx = Math.min(
          coords.length - 1,
          Math.round(t * (coords.length - 1))
        );
        const raw = coords[idx].time;
        return raw.length > 5 && raw.split(':').length === 3
          ? raw.slice(0, 5)
          : raw;
      });

      return { coords, linePath, areaPath, last, timeLabels };
    }, [validPoints, config.yTicks]);

    const handleSvgMouseMove = useCallback(
      (e: React.MouseEvent<SVGSVGElement>) => {
        if (!geometry || geometry.coords.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width <= 0) return;
        const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const idx = Math.round(relX * (geometry.coords.length - 1));
        setHoverIdx((prev) => (prev === idx ? prev : idx));
      },
      [geometry]
    );

    const activePoint =
      hoverIdx !== null && geometry?.coords[hoverIdx]
        ? geometry.coords[hoverIdx]
        : null;

    const displayValue =
      dataMode === 'live' && !isLiveConnected
        ? '--'
        : metric?.formattedValue ??
          (geometry?.last ? `${geometry.last.value}` : '--');

    const deltaPercent = metric?.deltaPercent ?? 1.2;
    const deltaText =
      metric?.deltaPercent !== null && metric?.deltaPercent !== undefined
        ? `${metric.deltaPercent >= 0 ? '+' : ''}${metric.deltaPercent}%`
        : config.defaultDelta;

    const [isMobile, setIsMobile] = useState(() =>
      typeof window !== 'undefined' ? window.innerWidth < 768 : false
    );
    useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const posStyle = isMobile ? config.mobilePositionStyle : config.desktopPositionStyle;

    const panelVars = {
      ...posStyle,
      '--from-x': reducedMotion ? '0px' : config.originOffset.x,
      '--from-y': reducedMotion ? '0px' : config.originOffset.y,
      '--stagger-open': reducedMotion ? '0ms' : `${config.staggerOpenMs}ms`,
      '--stagger-close': reducedMotion ? '0ms' : `${config.staggerCloseMs}ms`,
    } as React.CSSProperties;

    return (
      <div
        aria-hidden={!visible}
        onContextMenu={(e) => {
          e.preventDefault();
        }}
        style={panelVars}
        className={`nexus-heart-hud-glass nexus-heart-hud-panel ${
          visible ? 'is-open' : 'is-closed'
        } absolute w-[138px] sm:w-[155px] md:w-[272px] lg:w-[288px] h-[86px] sm:h-[92px] md:h-[176px] p-2 sm:p-2.5 md:p-3.5 rounded-[12px] md:rounded-[14px] flex flex-col justify-between select-none overflow-hidden`}
      >
        {/* Top Glowing Cyan Accent Line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-4 right-4 h-[1.5px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0, 240, 255, 0.85) 50%, transparent 100%)',
          }}
        />

        {/* Card Header: Circular Icon + Metric Name/Value + DEMO/LIVE Badge */}
        <div className="relative z-10 flex items-start justify-between gap-1.5">
          <div className="flex items-start gap-1.5 sm:gap-2 md:gap-2.5 min-w-0">
            <div
              style={{
                backgroundColor: config.iconBg,
                borderColor: config.iconBorder,
              }}
              className="w-6 h-6 sm:w-7 sm:h-7 md:w-9 md:h-9 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
            >
              <Icon style={{ color: config.strokeColor }} className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] sm:text-[11px] md:text-[12px] font-medium text-slate-700 dark:text-slate-200 truncate leading-tight">
                {config.label}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display font-bold text-[16px] sm:text-[18px] md:text-[24px] leading-none tracking-tight text-slate-900 dark:text-white">
                  {activePoint ? activePoint.value : displayValue}
                </span>
                <span className="text-[9px] sm:text-[10px] md:text-[11px] font-mono-tech font-semibold text-slate-500 dark:text-slate-300">
                  {config.unit}
                </span>
              </div>
              <div className="hidden md:flex mt-1 items-center gap-1 text-[10px] font-mono-tech text-emerald-500 dark:text-emerald-400">
                {deltaPercent >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 shrink-0 text-sky-500" />
                )}
                <span className="truncate">
                  {activePoint ? `Lúc ${activePoint.time}` : deltaText}
                </span>
              </div>
            </div>
          </div>

          {/* DEMO / LIVE Badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-mono-tech font-bold tracking-wider border shrink-0 ${
              dataMode === 'demo'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-400/45'
                : isLiveConnected
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-400/45'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-400/45'
            }`}
          >
            {dataMode === 'demo' ? 'DEMO' : isLiveConnected ? 'LIVE' : 'STANDBY'}
          </span>
        </div>

        {/* Line Chart Area */}
        <div className="relative z-10 mt-0.5 md:mt-1 flex flex-col">
          {geometry ? (
            <>
              <div className="flex items-center gap-1 h-[28px] sm:h-[34px] md:h-[62px]">
                {/* Y-Axis Labels (Desktop only) */}
                <div className="hidden md:flex flex-col justify-between h-full py-0.5 text-[9px] font-mono-tech text-slate-400 text-right w-6 shrink-0">
                  <span>{config.yTicks[2]}</span>
                  <span>{config.yTicks[1]}</span>
                  <span>{config.yTicks[0]}</span>
                </div>

                {/* SVG Chart */}
                <div className="flex-1 h-full relative border-b md:border-l border-slate-300 dark:border-slate-700/60">
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-full overflow-visible cursor-crosshair"
                    onMouseMove={handleSvgMouseMove}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    <defs>
                      <linearGradient
                        id={`hudAreaGrad-${config.key}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={config.strokeColor}
                          stopOpacity="0.32"
                        />
                        <stop
                          offset="100%"
                          stopColor={config.strokeColor}
                          stopOpacity="0.0"
                        />
                      </linearGradient>
                    </defs>

                    <g className="nexus-hud-chart-reveal">
                      <path
                        d={geometry.areaPath}
                        fill={`url(#hudAreaGrad-${config.key})`}
                      />
                      <path
                        d={geometry.linePath}
                        fill="none"
                        stroke={config.strokeColor}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx={geometry.last.x}
                        cy={geometry.last.y}
                        r="3.2"
                        fill={config.strokeColor}
                      />
                    </g>
                  </svg>
                </div>
              </div>

              {/* X-Axis Timestamps (Desktop only) */}
              <div className="hidden md:flex pl-7 pt-1 items-center justify-between text-[9px] font-mono-tech text-slate-400">
                {geometry.timeLabels.map((lbl, i) => (
                  <span key={i}>{lbl}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[28px] md:h-[74px] w-full flex items-center justify-center rounded bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/70 px-1 text-center">
              <span className="text-[9px] md:text-[10px] font-mono-tech text-slate-400">
                Chờ dữ liệu...
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export const FloatingHeartChartsHUD: React.FC<FloatingHeartChartsHUDProps> =
  React.memo(
    ({
      visible,
      onClose,
      metrics,
      series,
      dataMode,
      isLiveConnected,
      reducedMotion,
    }) => {
      return (
        <>
          {/* Sci-Fi Angled Callout Leader Lines (Desktop only) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 640"
            preserveAspectRatio="none"
            className="hidden md:block pointer-events-none absolute inset-0 w-full h-full z-10"
          >
            {FLOATING_CHART_CONFIGS.map((cfg) => {
              const { startX, startY, elbowX, elbowY, endX, endY, dotColor } =
                cfg.leaderLine;
              const d = `M ${startX} ${startY} L ${elbowX} ${elbowY} L ${endX} ${elbowY}`;
              const lineVars = {
                '--stagger-open': reducedMotion ? '0ms' : `${cfg.staggerOpenMs}ms`,
              } as React.CSSProperties;

              return (
                <g
                  key={cfg.key}
                  style={lineVars}
                  className={`nexus-hud-leader-line ${visible ? 'is-open' : ''}`}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(0, 240, 255, 0.58)"
                    strokeWidth="1.4"
                  />
                  <circle
                    cx={startX}
                    cy={startY}
                    r="4"
                    fill="#ffffff"
                    stroke={dotColor}
                    strokeWidth="2"
                  />
                  <circle cx={endX} cy={endY} r="3" fill="#00f0ff" />
                </g>
              );
            })}
          </svg>

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Thu nhỏ 4 biểu đồ"
            className={`absolute top-2 sm:top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full bg-white/95 dark:bg-[#051024]/92 hover:bg-slate-100 dark:hover:bg-[#0a1d3b] border border-cyan-500/40 text-[9px] sm:text-[10px] font-mono-tech text-cyan-600 dark:text-cyan-200 shadow-md cursor-pointer transition-all duration-300 ${
              visible
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 -translate-y-2 scale-90 pointer-events-none'
            }`}
          >
            <X className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-cyan-500" />
            <span className="hidden sm:inline">Thu nhỏ 4 biểu đồ</span>
            <span className="sm:hidden">Thu nhỏ</span>
          </button>

          {/* 4 Floating Glass Panels: Absolute in the 4 corners */}
          <div
            className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-300 ${
              visible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {FLOATING_CHART_CONFIGS.map((cfg) => (
              <SingleGlassChartPanel
                key={cfg.key}
                config={cfg}
                visible={visible}
                metric={metrics.find((m) => m.key === cfg.key)}
                series={series}
                dataMode={dataMode}
                isLiveConnected={isLiveConnected}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>
        </>
      );
    }
  );

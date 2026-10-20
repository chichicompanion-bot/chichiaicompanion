import React, { useCallback, useMemo, useState } from 'react';
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
  // Radial offset vector from the 3D Heart center so each panel glides out from (and retracts into) the heart
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
    desktopPositionStyle: { top: '32px', left: '28px' },
    originOffset: { x: '68px', y: '38px' },
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
    desktopPositionStyle: { top: '32px', right: '28px' },
    originOffset: { x: '-68px', y: '38px' },
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
    desktopPositionStyle: { bottom: '86px', left: '28px' },
    originOffset: { x: '68px', y: '-38px' },
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
    desktopPositionStyle: { bottom: '86px', right: '28px' },
    originOffset: { x: '-68px', y: '-38px' },
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
    const padT = 6;
    const padB = 6;

    const geometry = useMemo(() => {
      if (validPoints.length < 2) return null;
      const [minTick, , maxTick] = config.yTicks;
      const vals = validPoints.map((p) => p.value);
      const min = Math.min(minTick, ...vals);
      const max = Math.max(maxTick, ...vals);
      const span = max - min || 1;

      const coords = validPoints.map((pt, i) => {
        const x =
          padL + (i / (validPoints.length - 1)) * (svgW - padL - padR);
        const y =
          svgH - padB - ((pt.value - min) / span) * (svgH - padT - padB);
        return { x, y, time: pt.time, value: pt.value };
      });

      const linePath = coords
        .map(
          (c, idx) =>
            `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`
        )
        .join(' ');

      const last = coords[coords.length - 1];
      const first = coords[0];
      const areaPath = `${linePath} L ${last.x.toFixed(1)} ${svgH} L ${first.x.toFixed(1)} ${svgH} Z`;

      // Pick 4 evenly spaced time labels and format cleanly so they never collide
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
        ? `${metric.deltaPercent >= 0 ? '+' : ''}${metric.deltaPercent}% so với trước`
        : config.defaultDelta;

    const panelVars = {
      ...config.desktopPositionStyle,
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
        } relative md:absolute w-full md:w-[272px] lg:w-[288px] h-[176px] rounded-[14px] p-3.5 flex flex-col justify-between select-none overflow-hidden`}
      >
        {/* Top Glowing Cyan Accent Line */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-6 right-6 h-[1.5px]"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0, 240, 255, 0.85) 50%, transparent 100%)',
          }}
        />

        {/* Subtle Ambient Reflection from the 3D Heart */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-4 opacity-20"
          style={{
            background: `radial-gradient(circle at 50% 100%, ${config.strokeColor}55, transparent 68%)`,
          }}
        />

        {/* Card Header: Circular Icon + Metric Name/Value + DEMO/LIVE Badge */}
        <div className="relative z-10 flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              style={{
                backgroundColor: config.iconBg,
                borderColor: config.iconBorder,
                boxShadow: `0 0 14px -2px ${config.iconBorder}`,
              }}
              className="w-9 h-9 rounded-full border flex items-center justify-center shrink-0 mt-0.5"
            >
              <Icon style={{ color: config.strokeColor }} className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="text-[12px] font-medium text-slate-200 truncate leading-tight">
                {config.label}
              </div>
              <div className="mt-0.5 flex items-baseline gap-1">
                <span className="font-display font-bold text-[24px] leading-none tracking-tight text-white">
                  {activePoint ? activePoint.value : displayValue}
                </span>
                <span className="text-[11px] font-mono-tech font-semibold text-slate-300">
                  {config.unit}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-mono-tech text-emerald-400">
                {deltaPercent >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 shrink-0 text-sky-400" />
                )}
                <span className="truncate">
                  {activePoint ? `Lúc ${activePoint.time}` : deltaText}
                </span>
              </div>
            </div>
          </div>

          {/* DEMO / LIVE Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-mono-tech font-bold tracking-wider border shrink-0 ${
              dataMode === 'demo'
                ? 'bg-amber-500/15 text-amber-300 border-amber-400/45'
                : isLiveConnected
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/45'
                : 'bg-rose-500/15 text-rose-300 border-rose-400/45'
            }`}
          >
            {dataMode === 'demo' ? 'DEMO' : isLiveConnected ? 'LIVE' : 'STANDBY'}
          </span>
        </div>

        {/* Line Chart Area with Y-Axis Ticks & X-Axis Time Labels */}
        <div className="relative z-10 mt-1 flex flex-col">
          {geometry ? (
            <>
              <div className="flex items-center gap-1.5 h-[62px]">
                {/* Y-Axis Labels */}
                <div className="flex flex-col justify-between h-full py-0.5 text-[9px] font-mono-tech text-slate-400 text-right w-6 shrink-0">
                  <span>{config.yTicks[2]}</span>
                  <span>{config.yTicks[1]}</span>
                  <span>{config.yTicks[0]}</span>
                </div>

                {/* SVG Chart (Single MouseMove Handler for Zero DOM Overhead) */}
                <div className="flex-1 h-full relative border-l border-b border-slate-700/60">
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

                    {/* Subtle Horizontal Grid Lines */}
                    <line
                      x1="0"
                      y1={svgH * 0.2}
                      x2={svgW}
                      y2={svgH * 0.2}
                      stroke="rgba(148, 163, 184, 0.1)"
                      strokeWidth="1"
                    />
                    <line
                      x1="0"
                      y1={svgH * 0.55}
                      x2={svgW}
                      y2={svgH * 0.55}
                      stroke="rgba(148, 163, 184, 0.1)"
                      strokeWidth="1"
                    />

                    {/* GPU-Accelerated Left-to-Right Telemetry Sweep Group */}
                    <g className="nexus-hud-chart-reveal">
                      <path
                        d={geometry.areaPath}
                        fill={`url(#hudAreaGrad-${config.key})`}
                      />
                      <path
                        d={geometry.linePath}
                        fill="none"
                        stroke={config.strokeColor}
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx={geometry.last.x}
                        cy={geometry.last.y}
                        r="2.6"
                        fill={config.strokeColor}
                      />
                      <circle
                        cx={geometry.last.x}
                        cy={geometry.last.y}
                        r="5.5"
                        fill="none"
                        stroke={config.strokeColor}
                        strokeWidth="1"
                        opacity="0.55"
                      />
                    </g>

                    {/* Active Hover Scrub Point */}
                    {activePoint && (
                      <>
                        <line
                          x1={activePoint.x}
                          y1={2}
                          x2={activePoint.x}
                          y2={svgH - 2}
                          stroke="rgba(248, 250, 252, 0.4)"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={activePoint.x}
                          cy={activePoint.y}
                          r="3.5"
                          fill="#ffffff"
                          stroke={config.strokeColor}
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </svg>
                </div>
              </div>

              {/* X-Axis Timestamps Row */}
              <div className="pl-7 pt-1 flex items-center justify-between text-[9px] font-mono-tech text-slate-400">
                {geometry.timeLabels.map((lbl, i) => (
                  <span key={i}>{lbl}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[74px] w-full flex items-center justify-center rounded-lg bg-slate-950/50 border border-slate-800/70 px-2 text-center">
              <span className="text-[10px] font-mono-tech text-slate-400">
                Chưa đủ dữ liệu LIVE từ cảm biến ESP32
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
          {/* Sci-Fi Angled Callout Leader Lines Connecting Orbital Ring to the 4 Floating Panels */}
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
                  {/* Inner orbital anchor dot */}
                  <circle
                    cx={startX}
                    cy={startY}
                    r="4"
                    fill="#ffffff"
                    stroke={dotColor}
                    strokeWidth="2"
                  />
                  {/* Panel edge anchor dot */}
                  <circle cx={endX} cy={endY} r="3" fill="#00f0ff" />
                </g>
              );
            })}
          </svg>

          {/* Subtle Top-Center Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Đóng 4 biểu đồ (hoặc nhấp chuột phải lần nữa)"
            className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#051024]/92 hover:bg-[#0a1d3b] border border-cyan-400/45 text-[10px] font-mono-tech text-cyan-200 shadow-lg cursor-pointer transition-all duration-300 ${
              visible
                ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
                : 'opacity-0 -translate-y-2 scale-90 pointer-events-none'
            }`}
          >
            <X className="w-3 h-3 text-cyan-400" />
            <span>Đóng 4 biểu đồ</span>
          </button>

          {/* 4 Floating Glass Panels: Always mounted for 0ms layout cost; collapsed on mobile when closed */}
          <div
            className={`relative md:static z-20 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full px-4 md:p-0 md:block md:pointer-events-none md:absolute md:inset-0 transition-all duration-300 ${
              visible
                ? 'pb-16 md:pb-0 max-h-[900px] opacity-100'
                : 'max-h-0 overflow-hidden opacity-0 md:max-h-none md:overflow-visible md:opacity-100 pointer-events-none'
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

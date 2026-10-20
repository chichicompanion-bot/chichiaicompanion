import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import {
  X,
  Heart,
  Droplets,
  Activity,
  Thermometer,
  Footprints,
  Moon,
  BrainCircuit,
  Cpu,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  MetricCardData,
  MetricKey,
  TelemetryTimeSeriesPoint,
  TimeRange,
} from '../types/health';

interface MetricDetailModalProps {
  metric: MetricCardData | null;
  series: TelemetryTimeSeriesPoint[];
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
  onClose: () => void;
  isLightMode: boolean;
}

const MODAL_ICONS: Record<
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

const TIME_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1 Giờ' },
  { id: '6h', label: '6 Giờ' },
  { id: '24h', label: '24 Giờ' },
  { id: '7d', label: '7 Ngày' },
];

export const MetricDetailModal: React.FC<MetricDetailModalProps> = ({
  metric,
  series,
  timeRange,
  onChangeTimeRange,
  onClose,
  isLightMode,
}) => {
  if (!metric) return null;

  const Icon = MODAL_ICONS[metric.key];

  // Build chart data for ANY of the 7 metrics
  const chartData =
    metric.key === 'steps' || metric.key === 'sleep'
      ? metric.sparkline.map((pt, idx) => ({
          timeLabel:
            metric.key === 'sleep'
              ? pt.time
              : `Mốc ${idx + 1}`,
          value:
            metric.key === 'steps'
              ? Math.round(pt.value * 100)
              : pt.value,
        }))
      : series.map((pt) => {
          let val: number | null = null;
          if (metric.key === 'heartRate') val = pt.heartRate;
          else if (metric.key === 'spo2') val = pt.spo2;
          else if (metric.key === 'hrv') val = pt.hrv;
          else if (metric.key === 'skinTemp') val = pt.skinTemp;
          else if (metric.key === 'stress') val = pt.stress;
          return {
            timeLabel: pt.timeLabel,
            value: val ?? metric.value ?? 0,
          };
        });

  const numericValues = chartData
    .map((d) => d.value)
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

  const minVal =
    numericValues.length > 0
      ? Math.round(Math.min(...numericValues) * 10) / 10
      : '--';
  const maxVal =
    numericValues.length > 0
      ? Math.round(Math.max(...numericValues) * 10) / 10
      : '--';
  const avgVal =
    numericValues.length > 0
      ? Math.round(
          (numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 10
        ) / 10
      : '--';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: metric.accentColor }}
        className={`relative w-full max-w-xl rounded-2xl border-2 p-5 sm:p-6 shadow-2xl transition-colors ${
          isLightMode
            ? 'bg-white text-slate-900 shadow-slate-300/80'
            : 'bg-[#0b1222] text-slate-100 shadow-black/80'
        }`}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-500/20">
          <div className="flex items-center gap-3">
            <div
              style={{
                borderColor: `${metric.accentColor}66`,
                backgroundColor: `${metric.accentColor}18`,
              }}
              className="w-11 h-11 rounded-xl border flex items-center justify-center shrink-0"
            >
              <Icon style={{ color: metric.accentColor }} className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-tech font-bold tracking-wider uppercase opacity-75">
                  {metric.title}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono-tech font-semibold border ${
                    metric.freshness === 'LIVE'
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-500 border-amber-500/40'
                  }`}
                >
                  {metric.freshness}
                </span>
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl mt-0.5">
                {metric.vietnameseTitle}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isLightMode
                ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Value & Time Range Filter */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-display font-bold text-4xl"
                style={{ color: metric.accentColor }}
              >
                {metric.formattedValue}
              </span>
              <span className="text-sm font-mono-tech opacity-75 uppercase">
                {metric.unit}
              </span>
            </div>
            <div className="text-xs opacity-75 mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>{metric.deltaLabel}</span>
            </div>
          </div>

          {metric.key !== 'sleep' && (
            <div
              className={`flex items-center p-1 rounded-xl border ${
                isLightMode
                  ? 'bg-slate-100 border-slate-200'
                  : 'bg-slate-900/90 border-slate-800'
              }`}
            >
              {TIME_RANGES.map((tr) => (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => onChangeTimeRange(tr.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono-tech transition-all cursor-pointer ${
                    timeRange === tr.id
                      ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Interactive Mini Chart / Diagram inside Modal */}
        <div
          className={`mt-4 h-52 w-full rounded-xl border p-3 ${
            isLightMode
              ? 'bg-slate-50 border-slate-200'
              : 'bg-slate-950/70 border-slate-800/80'
          }`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {metric.key === 'sleep' || metric.key === 'steps' ? (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isLightMode ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.12)'}
                />
                <XAxis
                  dataKey="timeLabel"
                  tick={{
                    fill: isLightMode ? '#334155' : '#94a3b8',
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <YAxis
                  tick={{
                    fill: isLightMode ? '#334155' : '#94a3b8',
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLightMode ? '#ffffff' : '#090e1d',
                    borderColor: metric.accentColor,
                    color: isLightMode ? '#0f172a' : '#f8fafc',
                    borderRadius: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [`${v} ${metric.unit}`, metric.title]}
                />
                <Bar
                  dataKey="value"
                  fill={metric.accentColor}
                  radius={[6, 6, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="modalMetricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metric.accentColor} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={metric.accentColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isLightMode ? 'rgba(15,23,42,0.08)' : 'rgba(148,163,184,0.12)'}
                />
                <XAxis
                  dataKey="timeLabel"
                  tick={{
                    fill: isLightMode ? '#334155' : '#94a3b8',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{
                    fill: isLightMode ? '#334155' : '#94a3b8',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono',
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isLightMode ? '#ffffff' : '#090e1d',
                    borderColor: metric.accentColor,
                    color: isLightMode ? '#0f172a' : '#f8fafc',
                    borderRadius: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [`${v} ${metric.unit}`, metric.title]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={metric.accentColor}
                  strokeWidth={2.5}
                  fill="url(#modalMetricGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Min / Avg / Max Summary Strip */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
          <div
            className={`p-2.5 rounded-xl border ${
              isLightMode
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            <div className="text-[10px] font-mono-tech uppercase opacity-70">
              Trung bình
            </div>
            <div className="font-display font-bold text-base mt-0.5">
              {avgVal} {metric.unit}
            </div>
          </div>
          <div
            className={`p-2.5 rounded-xl border ${
              isLightMode
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            <div className="text-[10px] font-mono-tech uppercase opacity-70">
              Cao nhất (Max)
            </div>
            <div className="font-display font-bold text-base mt-0.5">
              {maxVal} {metric.unit}
            </div>
          </div>
          <div
            className={`p-2.5 rounded-xl border ${
              isLightMode
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-900/70 border-slate-800'
            }`}
          >
            <div className="text-[10px] font-mono-tech uppercase opacity-70">
              Thấp nhất (Min)
            </div>
            <div className="font-display font-bold text-base mt-0.5">
              {minVal} {metric.unit}
            </div>
          </div>
        </div>

        {/* Sensor Note & Timestamp Footer */}
        <div className="mt-4 pt-3 border-t border-slate-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs opacity-80">
          <span className="flex items-center gap-1.5 font-mono-tech">
            <Cpu className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            {metric.sensorSource}
          </span>
          <span className="flex items-center gap-1 font-mono-tech">
            <Clock className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            Cập nhật lúc: {metric.measuredAt}
          </span>
        </div>
        <p className="mt-2 text-[11px] opacity-70 leading-relaxed">{metric.note}</p>
      </div>
    </div>
  );
};

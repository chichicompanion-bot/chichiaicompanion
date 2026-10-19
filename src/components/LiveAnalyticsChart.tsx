import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';
import {
  Activity,
  Heart,
  Droplets,
  WifiOff,
  Send,
  Info,
  Sparkles,
} from 'lucide-react';
import {
  ChartMetricKey,
  DataMode,
  PPGWavePoint,
  TelemetryTimeSeriesPoint,
  TimeRange,
} from '../types/health';
import { calculateSeriesStats } from '../utils/chartProcessing';

interface LiveAnalyticsChartProps {
  series: TelemetryTimeSeriesPoint[];
  ppgWave: PPGWavePoint[];
  selectedMetric: ChartMetricKey;
  onSelectMetric: (metric: ChartMetricKey) => void;
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
  dataMode: DataMode;
  isConnected: boolean;
  isLoading: boolean;
  onSendTestPacket: () => Promise<void>;
}

const METRIC_CONFIG: Record<
  ChartMetricKey,
  {
    label: string;
    vietnameseLabel: string;
    unit: string;
    color: string;
    gradientId: string;
    domain: [number | 'auto', number | 'auto'];
    sensorDesc: string;
  }
> = {
  heartRate: {
    label: 'Heart Rate',
    vietnameseLabel: 'Nhịp tim quang học (PPG)',
    unit: 'BPM',
    color: '#FF2E54',
    gradientId: 'hrAreaGrad',
    domain: [50, 120],
    sensorDesc: 'MAX30102 Optical Pulse Sensor (LED 660nm / 880nm)',
  },
  spo2: {
    label: 'SpO₂',
    vietnameseLabel: 'Độ bão hòa Oxy máu',
    unit: '%',
    color: '#00F0FF',
    gradientId: 'spo2AreaGrad',
    domain: [92, 100],
    sensorDesc: 'MAX30102 Red/Infrared Absorption Ratio',
  },
  hrv: {
    label: 'HRV (RMSSD)',
    vietnameseLabel: 'Biến thiên nhịp tim',
    unit: 'ms',
    color: '#00E5A3',
    gradientId: 'hrvAreaGrad',
    domain: [25, 110],
    sensorDesc: 'ESP32 Inter-Beat Interval (IBI) Root Mean Square',
  },
};

const TIME_RANGE_BUTTONS: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1 Giờ' },
  { id: '6h', label: '6 Giờ' },
  { id: '24h', label: '24 Giờ' },
  { id: '7d', label: '7 Ngày' },
];

export const LiveAnalyticsChart: React.FC<LiveAnalyticsChartProps> = ({
  series,
  ppgWave,
  selectedMetric,
  onSelectMetric,
  timeRange,
  onChangeTimeRange,
  dataMode,
  isConnected,
  isLoading,
  onSendTestPacket,
}) => {
  const [sendingTest, setSendingTest] = useState(false);
  const cfg = METRIC_CONFIG[selectedMetric];
  const stats = calculateSeriesStats(series, selectedMetric);

  const handleTestPacket = async () => {
    setSendingTest(true);
    try {
      await onSendTestPacket();
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="rounded-2xl nexus-glass p-5 sm:p-6 space-y-6">
      {/* Top Bar: Title, Metric Switcher, and Time Range Filter */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-cyan-300">
              <Activity className="w-4 h-4" />
            </span>
            <h2 className="font-display font-bold text-lg sm:text-xl">
              Live Health Analytics
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold border ${
                dataMode === 'demo'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-400/35'
                  : isConnected
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/35'
                  : 'bg-rose-500/15 text-rose-300 border-rose-400/35'
              }`}
            >
              {dataMode === 'demo'
                ? 'DEMO STREAM'
                : isConnected
                ? 'LIVE ESP32 STREAM'
                : 'DISCONNECTED'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {cfg.vietnameseLabel} • Nguồn tín hiệu: {cfg.sensorDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Selector Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            <button
              type="button"
              onClick={() => onSelectMetric('heartRate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono-tech font-medium transition-all cursor-pointer ${
                selectedMetric === 'heartRate'
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40 shadow-[0_0_14px_rgba(255,46,84,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>Heart Rate</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectMetric('spo2')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono-tech font-medium transition-all cursor-pointer ${
                selectedMetric === 'spo2'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_14px_rgba(0,240,255,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>SpO₂</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectMetric('hrv')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono-tech font-medium transition-all cursor-pointer ${
                selectedMetric === 'hrv'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 shadow-[0_0_14px_rgba(0,229,163,0.25)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>HRV</span>
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            {TIME_RANGE_BUTTONS.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => onChangeTimeRange(btn.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-tech transition-all cursor-pointer ${
                  timeRange === btn.id
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Telemetry Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400 uppercase">Hiện tại</div>
          <div className="mt-1 font-display font-bold text-xl" style={{ color: cfg.color }}>
            {stats.latest !== null ? `${stats.latest} ${cfg.unit}` : '--'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400 uppercase">Trung bình</div>
          <div className="mt-1 font-display font-bold text-xl text-slate-200">
            {stats.avg !== null ? `${stats.avg} ${cfg.unit}` : '--'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400 uppercase">Cao nhất (Max)</div>
          <div className="mt-1 font-display font-bold text-xl text-slate-200">
            {stats.max !== null ? `${stats.max} ${cfg.unit}` : '--'}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400 uppercase">Thấp nhất (Min)</div>
          <div className="mt-1 font-display font-bold text-xl text-slate-200">
            {stats.min !== null ? `${stats.min} ${cfg.unit}` : '--'}
          </div>
        </div>
      </div>

      {/* Main Time-Series Area Chart OR Skeleton / Disconnected State */}
      <div className="relative h-72 sm:h-80 w-full rounded-xl bg-slate-950/50 border border-slate-800/70 p-3">
        {isLoading ? (
          <div className="w-full h-full flex flex-col justify-between p-4 animate-pulse">
            <div className="h-4 w-48 bg-slate-800 rounded" />
            <div className="h-44 w-full bg-slate-900/90 rounded-xl border border-slate-800" />
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-slate-800 rounded" />
              <div className="h-3 w-16 bg-slate-800 rounded" />
              <div className="h-3 w-16 bg-slate-800 rounded" />
            </div>
          </div>
        ) : series.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-400/30 flex items-center justify-center text-rose-400">
              <WifiOff className="w-6 h-6" />
            </div>
            <div className="font-display font-semibold text-base text-slate-200">
              Đang ở chế độ LIVE ESP32 — Chưa nhận được gói dữ liệu thực tế
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Hệ thống không hiển thị dữ liệu giả dưới nhãn dữ liệu thật. Hãy bật mạch ESP32 + MAX30102 gửi dữ liệu tới{' '}
              <code className="text-cyan-300 font-mono-tech">/api/telemetry</code>, hoặc bấm nút bên dưới để gửi 1 gói HTTP POST thử nghiệm tới cổng backend.
            </p>
            <button
              type="button"
              onClick={handleTestPacket}
              disabled={sendingTest}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-mono-tech transition-all cursor-pointer active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {sendingTest ? 'Đang gửi gói tin ESP32...' : 'Gửi gói tin ESP32 mẫu tới /api/telemetry'}
              </span>
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={cfg.gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={cfg.color} stopOpacity={0.42} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
              <XAxis
                dataKey="timeLabel"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickMargin={8}
              />
              <YAxis
                domain={cfg.domain}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                tickMargin={6}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(9, 14, 29, 0.94)',
                  borderColor: cfg.color,
                  borderRadius: '12px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                formatter={(val: number) => [`${val} ${cfg.unit}`, cfg.label]}
              />
              <Area
                type="monotone"
                dataKey={selectedMetric}
                stroke={cfg.color}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${cfg.gradientId})`}
                isAnimationActive={true}
                animationDuration={900}
                activeDot={{
                  r: 6,
                  fill: cfg.color,
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Simulated Optical PPG Waveform Panel (Strictly Labeled MAX30102 Optical Waveform) */}
      <div className="rounded-xl bg-slate-950/65 border border-slate-800/80 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="font-display font-semibold text-sm text-slate-200">
              Biểu đồ Sóng xung Quang học PPG (MAX30102 Photoplethysmography Waveform)
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-tech text-amber-300 bg-amber-500/10 border border-amber-400/30 px-2.5 py-0.5 rounded-md">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Waveform mô phỏng quang học MAX30102 — Không phải điện tâm đồ ECG y khoa
          </span>
        </div>

        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ppgWave} margin={{ top: 6, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(0, 240, 255, 0.08)" />
              <XAxis
                dataKey="timeMs"
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                tickFormatter={(v) => `${v}ms`}
              />
              <YAxis
                stroke="#475569"
                tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(9, 14, 29, 0.94)',
                  borderColor: '#00F0FF',
                  borderRadius: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '11px',
                }}
                formatter={(val: number, name: string) => [
                  `${val} mV (norm)`,
                  name === 'irSignal' ? 'Kênh Hồng ngoại (IR 880nm)' : 'Kênh Ánh sáng Đỏ (Red 660nm)',
                ]}
                labelFormatter={(ms) => `Chu kỳ lấy mẫu: ${ms} ms`}
              />
              <Line
                type="monotone"
                dataKey="irSignal"
                stroke="#00F0FF"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="redSignal"
                stroke="#FF2E54"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

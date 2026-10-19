import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { Moon, Info } from 'lucide-react';
import { SleepSummaryData } from '../types/health';

interface SleepAnalyticsProps {
  sleep: SleepSummaryData;
}

const STAGE_META = [
  {
    key: 'awake',
    label: 'Awake (Thức)',
    color: '#F59E0B',
    field: 'awakeMinutes' as const,
    desc: 'Chuyển động cổ tay rõ rệt & nhịp tim gần mức thức',
  },
  {
    key: 'rem',
    label: 'REM Sleep',
    color: '#00F0FF',
    field: 'remMinutes' as const,
    desc: 'Dao động nhịp tim tăng nhẹ kèm trương lực cơ thấp',
  },
  {
    key: 'light',
    label: 'Light Sleep (Ngủ nông)',
    color: '#38BDF8',
    field: 'lightMinutes' as const,
    desc: 'Giai đoạn chuyển tiếp chiếm tỷ trọng lớn nhất trong đêm',
  },
  {
    key: 'deep',
    label: 'Deep Sleep (Ngủ sâu)',
    color: '#6366F1',
    field: 'deepMinutes' as const,
    desc: 'Nhịp tim PPG ổn định ở mức thấp nhất & ít cử động nhất',
  },
];

const STAGE_COLORS: Record<string, string> = {
  Awake: '#F59E0B',
  REM: '#00F0FF',
  Light: '#38BDF8',
  Deep: '#6366F1',
};

export const SleepAnalytics: React.FC<SleepAnalyticsProps> = ({ sleep }) => {
  const total = sleep.totalMinutes || 1;

  return (
    <div className="rounded-2xl nexus-glass p-5 sm:p-6 flex flex-col justify-between space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-400/35 flex items-center justify-center text-indigo-300">
            <Moon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg">Sleep Architecture Analytics</h3>
            <p className="text-xs text-slate-400">
              Phân bố các giai đoạn giấc ngủ: Awake • Light • Deep • REM
            </p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold bg-amber-500/15 text-amber-300 border border-amber-400/35">
          DEMO / ƯỚC TÍNH THUẬT TOÁN
        </span>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400">TỔNG THỜI LƯỢNG</div>
          <div className="mt-1 font-display font-bold text-xl text-cyan-300">
            {sleep.formattedTotal}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400">HIỆU SUẤT NGỦ</div>
          <div className="mt-1 font-display font-bold text-xl text-emerald-300">
            {sleep.efficiencyPercent}%
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div className="text-[11px] font-mono-tech text-slate-400">DEEP + REM</div>
          <div className="mt-1 font-display font-bold text-xl text-indigo-300">
            {sleep.stages.deepMinutes + sleep.stages.remMinutes} phút
          </div>
        </div>
      </div>

      {/* Stage Breakdown Progress Bars */}
      <div className="space-y-2.5">
        {STAGE_META.map((st) => {
          const minutes = sleep.stages[st.field];
          const pct = Math.round((minutes / total) * 100);
          return (
            <div key={st.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-200 flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: st.color }}
                  />
                  {st.label}
                </span>
                <span className="font-mono-tech text-slate-300">
                  {minutes} phút ({pct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, backgroundColor: st.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Hypnogram Timeline BarChart */}
      <div className="h-36 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sleep.timeline} margin={{ top: 4, right: 6, left: -24, bottom: 0 }}>
            <XAxis
              dataKey="time"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${v}m`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(9, 14, 29, 0.95)',
                borderColor: '#38BDF8',
                borderRadius: '10px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '11px',
              }}
              formatter={(value: number, _name, props) => [
                `${value} phút • HR TB: ${props.payload.heartRateAvg} BPM`,
                `Giai đoạn: ${props.payload.stage}`,
              ]}
            />
            <Bar dataKey="durationMinutes" radius={[6, 6, 0, 0]} isAnimationActive={true}>
              {sleep.timeline.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={STAGE_COLORS[entry.stage] || '#38BDF8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Honest Algorithmic Disclaimer */}
      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <span>{sleep.estimationMethod}</span>
      </div>
    </div>
  );
};

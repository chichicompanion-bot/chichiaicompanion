import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Filter,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';
import { DataMode, HealthHistoryRecord, MetricKey } from '../types/health';
import { exportHistoryToCSV } from '../utils/chartProcessing';

interface HealthHistoryProps {
  records: HealthHistoryRecord[];
  dataMode: DataMode;
}

const METRIC_FILTER_OPTIONS: Array<{ value: 'all' | MetricKey; label: string }> = [
  { value: 'all', label: 'Tất cả chỉ số' },
  { value: 'heartRate', label: 'Heart Rate (BPM)' },
  { value: 'spo2', label: 'Blood Oxygen SpO₂ (%)' },
  { value: 'hrv', label: 'HRV RMSSD (ms)' },
  { value: 'skinTemp', label: 'Skin Temperature (°C)' },
  { value: 'steps', label: 'Steps (Bước chân)' },
  { value: 'stress', label: 'Stress Index (/100)' },
];

export const HealthHistory: React.FC<HealthHistoryProps> = ({ records, dataMode }) => {
  const [metricFilter, setMetricFilter] = useState<'all' | MetricKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    return records.filter((rec) => {
      if (metricFilter !== 'all' && rec.metricKey !== metricFilter) return false;
      if (dateFilter && !rec.timestamp.startsWith(dateFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = rec.id.toLowerCase().includes(q);
        const matchName = rec.metricName.toLowerCase().includes(q);
        const matchSensor = rec.sensor.toLowerCase().includes(q);
        const matchVal = `${rec.value}`.includes(q);
        if (!matchId && !matchName && !matchSensor && !matchVal) return false;
      }
      return true;
    });
  }, [records, metricFilter, dateFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="rounded-2xl nexus-glass p-5 sm:p-6 space-y-5">
      {/* Header + Export CSV */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/70 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-display font-bold text-lg sm:text-xl">
              Health Telemetry History
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-400/35">
              {filtered.length} BẢN GHI
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Bảng lịch sử đo theo chuỗi thời gian, hỗ trợ lọc chỉ số và xuất file CSV chuẩn UTF-8
          </p>
        </div>

        <button
          type="button"
          onClick={() => exportHistoryToCSV(filtered, dataMode)}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 disabled:opacity-40 border border-cyan-400/40 text-cyan-200 text-xs font-mono-tech font-semibold transition-all cursor-pointer active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo CSV ({filtered.length})</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã bản ghi, cảm biến, giá trị..."
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900/75 border border-slate-800 focus:border-cyan-400/60 focus:outline-none text-xs text-slate-200 placeholder:text-slate-500"
          />
        </div>

        {/* Metric Select */}
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <select
            value={metricFilter}
            onChange={(e) => {
              setMetricFilter(e.target.value as 'all' | MetricKey);
              setPage(1);
            }}
            className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900/75 border border-slate-800 focus:border-cyan-400/60 focus:outline-none text-xs text-slate-200 cursor-pointer"
          >
            {METRIC_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-900/75 border border-slate-800 focus:border-cyan-400/60 focus:outline-none text-xs text-slate-200 font-mono-tech"
          />
        </div>
      </div>

      {/* Table or Empty State */}
      {paginated.length === 0 ? (
        <div className="py-12 text-center space-y-3 rounded-xl bg-slate-950/40 border border-slate-800/70">
          <Database className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="font-display font-semibold text-sm text-slate-300">
            Chưa có dữ liệu lịch sử phù hợp
          </div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {dataMode === 'live'
              ? 'Trong chế độ LIVE ESP32, bảng lịch sử chỉ ghi nhận khi mạch thực sự truyền gói dữ liệu hợp lệ lên cổng /api/telemetry.'
              : 'Không tìm thấy bản ghi nào khớp với bộ lọc hiện tại. Hãy thử xóa từ khóa tìm kiếm.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] font-mono-tech text-slate-400 uppercase">
                <th className="py-3 px-4">Mã Gói Tin</th>
                <th className="py-3 px-4">Thời gian đo</th>
                <th className="py-3 px-4">Chỉ số Sinh học</th>
                <th className="py-3 px-4">Giá trị</th>
                <th className="py-3 px-4">Phần cứng Cảm biến</th>
                <th className="py-3 px-4">Độ toàn vẹn</th>
                <th className="py-3 px-4">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {paginated.map((rec) => (
                <tr
                  key={rec.id}
                  className="hover:bg-cyan-500/5 transition-colors"
                >
                  <td className="py-3 px-4 font-mono-tech text-cyan-300">{rec.id}</td>
                  <td className="py-3 px-4 font-mono-tech text-slate-300">
                    {rec.formattedTime}{' '}
                    <span className="text-slate-500 text-[11px]">({rec.formattedDate})</span>
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-200">{rec.metricName}</td>
                  <td className="py-3 px-4 font-mono-tech font-bold text-white">
                    {rec.value} <span className="text-slate-400 font-normal">{rec.unit}</span>
                  </td>
                  <td className="py-3 px-4 font-mono-tech text-slate-400">{rec.sensor}</td>
                  <td className="py-3 px-4 font-mono-tech text-emerald-300">
                    {rec.packetIntegrity}%
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono-tech font-semibold border ${
                        rec.freshness === 'LIVE'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                          : 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                      }`}
                    >
                      {rec.freshness}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between pt-2 text-xs font-mono-tech text-slate-400">
        <span>
          Trang {currentPage} / {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-400/40 disabled:opacity-40 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:border-cyan-400/40 disabled:opacity-40 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

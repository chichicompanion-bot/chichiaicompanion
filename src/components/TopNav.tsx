import React, { useState } from 'react';
import {
  Bell,
  Wifi,
  WifiOff,
  Clock,
  Sun,
  Moon,
  User,
  Menu,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  DataMode,
  DeviceStatusInfo,
  NavSection,
  SystemNotification,
  TimeRange,
} from '../types/health';

interface TopNavProps {
  activeSection: NavSection;
  dataMode: DataMode;
  onChangeDataMode: (mode: DataMode) => void;
  deviceStatus: DeviceStatusInfo;
  timeRange: TimeRange;
  onChangeTimeRange: (range: TimeRange) => void;
  notifications: SystemNotification[];
  onMarkAllRead: () => void;
  isLightMode: boolean;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
  onTriggerReconnect: () => void;
}

const SECTION_TITLES: Record<NavSection, { title: string; subtitle: string }> = {
  overview: {
    title: 'Biomedical Command Center',
    subtitle: 'Giám sát tổng thể 7 chỉ số sinh tồn & tín hiệu vòng tay thông minh',
  },
  live: {
    title: 'Live Optical PPG & Telemetry Stream',
    subtitle: 'Luồng sóng quang học MAX30102 & gói dữ liệu thời gian thực từ ESP32',
  },
  heart: {
    title: 'Cardiovascular & Autonomic Analytics',
    subtitle: 'Phân tích chuyên sâu Nhịp tim (BPM), Oxy máu (SpO₂) và Biến thiên nhịp tim (HRV)',
  },
  activity: {
    title: 'Activity Rings & Sleep Architecture',
    subtitle: 'Vòng năng lượng vận động MPU6050 & ước tính chu kỳ giấc ngủ',
  },
  history: {
    title: 'Health Telemetry History & Export',
    subtitle: 'Tra cứu bản ghi theo thời gian, lọc theo cảm biến và xuất báo cáo CSV',
  },
  device: {
    title: 'ESP32 Wearable Hardware & API Gateway',
    subtitle: 'Trạng thái phần cứng, tỷ lệ gói tin hợp lệ & tài liệu tích hợp firmware ESP32',
  },
  settings: {
    title: 'System Preferences & Calibration',
    subtitle: 'Chuyển đổi chế độ Demo/Live, giao diện Sáng/Tối và tùy chỉnh chuyển động',
  },
};

const TIME_RANGES: Array<{ id: TimeRange; label: string }> = [
  { id: '1h', label: '1 Giờ' },
  { id: '6h', label: '6 Giờ' },
  { id: '24h', label: '24 Giờ' },
  { id: '7d', label: '7 Ngày' },
];

export const TopNav: React.FC<TopNavProps> = ({
  activeSection,
  dataMode,
  onChangeDataMode,
  deviceStatus,
  timeRange,
  onChangeTimeRange,
  notifications,
  onMarkAllRead,
  isLightMode,
  onToggleTheme,
  onOpenMobileMenu,
  onTriggerReconnect,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const headerInfo = SECTION_TITLES[activeSection];
  const isConnected = deviceStatus.connectionState === 'connected';

  return (
    <header className="sticky top-0 z-30 nexus-glass border-b border-slate-800/70 px-4 sm:px-6 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Mobile Menu Button + Current Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Mở menu"
            className="lg:hidden p-2 rounded-xl border border-slate-700/70 bg-slate-900/60 text-slate-300 hover:text-cyan-300 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-bold text-lg sm:text-xl tracking-tight truncate">
                {headerInfo.title}
              </h1>
              {/* Explicit Data Mode Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono-tech font-semibold border ${
                  dataMode === 'demo'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                    : isConnected
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                    : 'bg-rose-500/15 text-rose-300 border-rose-400/40'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dataMode === 'demo'
                      ? 'bg-amber-400 animate-pulse'
                      : isConnected
                      ? 'bg-emerald-400 animate-ping'
                      : 'bg-rose-400'
                  }`}
                />
                {dataMode === 'demo'
                  ? 'DEMO SIMULATION'
                  : isConnected
                  ? 'LIVE ESP32 CONNECTED'
                  : 'LIVE MODE • CHƯA KẾT NỐI MẠCH'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate hidden sm:block mt-0.5">
              {headerInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Mode Toggle, Connection Status, Time Range, Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Demo / Live Mode Switcher */}
          <div
            role="group"
            aria-label="Chế độ dữ liệu"
            className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800"
          >
            <button
              type="button"
              onClick={() => onChangeDataMode('demo')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-medium transition-all cursor-pointer ${
                dataMode === 'demo'
                  ? 'bg-amber-500/20 text-amber-200 border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              DEMO
            </button>
            <button
              type="button"
              onClick={() => onChangeDataMode('live')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-medium transition-all cursor-pointer ${
                dataMode === 'live'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LIVE ESP32
            </button>
          </div>

          {/* Device & Transmission Telemetry Status Pill */}
          <div className="hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/65 border border-slate-800/80 text-xs font-mono-tech">
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              )}
              <span className={isConnected ? 'text-emerald-300' : 'text-rose-300'}>
                {isConnected
                  ? dataMode === 'demo'
                    ? 'Connected (Sim)'
                    : 'Connected'
                  : 'Disconnected'}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {deviceStatus.validPacketRatio !== null
                  ? `${deviceStatus.validPacketRatio}% PKT`
                  : '0% PKT'}
              </span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>{deviceStatus.lastPacketAt || 'Chưa cập nhật'}</span>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="hidden md:flex items-center p-1 rounded-xl bg-slate-900/80 border border-slate-800">
            {TIME_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onChangeTimeRange(r.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono-tech transition-all cursor-pointer ${
                  timeRange === r.id
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Reconnect / Refresh Telemetry Button */}
          <button
            type="button"
            onClick={onTriggerReconnect}
            title="Kiểm tra kết nối / Đồng bộ lại gói dữ liệu"
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isLightMode ? 'Chuyển sang giao diện Tối (Dark Mode)' : 'Chuyển sang giao diện Sáng (Light Mode)'}
            className="p-2 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
          >
            {isLightMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              aria-label="Thông báo hệ thống"
              className="relative p-2 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer active:scale-95"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-mono-tech font-bold text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl nexus-glass border border-slate-700/80 p-4 shadow-2xl z-50">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-display font-semibold text-sm">
                    Nhật ký Hệ thống & Cảnh báo
                  </span>
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs font-mono-tech text-cyan-400 hover:underline cursor-pointer"
                  >
                    Đánh dấu đã đọc
                  </button>
                </div>
                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        n.read
                          ? 'bg-slate-900/40 border-slate-800/70 text-slate-400'
                          : 'bg-cyan-950/25 border-cyan-500/30 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5">
                          {n.type === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          {n.title}
                        </span>
                        <span className="text-[10px] font-mono-tech text-slate-400">
                          {n.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-400 leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Demo User Profile Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-cyan-400/40 transition-all cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-slate-950 font-bold text-xs">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="hidden sm:inline text-xs font-medium text-slate-200">
                Wearer #01 (Demo)
              </span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl nexus-glass border border-slate-700/80 p-4 shadow-2xl z-50 space-y-3 text-xs">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-slate-950 font-bold">
                    NX
                  </div>
                  <div>
                    <div className="font-display font-semibold text-sm text-white">
                      Hồ sơ Người đeo (Demo)
                    </div>
                    <div className="text-slate-400 font-mono-tech text-[11px]">
                      ID: NX-SUBJECT-2026
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 font-mono-tech text-[11px] text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Thiết bị ghép nối:</span>
                    <span className="text-cyan-300">ESP32-S3 + MAX30102</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vị trí đeo:</span>
                    <span>Cổ tay trái (2cm trên mắt cá)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tần số lấy mẫu PPG:</span>
                    <span>{deviceStatus.samplingRateHz} Hz</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                  Hồ sơ mẫu phục vụ trình diễn dự án Khoa học Kỹ thuật. Không lưu trữ dữ liệu bệnh án cá nhân nhạy cảm.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

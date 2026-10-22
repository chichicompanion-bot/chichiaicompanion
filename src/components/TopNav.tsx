import React, { useState } from 'react';
import {
  Bell,
  Search,
  Settings,
  Sun,
  Moon,
  Menu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wifi,
  WifiOff,
  Radio,
  Clock,
  X,
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
  onOpenSettings?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
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
  onOpenSettings,
  searchQuery = '',
  onSearchChange,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isConnected = deviceStatus.connectionState === 'connected';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchChange) onSearchChange(localSearch);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-950/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3.5 sm:px-6 py-2.5 transition-colors">
      <div className="flex items-center justify-between gap-2.5 sm:gap-4">
        {/* Left Side: Mobile Menu Hamburger + Search Bar (Image 1 Style) */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Mở menu điều hướng"
            className="lg:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 transition cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Search Input Box (Rounded-full pill like Image 1) */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex items-center flex-1 max-w-[200px] sm:max-w-xs md:max-w-sm"
          >
            <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                if (onSearchChange) onSearchChange(e.target.value);
              }}
              placeholder="Search..."
              className="w-full pl-8 sm:pl-9 pr-7 py-1.5 rounded-full text-xs font-sans bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all shadow-xs"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  if (onSearchChange) onSearchChange('');
                }}
                className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </form>

          {/* Data Mode Pill (Desktop view) */}
          <div className="hidden xl:flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold border ${
                dataMode === 'demo'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/40'
                  : isConnected
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/40'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/40'
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
                ? 'LIVE ESP32'
                : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Right Side: Demo/Live Pill + Settings (⚙️) + Notifications (🔔) + Avatar (👤) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* DEMO / LIVE Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-mono-tech">
            <button
              type="button"
              onClick={() => onChangeDataMode('demo')}
              className={`px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${
                dataMode === 'demo'
                  ? 'bg-white dark:bg-amber-500/20 text-amber-700 dark:text-amber-200 shadow-xs border border-slate-200 dark:border-amber-400/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              DEMO
            </button>
            <button
              type="button"
              onClick={() => onChangeDataMode('live')}
              className={`px-2.5 py-1 rounded-full font-semibold transition cursor-pointer ${
                dataMode === 'live'
                  ? 'bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-200 shadow-xs border border-slate-200 dark:border-cyan-400/40'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              LIVE
            </button>
          </div>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isLightMode ? 'Chuyển sang Giao diện Tối (Dark Mode)' : 'Chuyển sang Giao diện Sáng (Light Mode)'}
            className="p-1.5 sm:p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 transition cursor-pointer shadow-xs active:scale-95"
          >
            {isLightMode ? <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Settings Button (⚙️ Image 1 Logo Cài Đặt) */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Cài đặt hệ thống SMARTWATCH HEALTH"
            className="p-1.5 sm:p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-400/40 transition cursor-pointer shadow-xs active:scale-95"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Notification Bell (🔔 Image 1 Logo Thông Báo với chấm đỏ) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              title="Thông báo sinh học & cảnh báo hệ thống"
              aria-label="Thông báo hệ thống"
              className="relative p-1.5 sm:p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-400/40 transition cursor-pointer shadow-xs active:scale-95"
            >
              <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {/* Notification Red Dot (Image 1 Style) */}
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            </button>

            {/* Notifications Dropdown Drawer */}
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-4 shadow-2xl z-50">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                    Nhật ký Hệ thống &amp; Cảnh báo
                  </span>
                  <button
                    type="button"
                    onClick={onMarkAllRead}
                    className="text-xs font-mono-tech text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
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
                          ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800/70 text-slate-500 dark:text-slate-400'
                          : 'bg-cyan-50/80 dark:bg-cyan-950/25 border-cyan-200 dark:border-cyan-500/30 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span className="flex items-center gap-1.5">
                          {n.type === 'warning' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                          )}
                          {n.title}
                        </span>
                        <span className="text-[10px] font-mono-tech text-slate-400">
                          {n.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Avatar (👤 Image 1 Style - Circular Avatar Photo) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setNotifOpen(false);
              }}
              title="Hồ sơ người đeo SMARTWATCH HEALTH"
              className="flex items-center p-0.5 rounded-full border-2 border-slate-200 dark:border-cyan-500/50 hover:border-cyan-500 dark:hover:border-cyan-400 transition cursor-pointer shadow-xs active:scale-95"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                <img
                  src="./default_avatar.svg"
                  alt="Avatar người dùng"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to stylized SVG
                    (e.currentTarget as HTMLImageElement).src =
                      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230284c7'><circle cx='12' cy='8' r='4'/><path d='M20 21a8 8 0 1 0-16 0'/></svg>";
                  }}
                />
              </div>
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 p-4 shadow-2xl z-50 space-y-3 text-xs">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-cyan-500/40">
                    <img
                      src="./default_avatar.svg"
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                      Wearer #01 (Chủ tài khoản)
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono-tech text-[11px]">
                      ID: SW-USER-2026
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5 font-mono-tech text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Thiết bị:</span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold">ESP32 + MAX30102</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Trạng thái:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Sức khỏe Tối ưu</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Tần số mẫu PPG:</span>
                    <span>{deviceStatus.samplingRateHz} Hz</span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Avatar mặc định chung cho toàn bộ hệ thống theo thiết kế SMARTWATCH HEALTH.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

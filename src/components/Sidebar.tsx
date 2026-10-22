import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Activity,
  HeartPulse,
  Moon,
  History,
  Cpu,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  Sparkles,
} from 'lucide-react';
import { DataMode, NavSection } from '../types/health';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  dataMode: DataMode;
  isLiveConnected: boolean;
  onReplayIntro: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', sublabel: 'Tổng quan sinh học', icon: LayoutDashboard },
  { id: 'live', label: 'Live Monitoring', sublabel: 'Sóng PPG & Telemetry', icon: Activity },
  { id: 'heart', label: 'Heart Analytics', sublabel: 'Tim mạch, SpO₂ & HRV', icon: HeartPulse },
  { id: 'activity', label: 'Activity & Sleep', sublabel: 'Vận động & Giấc ngủ', icon: Moon },
  { id: 'history', label: 'Health History', sublabel: 'Lịch sử đo & Xuất CSV', icon: History },
  { id: 'device', label: 'Device Management', sublabel: 'Vòng tay ESP32 + MAX30102', icon: Cpu },
  { id: 'settings', label: 'Settings', sublabel: 'Cấu hình & Giao diện', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  dataMode,
  isLiveConnected,
  onReplayIntro,
  mobileOpen,
  onCloseMobile,
}) => {
  const sidebarContent = (
    <div
      className={`h-full flex flex-col justify-between nexus-glass border-r border-slate-800/70 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Brand Logo */}
      <div>
        <div className="flex items-center justify-between h-20 px-4 border-b border-slate-800/60">
          <button
            type="button"
            onClick={() => onSelectSection('overview')}
            className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/25 via-sky-500/15 to-teal-500/25 border border-cyan-400/40 shadow-[0_0_20px_rgba(0,240,255,0.2)] group-hover:scale-105 transition-transform">
              <HeartPulse className="w-5 h-5 text-cyan-300 group-hover:text-cyan-200 transition-colors" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            </div>
            {!collapsed && (
              <div>
                <div className="font-display font-bold text-base tracking-[0.14em] text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-cyan-700 to-teal-700 dark:from-white dark:via-cyan-200 dark:to-teal-300">
                  SMARTWATCH HEALTH
                </div>
                <div className="text-[11px] font-mono-tech text-slate-500 dark:text-slate-400 tracking-wider">
                  SMARTWATCH COMPANION OS
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700/60 bg-slate-900/50 text-slate-400 hover:text-cyan-300 hover:border-cyan-400/40 transition-all cursor-pointer active:scale-95"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1.5" aria-label="Điều hướng chính">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                title={collapsed ? `${item.label} — ${item.sublabel}` : undefined}
                className={`relative w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all group cursor-pointer ${
                  isActive
                    ? 'text-cyan-200 bg-cyan-500/12 border border-cyan-400/35 shadow-[0_0_24px_rgba(0,240,255,0.12)]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/45 border border-transparent'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-cyan-400 to-teal-400 shadow-[0_0_10px_#00F0FF]"
                    transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-cyan-300' : 'text-slate-400 group-hover:text-cyan-300'
                  }`}
                />
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    <div className="text-[11px] text-slate-400/80 truncate">{item.sublabel}</div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Wearable Telemetry Summary Box */}
      <div className="p-3 border-t border-slate-800/60 space-y-2">
        {!collapsed ? (
          <div className="p-3.5 rounded-xl bg-slate-900/65 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400">
                Nguồn Dữ Liệu
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold ${
                  dataMode === 'demo'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                    : isLiveConnected
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-400/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dataMode === 'demo'
                      ? 'bg-amber-400 animate-pulse'
                      : isLiveConnected
                      ? 'bg-emerald-400 animate-ping'
                      : 'bg-rose-400'
                  }`}
                />
                {dataMode === 'demo'
                  ? 'DEMO MODE'
                  : isLiveConnected
                  ? 'ESP32 LIVE'
                  : 'DISCONNECTED'}
              </span>
            </div>

            <div className="text-xs text-slate-300 font-medium flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">ESP32-S3 + MAX30102</span>
            </div>

            <button
              type="button"
              onClick={onReplayIntro}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/25 text-[11px] font-mono-tech text-cyan-300 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Chạy lại Intro Mở đầu</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onReplayIntro}
            title="Chạy lại hiệu ứng Intro"
            className="w-full flex items-center justify-center p-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/25 text-cyan-300 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 z-20">{sidebarContent}</aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};

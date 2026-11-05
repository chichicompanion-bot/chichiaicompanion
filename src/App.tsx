import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  Sliders,
  Radio,
  Sun,
  Moon,
  Zap,
  Play,
  Activity,
  HeartPulse,
  History,
  LayoutDashboard,
  Settings,
  ChevronRight,
} from 'lucide-react';
import {
  ChartMetricKey,
  DataMode,
  HealthHistoryRecord,
  MetricCardData,
  MetricKey,
  NavSection,
  SystemNotification,
  TelemetryTimeSeriesPoint,
  TimeRange,
} from './types/health';
import { DemoDataProvider } from './services/demoDataProvider';
import { LiveHealthDataService } from './services/healthDataService';
import { AmbientBackground } from './components/AmbientBackground';
import { CinematicIntro } from './components/CinematicIntro';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { MetricCard } from './components/MetricCard';
import { LiveAnalyticsChart } from './components/LiveAnalyticsChart';
import { ActivityRings } from './components/ActivityRings';
import { SleepAnalytics } from './components/SleepAnalytics';
import { HealthHistory } from './components/HealthHistory';
import { DeviceStatusPanel } from './components/DeviceStatusPanel';
import { HealthMapPanel } from './components/HealthMapPanel';
import { MetricDetailModal } from './components/MetricDetailModal';
import { BiomedicalHeartCommandCenter } from './components/BiomedicalHeartCommandCenter';
import { DeviceGpsTelemetryCard } from './components/DeviceGpsTelemetryCard';

export const App: React.FC = () => {
  const demoProviderRef = useRef(new DemoDataProvider());
  const liveServiceRef = useRef(new LiveHealthDataService());

  // Respect OS prefers-reduced-motion, with manual override in Settings
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Cinematic Intro: runs once per session (or when replayed)
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const seen = sessionStorage.getItem('nexus_intro_seen');
    return !seen;
  });

  const handleCompleteIntro = useCallback(() => {
    sessionStorage.setItem('nexus_intro_seen', '1');
    setShowIntro(false);
  }, []);

  const handleReplayIntro = useCallback(() => {
    setShowIntro(true);
  }, []);

  // Bulletproof safety: ensure dashboard ALWAYS unlocks after max 3.2s
  useEffect(() => {
    if (!showIntro) return;
    const safeTimer = setTimeout(() => {
      handleCompleteIntro();
    }, 3200);
    return () => clearTimeout(safeTimer);
  }, [showIntro, handleCompleteIntro]);

  const [isLightMode, setIsLightMode] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [dataMode, setDataMode] = useState<DataMode>('demo');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [selectedChartMetric, setSelectedChartMetric] = useState<ChartMetricKey>('heartRate');
  const [modalMetricKey, setModalMetricKey] = useState<MetricKey | null>(null);
  const [waveTick, setWaveTick] = useState(0);
  const [isLoadingLive, setIsLoadingLive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial state from DemoDataProvider
  const initialTick = useMemo(() => demoProviderRef.current.tickSimulation(), []);
  const [metrics, setMetrics] = useState<MetricCardData[]>(initialTick.metrics);
  const [deviceStatus, setDeviceStatus] = useState(initialTick.device);
  const [series, setSeries] = useState<TelemetryTimeSeriesPoint[]>(() =>
    demoProviderRef.current.getTimeSeries('1h')
  );
  const [historyRecords, setHistoryRecords] = useState<HealthHistoryRecord[]>(() =>
    demoProviderRef.current.getHistoryRecords(48)
  );
  const [notifications, setNotifications] = useState<SystemNotification[]>(() =>
    demoProviderRef.current.getInitialNotifications()
  );

  // Sync Dark/Light Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isLightMode) {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [isLightMode]);

  // Poll Live ESP32 endpoint when in Live mode
  const refreshLiveTelemetry = useCallback(async () => {
    setIsLoadingLive(true);
    try {
      const res = await liveServiceRef.current.fetchLiveTelemetry();
      setDeviceStatus(res.device);
      setMetrics(res.metrics);
      setSeries(res.series);
      setHistoryRecords(res.history);
    } finally {
      setIsLoadingLive(false);
    }
  }, []);

  // Update Demo data or Live data based on mode
  useEffect(() => {
    if (dataMode === 'demo') {
      const initialSeries = demoProviderRef.current.getTimeSeries(timeRange);
      setSeries(initialSeries);
      setHistoryRecords(demoProviderRef.current.getHistoryRecords(48));
      const snap = demoProviderRef.current.tickSimulation();
      setMetrics(snap.metrics);
      setDeviceStatus(snap.device);

      const interval = setInterval(() => {
        const next = demoProviderRef.current.tickSimulation();
        setMetrics(next.metrics);
        setDeviceStatus(next.device);
        setWaveTick((t) => (t + 2) % 64);
        setSeries((prev) => [...prev.slice(1), next.latestPoint]);
      }, 2400);

      return () => clearInterval(interval);
    } else {
      refreshLiveTelemetry();
      const liveInterval = setInterval(() => {
        refreshLiveTelemetry();
        setWaveTick((t) => (t + 2) % 64);
      }, 4000);
      return () => clearInterval(liveInterval);
    }
  }, [dataMode, timeRange, refreshLiveTelemetry]);

  const handleSendTestPacket = useCallback(async () => {
    const ok = await liveServiceRef.current.sendTestHardwarePacket();
    if (ok) {
      setNotifications((prev) => [
        {
          id: `pkt-${Date.now()}`,
          title: 'Đã nhận gói JSON từ cổng /api/telemetry',
          message: 'Gói dữ liệu ESP32 + MAX30102 đã được xác thực hợp lệ.',
          timestamp: new Date().toLocaleTimeString('vi-VN'),
          type: 'telemetry',
          read: false,
        },
        ...prev,
      ]);
      if (dataMode === 'live') {
        await refreshLiveTelemetry();
      }
    }
  }, [dataMode, refreshLiveTelemetry]);

  const handleSelectCardMetric = (key: MetricKey) => {
    setModalMetricKey(key);
    if (key === 'heartRate' || key === 'spo2' || key === 'hrv') {
      setSelectedChartMetric(key);
    }
  };

  const ppgWaveform = useMemo(
    () => demoProviderRef.current.getOpticalPPGWaveform(64, waveTick),
    [waveTick]
  );
  const activityRings = useMemo(() => demoProviderRef.current.getActivityRings(), [metrics]);
  const sleepSummary = useMemo(() => demoProviderRef.current.getSleepSummary(), []);

  return (
    <div className="min-h-screen relative flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Cinematic Intro Overlay */}
      <CinematicIntro
        visible={showIntro}
        onComplete={handleCompleteIntro}
        reducedMotion={reducedMotion}
      />

      {/* Ambient Futuristic Background */}
      <AmbientBackground reducedMotion={reducedMotion} isLightMode={isLightMode} />

      {/* Main Dashboard Layout */}
      <div className="relative z-10 flex flex-1 min-h-screen">
        <Sidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          dataMode={dataMode}
          isLiveConnected={deviceStatus.connectionState === 'connected' && !deviceStatus.isSimulated}
          onReplayIntro={handleReplayIntro}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopNav
            activeSection={activeSection}
            dataMode={dataMode}
            onChangeDataMode={setDataMode}
            deviceStatus={deviceStatus}
            timeRange={timeRange}
            onChangeTimeRange={setTimeRange}
            notifications={notifications}
            onMarkAllRead={() =>
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
            }
            isLightMode={isLightMode}
            onToggleTheme={() => setIsLightMode((m) => !m)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onOpenSettings={() => setActiveSection('settings')}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onTriggerReconnect={
              dataMode === 'live'
                ? refreshLiveTelemetry
                : async () => {
                    const snap = demoProviderRef.current.tickSimulation();
                    setMetrics(snap.metrics);
                    setDeviceStatus(snap.device);
                  }
            }
          />

          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] w-full mx-auto pb-28 lg:pb-8">
            {/* Minimalist Status Bar (Decluttered, compact & clean) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 rounded-2xl nexus-glass border border-slate-200/90 dark:border-slate-800/80">
              <div className="flex items-center gap-2.5 text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold ${
                  dataMode === 'demo'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/40'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-400/40'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${dataMode === 'demo' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  {dataMode === 'demo' ? 'DEMO SIMULATION' : 'LIVE ESP32 CONNECTED'}
                </span>
                <span className="text-slate-500 dark:text-slate-400 hidden sm:inline text-[11px] font-mono-tech">
                  ESP32-S3 • MAX30102 Telemetry OS
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
                  className="px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-400/30 text-[11px] font-mono-tech transition cursor-pointer active:scale-95"
                >
                  Chuyển sang {dataMode === 'demo' ? 'LIVE ESP32' : 'DEMO MODE'}
                </button>
              </div>
            </div>

            {/* SEPARATED PAGES WITH SMOOTH ANIMATION */}
            <AnimatePresence mode="wait">
              {/* 1. VIEW: TỔNG QUAN (OVERVIEW) */}
              {activeSection === 'overview' && (
                <motion.div
                  key="page-overview"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  {/* Hero Shortcut Card to 3D Body */}
                  <div
                    onClick={() => setActiveSection('heart')}
                    className="group relative overflow-hidden rounded-2xl md:rounded-3xl p-4 sm:p-5 nexus-glass border border-slate-200/90 dark:border-cyan-500/30 shadow-sm hover:shadow-md transition-all cursor-pointer bg-gradient-to-r from-sky-50 via-white to-rose-50/60 dark:from-slate-900 dark:via-slate-900/90 dark:to-rose-950/20"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30 shrink-0 group-hover:scale-105 transition-transform">
                          <HeartPulse className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono-tech font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                              3D INTERACTIVE HERO
                            </span>
                            <span className="text-xs text-slate-400 hidden sm:inline">• Mô hình giải phẫu</span>
                          </div>
                          <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white truncate mt-0.5">
                            Khám phá Mô Hình Cơ Thể 3D &amp; Cận Cảnh Trái Tim
                          </h2>
                          <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                            Chạm xoay 360°, soi nội tạng, não bộ &amp; phóng to nhịp đập 4 biểu đồ HUD.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-cyan-500/20 text-white dark:text-cyan-200 text-xs font-semibold shadow-sm group-hover:bg-cyan-600 transition"
                      >
                        <span>Mở Mô Hình 3D</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 7 Health Metric Cards Grid */}
                  <section aria-label="Các chỉ số sức khỏe">
                    {searchQuery && (
                      <div className="mb-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Kết quả tìm kiếm: &ldquo;<strong className="text-cyan-500">{searchQuery}</strong>&rdquo;</span>
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          Xóa tìm kiếm
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {metrics
                        .filter((m) => {
                          if (!searchQuery.trim()) return true;
                          const q = searchQuery.toLowerCase().trim();
                          return (
                            m.title.toLowerCase().includes(q) ||
                            m.vietnameseTitle.toLowerCase().includes(q) ||
                            m.key.toLowerCase().includes(q) ||
                            m.unit.toLowerCase().includes(q)
                          );
                        })
                        .map((m, idx) => (
                          <MetricCard
                            key={m.key}
                            metric={m}
                            index={idx}
                            reducedMotion={reducedMotion}
                            isSelected={selectedChartMetric === m.key}
                            onSelect={handleSelectCardMetric}
                          />
                        ))}
                    </div>
                  </section>

                  {/* Activity Rings & Sleep Summary */}
                  <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <ActivityRings
                      rings={activityRings}
                      dataMode={dataMode}
                      reducedMotion={reducedMotion}
                    />
                    <SleepAnalytics sleep={sleepSummary} />
                  </section>

                  {/* Device GPS Telemetry & Online Map (Auto updates every 5 mins) */}
                  <DeviceGpsTelemetryCard />
                </motion.div>
              )}

              {/* 2. VIEW: CƠ THỂ 3D (HEART & FULL BODY) - DEDICATED INDEPENDENT PAGE */}
              {activeSection === 'heart' && (
                <motion.div
                  key="page-body3d"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  <BiomedicalHeartCommandCenter
                    metrics={metrics}
                    series={series}
                    deviceStatus={deviceStatus}
                    dataMode={dataMode}
                    ppgWave={ppgWaveform}
                    reducedMotion={reducedMotion}
                    isLightMode={isLightMode}
                    onSelectMetricModal={handleSelectCardMetric}
                    onSwitchDataMode={setDataMode}
                  />

                  {/* Compact Quick Readout Strip below 3D Stage */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {metrics.slice(0, 4).map((m, idx) => (
                      <MetricCard
                        key={m.key}
                        metric={m}
                        index={idx}
                        reducedMotion={reducedMotion}
                        isSelected={selectedChartMetric === m.key}
                        onSelect={handleSelectCardMetric}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 3. VIEW: SÓNG LIVE & TELEMETRY */}
              {activeSection === 'live' && (
                <motion.div
                  key="page-live"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  <LiveAnalyticsChart
                    series={series}
                    ppgWave={ppgWaveform}
                    selectedMetric={selectedChartMetric}
                    onSelectMetric={setSelectedChartMetric}
                    timeRange={timeRange}
                    onChangeTimeRange={setTimeRange}
                    dataMode={dataMode}
                    isConnected={deviceStatus.connectionState === 'connected'}
                    isLoading={isLoadingLive}
                    onSendTestPacket={handleSendTestPacket}
                  />
                  <DeviceStatusPanel
                    device={deviceStatus}
                    dataMode={dataMode}
                    onReconnect={refreshLiveTelemetry}
                    onSendTestPacket={handleSendTestPacket}
                  />
                </motion.div>
              )}

              {/* 4. VIEW: VẬN ĐỘNG & GIẤC NGỦ */}
              {activeSection === 'activity' && (
                <motion.div
                  key="page-activity"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {metrics
                      .filter((m) => m.key === 'steps' || m.key === 'sleep' || m.key === 'stress')
                      .map((m, idx) => (
                        <MetricCard
                          key={m.key}
                          metric={m}
                          index={idx}
                          reducedMotion={reducedMotion}
                          isSelected={modalMetricKey === m.key}
                          onSelect={handleSelectCardMetric}
                        />
                      ))}
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <ActivityRings
                      rings={activityRings}
                      dataMode={dataMode}
                      reducedMotion={reducedMotion}
                    />
                    <SleepAnalytics sleep={sleepSummary} />
                  </div>
                </motion.div>
              )}

              {/* 5. VIEW: LỊCH SỬ ĐO */}
              {activeSection === 'history' && (
                <motion.div
                  key="page-history"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <HealthHistory records={historyRecords} dataMode={dataMode} />
                </motion.div>
              )}

              {/* 6. VIEW: THIẾT BỊ ESP32 */}
              {activeSection === 'device' && (
                <motion.div
                  key="page-device"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-6"
                >
                  <DeviceStatusPanel
                    device={deviceStatus}
                    dataMode={dataMode}
                    onReconnect={refreshLiveTelemetry}
                    onSendTestPacket={handleSendTestPacket}
                  />
                  <HealthMapPanel />
                </motion.div>
              )}

              {/* 7. VIEW: CÀI ĐẶT */}
              {activeSection === 'settings' && (
                <motion.div
                  key="page-settings"
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="rounded-2xl nexus-glass p-6 space-y-6 max-w-3xl border border-slate-200/90 dark:border-slate-800"
                >
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                    <Sliders className="w-5 h-5 text-cyan-500" />
                    <div>
                      <h2 className="font-display font-bold text-lg text-slate-900 dark:text-white">
                        Cấu hình Hệ thống &amp; Trải nghiệm
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Quản lý chế độ dữ liệu, giao diện Sáng/Tối và hiệu ứng chuyển động
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Data Mode Setting */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                          <Radio className="w-4 h-4 text-cyan-500" />
                          <span>Chế độ nguồn dữ liệu (Data Mode)</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Chuyển giữa giả lập mô phỏng và nhận gói tin thật từ mạch ESP32.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
                        className="px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono-tech text-cyan-700 dark:text-cyan-300 cursor-pointer"
                      >
                        Đang bật: {dataMode.toUpperCase()} MODE
                      </button>
                    </div>

                    {/* Theme Setting */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                          {isLightMode ? (
                            <Sun className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Moon className="w-4 h-4 text-cyan-400" />
                          )}
                          <span>Giao diện Sáng / Tối (Theme Mode)</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Giao diện Sáng Bạc dịu mắt (Light Silver) hoặc Giao diện Tối Obsidian (Dark Mode).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsLightMode((m) => !m)}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono-tech text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
                      >
                        {isLightMode ? 'Đang dùng: Giao diện Sáng Dịu Mắt' : 'Đang dùng: Giao diện Tối'}
                      </button>
                    </div>

                    {/* Reduced Motion Setting */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                          <Zap className="w-4 h-4 text-emerald-500" />
                          <span>Giảm chuyển động (Reduced Motion)</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Tắt hoạt ảnh để tối ưu pin và tăng tốc độ xử lý tối đa.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReducedMotion((r) => !r)}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono-tech text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs"
                      >
                        {reducedMotion ? 'Đang BẬT giảm chuyển động' : 'Hiệu ứng đầy đủ (Mượt 60-120 FPS)'}
                      </button>
                    </div>

                    {/* Replay Cinematic Intro */}
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2 text-slate-900 dark:text-white">
                          <Sparkles className="w-4 h-4 text-cyan-500" />
                          <span>Cinematic Intro Mở Đầu</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Phát lại hiệu ứng animation khởi động hệ thống SMARTWATCH HEALTH.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleReplayIntro}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono-tech text-cyan-700 dark:text-cyan-300 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Phát lại Intro ngay</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Clean Footer */}
          <footer className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800/60 text-[11px] font-mono-tech text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              SMARTWATCH HEALTH • HỆ THỐNG GIÁM SÁT SINH HỌC VÒNG TAY ESP32
            </span>
            <span>
              {dataMode.toUpperCase()} MODE • API /api/telemetry
            </span>
          </footer>
        </div>
      </div>

      {/* Mobile Floating Pill Dock Navigation Bar (5 Items with 3D Body Centered) */}
      <nav
        aria-label="Điều hướng nhanh điện thoại"
        className="lg:hidden fixed bottom-3 left-3 right-3 max-w-md mx-auto z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-full p-1.5 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.18)] border border-slate-200/90 dark:border-slate-800/90 flex items-center justify-between text-[10px] font-mono-tech transition-all"
      >
        {/* 1. Tổng quan */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('overview');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all cursor-pointer ${
            activeSection === 'overview'
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-400/35 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 font-medium">Tổng quan</span>
        </button>

        {/* 2. Sóng Live */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('live');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all cursor-pointer ${
            activeSection === 'live'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-400/35 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 font-medium">Sóng Live</span>
        </button>

        {/* 3. Cơ thể 3D (CENTERPIECE CAPSULE) */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('heart');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-3.5 rounded-full transition-all cursor-pointer transform active:scale-95 ${
            activeSection === 'heart'
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold shadow-md shadow-rose-500/30'
              : 'bg-slate-100 dark:bg-slate-800/90 text-rose-600 dark:text-rose-400 font-semibold border border-rose-300/40'
          }`}
        >
          <HeartPulse className="w-4 h-4 animate-pulse" />
          <span className="text-[9px] mt-0.5 font-medium">Cơ thể 3D</span>
        </button>

        {/* 4. Lịch sử */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('history');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all cursor-pointer ${
            activeSection === 'history'
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-400/35 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <History className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 font-medium">Lịch sử</span>
        </button>

        {/* 5. Cài đặt */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('settings');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-full transition-all cursor-pointer ${
            activeSection === 'settings'
              ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-400/35 shadow-xs'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span className="text-[9px] mt-0.5 font-medium">Cài đặt</span>
        </button>
      </nav>

      {/* Centered Mini-Diagram Popup Modal when clicking any of the 7 Metric Cards */}
      <MetricDetailModal
        metric={metrics.find((m) => m.key === modalMetricKey) || null}
        series={series}
        timeRange={timeRange}
        onChangeTimeRange={setTimeRange}
        onClose={() => setModalMetricKey(null)}
        isLightMode={isLightMode}
      />
    </div>
  );
};

export default App;

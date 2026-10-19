import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  Sliders,
  Radio,
  Sun,
  Moon,
  Zap,
  Play,
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

export const App: React.FC = () => {
  const demoProviderRef = useRef(new DemoDataProvider());
  const liveServiceRef = useRef(new LiveHealthDataService());

  // Respect OS prefers-reduced-motion, with manual override in Settings
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Cinematic Intro runs once per session (or when replayed)
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const seen = sessionStorage.getItem('nexus_intro_seen');
    return !seen;
  });

  const [isLightMode, setIsLightMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [dataMode, setDataMode] = useState<DataMode>('demo');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [selectedChartMetric, setSelectedChartMetric] = useState<ChartMetricKey>('heartRate');
  const [waveTick, setWaveTick] = useState(0);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

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

  const handleCompleteIntro = useCallback(() => {
    sessionStorage.setItem('nexus_intro_seen', '1');
    setShowIntro(false);
  }, []);

  const handleReplayIntro = useCallback(() => {
    setShowIntro(true);
  }, []);

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

          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
            {/* Scientific Integrity & Hardware Mode Notice Bar */}
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl nexus-glass px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-cyan-400"
            >
              <div className="flex items-center gap-2.5 text-xs text-slate-300">
                <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  {dataMode === 'demo' ? (
                    <>
                      Đang chạy ở chế độ <strong>DEMO SIMULATION</strong> (dữ liệu mô phỏng có giới hạn hợp lý để kiểm thử giao diện, không phải dữ liệu đo từ bệnh nhân thật).
                    </>
                  ) : (
                    <>
                      Đang chạy ở chế độ <strong>LIVE ESP32 MODE</strong> — chỉ hiển thị trạng thái Connected khi nhận gói tin hợp lệ từ mạch ESP32 + MAX30102 qua{' '}
                      <code className="font-mono-tech text-cyan-300">/api/telemetry</code>.
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
                  className="px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-[11px] font-mono-tech text-cyan-200 transition-all cursor-pointer"
                >
                  Chuyển sang {dataMode === 'demo' ? 'LIVE ESP32 MODE' : 'DEMO MODE'}
                </button>
              </div>
            </motion.div>

            {/* VIEW: OVERVIEW (Shows all modules in a cohesive executive layout) */}
            {activeSection === 'overview' && (
              <>
                {/* 7 Health Metric Cards Grid */}
                <section aria-label="Các chỉ số sức khỏe">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {metrics.map((m, idx) => (
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

                {/* Live Health Analytics Chart + PPG Waveform */}
                <section aria-label="Biểu đồ phân tích thời gian thực">
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
                </section>

                {/* Activity Rings & Sleep Analytics Side-by-Side */}
                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ActivityRings
                    rings={activityRings}
                    dataMode={dataMode}
                    reducedMotion={reducedMotion}
                  />
                  <SleepAnalytics sleep={sleepSummary} />
                </section>

                {/* Device Status & Optional GPS Map */}
                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <DeviceStatusPanel
                    device={deviceStatus}
                    dataMode={dataMode}
                    onReconnect={refreshLiveTelemetry}
                    onSendTestPacket={handleSendTestPacket}
                  />
                  <HealthMapPanel />
                </section>

                {/* Health History Table */}
                <section>
                  <HealthHistory records={historyRecords} dataMode={dataMode} />
                </section>
              </>
            )}

            {/* VIEW: LIVE MONITORING */}
            {activeSection === 'live' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              </>
            )}

            {/* VIEW: HEART ANALYTICS */}
            {activeSection === 'heart' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {metrics
                    .filter((m) => m.key === 'heartRate' || m.key === 'spo2' || m.key === 'hrv')
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
              </>
            )}

            {/* VIEW: ACTIVITY & SLEEP */}
            {activeSection === 'activity' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {metrics
                    .filter((m) => m.key === 'steps' || m.key === 'sleep' || m.key === 'stress')
                    .map((m, idx) => (
                      <MetricCard
                        key={m.key}
                        metric={m}
                        index={idx}
                        reducedMotion={reducedMotion}
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
              </>
            )}

            {/* VIEW: HEALTH HISTORY */}
            {activeSection === 'history' && (
              <HealthHistory records={historyRecords} dataMode={dataMode} />
            )}

            {/* VIEW: DEVICE MANAGEMENT */}
            {activeSection === 'device' && (
              <div className="space-y-6">
                <DeviceStatusPanel
                  device={deviceStatus}
                  dataMode={dataMode}
                  onReconnect={refreshLiveTelemetry}
                  onSendTestPacket={handleSendTestPacket}
                />
                <HealthMapPanel />
              </div>
            )}

            {/* VIEW: SETTINGS */}
            {activeSection === 'settings' && (
              <div className="rounded-2xl nexus-glass p-6 space-y-6 max-w-3xl">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h2 className="font-display font-bold text-lg">
                      Cấu hình Hệ thống & Trải nghiệm Giao diện
                    </h2>
                    <p className="text-xs text-slate-400">
                      Quản lý chế độ dữ liệu (Demo/Live), hiệu ứng chuyển động và giao diện Sáng/Tối
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Data Mode Setting */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <Radio className="w-4 h-4 text-cyan-400" />
                        <span>Chế độ nguồn dữ liệu (Data Source Mode)</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Chuyển giữa dữ liệu giả lập (Demo Mode) và nhận gói tin thực từ mạch ESP32 (Live Mode).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDataMode(dataMode === 'demo' ? 'live' : 'demo')}
                      className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-xs font-mono-tech text-cyan-200 cursor-pointer"
                    >
                      Đang bật: {dataMode.toUpperCase()} MODE
                    </button>
                  </div>

                  {/* Theme Setting */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {isLightMode ? (
                          <Sun className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Moon className="w-4 h-4 text-cyan-400" />
                        )}
                        <span>Chế độ Giao diện (Dark / Light Theme)</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Mặc định sử dụng nền tối Obsidian Navy chuẩn thiết bị y tế tương lai.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLightMode((m) => !m)}
                      className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono-tech text-slate-200 cursor-pointer"
                    >
                      {isLightMode ? 'Đang dùng: LIGHT MODE' : 'Đang dùng: DARK MODE'}
                    </button>
                  </div>

                  {/* Reduced Motion Setting */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span>Giảm chuyển động (Reduced Motion)</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Tắt hiệu ứng nghiêng 3D parallax và hạt sáng nền để tối ưu pin & hiệu năng.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReducedMotion((r) => !r)}
                      className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-mono-tech text-slate-200 cursor-pointer"
                    >
                      {reducedMotion ? 'Đang BẬT giảm chuyển động' : 'Hiệu ứng đầy đủ (Mặc định)'}
                    </button>
                  </div>

                  {/* Replay Cinematic Intro */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span>Cinematic Intro Animation</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Xem lại hiệu ứng khởi động hệ thống NEXUS HEALTH (2.5 giây).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleReplayIntro}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-xs font-mono-tech text-cyan-200 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Phát lại Intro ngay</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="px-6 py-4 border-t border-slate-800/60 text-[11px] font-mono-tech text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              NEXUS HEALTH BIOMEDICAL DASHBOARD • DỰ ÁN KHOA HỌC KỸ THUẬT VÒNG TAY THÔNG MINH ESP32 + MAX30102
            </span>
            <span>
              CHẾ ĐỘ HIỆN TẠI: {dataMode.toUpperCase()} • CỔNG API: /api/telemetry
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default App;

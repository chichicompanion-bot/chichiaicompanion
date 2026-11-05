import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin,
  Navigation,
  RefreshCw,
  Compass,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Laptop,
  Radio,
  Clock,
} from 'lucide-react';

interface GpsLocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  city: string;
  region: string;
  country: string;
  formattedAddress: string;
  source: 'gps' | 'network' | 'cache';
  timestamp: number;
  deviceType: 'mobile' | 'desktop';
}

const GPS_CACHE_KEY = 'smartwatch_gps_telemetry_cache';
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes as requested

export const DeviceGpsTelemetryCard: React.FC = () => {
  const [location, setLocation] = useState<GpsLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState('Đang định vị...');
  const [nextUpdateSeconds, setNextUpdateSeconds] = useState(300);
  const timerRef = useRef<number | null>(null);

  const isMobileDevice = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );

  // Reverse geocode lat/lng to readable Vietnamese address
  const fetchAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        { headers: { 'Accept-Language': 'vi,en;q=0.8' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          // Keep first 3 components for clean readable address
          const parts = data.display_name.split(',').map((s: string) => s.trim());
          return parts.slice(0, 4).join(', ');
        }
      }
    } catch {}
    return `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
  };

  // IP-based Network Fallback (works on desktop PC without GPS hardware)
  const fetchIpLocation = async (): Promise<GpsLocationData | null> => {
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && typeof d.latitude === 'number') {
          return {
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 1200,
            city: d.city || 'Khu vực người dùng',
            region: d.region || '',
            country: d.country || 'Việt Nam',
            formattedAddress: `${d.city || ''}, ${d.region || ''}, ${d.country || 'Việt Nam'}`.replace(/^,\s*/, ''),
            source: 'network',
            timestamp: Date.now(),
            deviceType: isMobileDevice ? 'mobile' : 'desktop',
          };
        }
      }
    } catch {}

    try {
      const res = await fetch('https://freeipapi.com/api/json');
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.latitude === 'number') {
          return {
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 1500,
            city: d.cityName || 'Khu vực người dùng',
            region: d.regionName || '',
            country: d.countryName || 'Việt Nam',
            formattedAddress: `${d.cityName || ''}, ${d.regionName || ''}, ${d.countryName || 'Việt Nam'}`.replace(/^,\s*/, ''),
            source: 'network',
            timestamp: Date.now(),
            deviceType: isMobileDevice ? 'mobile' : 'desktop',
          };
        }
      }
    } catch {}

    return null;
  };

  // Core Location Resolver: High-Precision GPS with Automatic IP Network Fallback
  const resolveLocation = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setErrorMsg(null);

    const finish = (loc: GpsLocationData) => {
      setLocation(loc);
      try {
        localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(loc));
      } catch {}
      setLoading(false);
      setRefreshing(false);
      setNextUpdateSeconds(300);
    };

    // Try HTML5 Geolocation API first (highest accuracy)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const acc = Math.round(position.coords.accuracy || 15);
          const address = await fetchAddress(lat, lng);

          finish({
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            city: address.split(',')[0] || 'Vị trí hiện tại',
            region: '',
            country: 'Việt Nam',
            formattedAddress: address,
            source: 'gps',
            timestamp: Date.now(),
            deviceType: isMobileDevice ? 'mobile' : 'desktop',
          });
        },
        async (err) => {
          console.warn('HTML5 Geolocation unavailable or denied, falling back to IP network location:', err.message);
          const ipLoc = await fetchIpLocation();
          if (ipLoc) {
            finish(ipLoc);
          } else {
            setErrorMsg('Chưa thể lấy vị trí. Vui lòng cấp quyền định vị hoặc kết nối internet.');
            setLoading(false);
            setRefreshing(false);
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      const ipLoc = await fetchIpLocation();
      if (ipLoc) finish(ipLoc);
      else {
        setErrorMsg('Trình duyệt không hỗ trợ định vị.');
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isMobileDevice]);

  // Initial mount: load cached position immediately, then refresh if older than 5 minutes
  useEffect(() => {
    try {
      const cachedStr = localStorage.getItem(GPS_CACHE_KEY);
      if (cachedStr) {
        const cached: GpsLocationData = JSON.parse(cachedStr);
        if (Date.now() - cached.timestamp < AUTO_REFRESH_INTERVAL_MS) {
          setLocation(cached);
          setLoading(false);
        }
      }
    } catch {}

    resolveLocation();

    // 5-minute auto update schedule
    const interval = setInterval(() => {
      resolveLocation();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [resolveLocation]);

  // Countdown timer & humanized time update
  useEffect(() => {
    const secTimer = setInterval(() => {
      setNextUpdateSeconds((prev) => (prev > 1 ? prev - 1 : 300));
      if (location) {
        const elapsedSec = Math.floor((Date.now() - location.timestamp) / 1000);
        if (elapsedSec < 30) {
          setLastUpdatedText('Vừa cập nhật xong');
        } else if (elapsedSec < 60) {
          setLastUpdatedText(`${elapsedSec} giây trước`);
        } else {
          const mins = Math.floor(elapsedSec / 60);
          setLastUpdatedText(`${mins} phút trước`);
        }
      }
    }, 1000);

    return () => clearInterval(secTimer);
  }, [location]);

  const mapLat = location?.latitude ?? 21.0285;
  const mapLng = location?.longitude ?? 105.8542;
  const bboxDelta = 0.007; // Zoom level fitting a local neighborhood / house
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - bboxDelta}%2C${mapLat - bboxDelta}%2C${mapLng + bboxDelta}%2C${mapLat + bboxDelta}&layer=mapnik&marker=${mapLat}%2C${mapLng}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${mapLat},${mapLng}`;

  return (
    <section
      aria-label="Định vị GPS Thiết Bị Người Dùng"
      className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200/90 dark:border-cyan-500/25 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm transition-all p-4 sm:p-5"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Navigation className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-tech font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                GPS TELEMETRY
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">• Định vị máy thiết bị</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white mt-0.5">
              Vị Trí Thiết Bị &amp; Bản Đồ Trực Tuyến
            </h2>
          </div>
        </div>

        {/* Right Action: Manual Refresh + 5-min Countdown */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-mono-tech text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            <span>Tự làm mới sau: <strong>{Math.floor(nextUpdateSeconds / 60)}:{(nextUpdateSeconds % 60).toString().padStart(2, '0')}</strong></span>
          </div>

          <button
            type="button"
            onClick={() => resolveLocation(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Làm mới vị trí ngay lập tức"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Cập nhật vị trí</span>
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-semibold border border-cyan-400/40 transition"
            title="Mở Google Maps toàn màn hình"
          >
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Grid: Map + Telemetry Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Map View (7 cols) */}
        <div className="lg:col-span-7 relative h-[260px] sm:h-[300px] md:h-[340px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700/80 shadow-inner bg-slate-100 dark:bg-slate-950">
          {loading && !location ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-xs z-20">
              <RefreshCw className="w-6 h-6 text-cyan-500 animate-spin" />
              <span className="text-xs font-mono-tech text-slate-600 dark:text-slate-300">
                Đang quét vệ tinh &amp; định vị thiết bị...
              </span>
            </div>
          ) : (
            <iframe
              title="Bản đồ OpenStreetMap định vị thiết bị"
              src={osmEmbedUrl}
              className="w-full h-full border-0 filter contrast-[1.02]"
              loading="lazy"
            />
          )}

          {/* Radar Target Overlay with Pulse */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-16 h-16 rounded-full bg-emerald-500/25 animate-ping" />
              <span className="absolute w-10 h-10 rounded-full border border-emerald-400/60 animate-pulse" />
              <div className="relative w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg shadow-emerald-500/60" />
            </div>
          </div>

          {/* Floating Pill on Map */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-[11px] font-mono-tech font-medium text-slate-700 dark:text-slate-200 shadow-md backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Tự động cập nhật 5 phút / lần</span>
          </div>

          <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-[10px] font-mono-tech text-slate-500 dark:text-slate-400 shadow-md">
            <span>© OpenStreetMap Contributors</span>
          </div>
        </div>

        {/* Right Telemetry Details (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          {/* Card 1: Detected Address */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
            <div className="flex items-center gap-1.5 text-xs font-mono-tech text-slate-500 dark:text-slate-400 mb-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>ĐỊA CHỈ PHÁT HIỆN</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
              {location?.formattedAddress || 'Đang cập nhật địa chỉ...'}
            </div>
          </div>

          {/* Card 2: Coordinates & Accuracy */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">TỌA ĐỘ GPS</div>
              <div className="text-xs font-mono-tech font-bold text-slate-900 dark:text-cyan-200 mt-1">
                {location ? `${location.latitude.toFixed(5)}°` : '—'}
              </div>
              <div className="text-xs font-mono-tech font-bold text-slate-900 dark:text-cyan-200">
                {location ? `${location.longitude.toFixed(5)}°` : '—'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70">
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">BÁN KÍNH SAI SỐ</div>
              <div className="text-sm font-mono-tech font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {location ? `±${location.accuracy}m` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {location?.source === 'gps' ? 'Độ chính xác cao' : 'Ước tính mạng Wi-Fi'}
              </div>
            </div>
          </div>

          {/* Card 3: Device Info & Sync Status */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {isMobileDevice ? <Smartphone className="w-3.5 h-3.5 text-cyan-500" /> : <Laptop className="w-3.5 h-3.5 text-cyan-500" />}
                <span>Thiết bị đang mở:</span>
              </span>
              <strong className="text-slate-800 dark:text-white font-mono-tech text-[11px]">
                {isMobileDevice ? 'Điện thoại di động (Mobile)' : 'Máy tính để bàn / Laptop'}
              </strong>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <Radio className="w-3.5 h-3.5 text-emerald-500" />
                <span>Nguồn tín hiệu:</span>
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {location?.source === 'gps' ? 'Vệ tinh GPS phần cứng' : 'Trạm mạng Internet / ISP'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-400 text-[11px]">Cập nhật lần cuối:</span>
              <span className="font-mono-tech text-cyan-600 dark:text-cyan-300 text-[11px]">
                {lastUpdatedText}
              </span>
            </div>
          </div>

          {errorMsg && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

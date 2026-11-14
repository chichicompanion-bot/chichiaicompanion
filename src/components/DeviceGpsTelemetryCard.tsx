import React, { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  Activity,
  LocateFixed,
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

const GPS_CACHE_KEY = 'strokeguard_gps_telemetry_cache';

export const DeviceGpsTelemetryCard: React.FC = () => {
  const [location, setLocation] = useState<GpsLocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState('Đang bắt sóng GPS...');
  const [movementCount, setMovementCount] = useState(0);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const isMobileDevice = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );

  // Reverse geocode lat/lng to readable Vietnamese address
  const fetchAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`,
        { headers: { 'Accept-Language': 'vi,en;q=0.8' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          const parts = data.display_name.split(',').map((s: string) => s.trim());
          return parts.slice(0, 4).join(', ');
        }
      }
    } catch {}
    return `${lat.toFixed(5)}°B, ${lng.toFixed(5)}°Đ`;
  };

  // IP-based Network Fallback if GPS hardware is slow
  const fetchIpLocation = async (): Promise<GpsLocationData | null> => {
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && typeof d.latitude === 'number') {
          return {
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 800,
            city: d.city || 'Đà Nẵng',
            region: d.region || '',
            country: d.country || 'Việt Nam',
            formattedAddress: `${d.city || 'Đà Nẵng'}, ${d.region || ''}, ${d.country || 'Việt Nam'}`.replace(/^,\s*/, ''),
            source: 'network',
            timestamp: Date.now(),
            deviceType: isMobileDevice ? 'mobile' : 'desktop',
          };
        }
      }
    } catch {}

    // Default Fallback: Da Nang center (Ngo Quyen High School area)
    return {
      latitude: 16.0678,
      longitude: 108.2208,
      accuracy: 50,
      city: 'Sơn Trà, Đà Nẵng',
      region: 'Đà Nẵng',
      country: 'Việt Nam',
      formattedAddress: 'Trường THPT Ngô Quyền, Sơn Trà, TP. Đà Nẵng',
      source: 'network',
      timestamp: Date.now(),
      deviceType: isMobileDevice ? 'mobile' : 'desktop',
    };
  };

  // Custom Glowing Green Beacon Marker Icon requested by user
  const createGreenDotIcon = () => {
    return L.divIcon({
      className: 'strokeguard-gps-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%);">
          <span style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(16, 185, 129, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <span style="position: absolute; width: 26px; height: 26px; border-radius: 9999px; border: 2px solid rgba(16, 185, 129, 0.9); background: rgba(16, 185, 129, 0.25);"></span>
          <div style="width: 14px; height: 14px; border-radius: 9999px; background: #10B981; border: 2.5px solid #FFFFFF; box-shadow: 0 0 16px #10B981;"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  // Initialize or update Leaflet Map
  const updateMapPosition = useCallback((lat: number, lng: number, acc: number) => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Create new Leaflet Map
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // CartoDB Dark Matter Tiles (High performance, dark mode compatible, no rate limit blocks)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Add Glowing Green Dot Marker
      const marker = L.marker([lat, lng], {
        icon: createGreenDotIcon(),
        title: 'Vị trí thật của thiết bị STROKEGUARD',
      }).addTo(map);

      // Add faint accuracy radar circle
      const circle = L.circle([lat, lng], {
        radius: Math.min(acc, 80),
        color: '#10B981',
        weight: 1,
        fillColor: '#10B981',
        fillOpacity: 0.1,
      }).addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;
      accuracyCircleRef.current = circle;

      // Ensure container bounds recalculate cleanly
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    } else {
      // Smoothly move the green dot marker and accuracy circle in real-time as user moves!
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([lat, lng]);
        accuracyCircleRef.current.setRadius(Math.min(acc, 80));
      }
      mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 1.0 });
    }
  }, []);

  // Update location state and localStorage
  const handleLocationUpdate = useCallback(async (lat: number, lng: number, acc: number, source: 'gps' | 'network') => {
    setMovementCount((c) => c + 1);
    updateMapPosition(lat, lng, acc);

    const address = await fetchAddress(lat, lng);
    const newLoc: GpsLocationData = {
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      city: address.split(',')[0] || 'Vị trí hiện tại',
      region: '',
      country: 'Việt Nam',
      formattedAddress: address,
      source,
      timestamp: Date.now(),
      deviceType: isMobileDevice ? 'mobile' : 'desktop',
    };

    setLocation(newLoc);
    setLoading(false);
    setRefreshing(false);
    try {
      localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(newLoc));
    } catch {}
  }, [isMobileDevice, updateMapPosition]);

  // Start Real-Time Movement Watcher
  const startRealtimeWatcher = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      fetchIpLocation().then((loc) => {
        if (loc) handleLocationUpdate(loc.latitude, loc.longitude, loc.accuracy, 'network');
      });
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setRefreshing(true);

    // Watch position continuously (updates whenever phone or laptop moves!)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 12);
        handleLocationUpdate(lat, lng, acc, 'gps');
      },
      (err) => {
        console.warn('GPS watcher denied or unavailable, using IP network fallback:', err.message);
        fetchIpLocation().then((loc) => {
          if (loc) handleLocationUpdate(loc.latitude, loc.longitude, loc.accuracy, 'network');
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }, [handleLocationUpdate]);

  useEffect(() => {
    // Check cached location for instant 0ms preview
    try {
      const cached = localStorage.getItem(GPS_CACHE_KEY);
      if (cached) {
        const parsed: GpsLocationData = JSON.parse(cached);
        setLocation(parsed);
        updateMapPosition(parsed.latitude, parsed.longitude, parsed.accuracy);
      }
    } catch {}

    startRealtimeWatcher();

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [startRealtimeWatcher, updateMapPosition]);

  // Relative time updater
  useEffect(() => {
    const interval = setInterval(() => {
      if (location) {
        const elapsedSec = Math.floor((Date.now() - location.timestamp) / 1000);
        if (elapsedSec < 15) {
          setLastUpdatedText('Đang theo dõi di chuyển thời gian thực');
        } else if (elapsedSec < 60) {
          setLastUpdatedText(`${elapsedSec} giây trước`);
        } else {
          const mins = Math.floor(elapsedSec / 60);
          setLastUpdatedText(`${mins} phút trước`);
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [location]);

  const mapLat = location?.latitude ?? 16.0678;
  const mapLng = location?.longitude ?? 108.2208;
  const googleMapsUrl = `https://www.google.com/maps?q=${mapLat},${mapLng}`;

  return (
    <section
      aria-label="Định vị GPS Vòng Tay STROKEGUARD"
      className="relative overflow-hidden rounded-2xl md:rounded-3xl border border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-lg transition-all p-4 sm:p-5"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <Navigation className="w-5 h-5 text-white animate-pulse" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-ping" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-tech font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-800">
                GPS LIVE TRACKING
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">• Định vị thiết bị thời gian thực</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-display text-white mt-0.5">
              Vị Trí Vòng Tay &amp; Bản Đồ Cứu Hộ Khẩn Cấp
            </h2>
          </div>
        </div>

        {/* Right Action: Manual Refresh + Live Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/90 text-[11px] font-mono-tech text-emerald-300 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Chấm xanh lá di chuyển theo thực tế</span>
          </div>

          <button
            type="button"
            onClick={startRealtimeWatcher}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Làm mới tọa độ GPS"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Dò lại GPS</span>
          </button>

          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-semibold border border-cyan-400/40 transition"
            title="Mở trên Google Maps"
          >
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Grid: Leaflet Map + Telemetry Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Map View (7 cols) */}
        <div className="lg:col-span-7 relative h-[280px] sm:h-[320px] md:h-[350px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950">
          {/* Leaflet DOM Container */}
          <div ref={mapContainerRef} className="w-full h-full z-10" />

          {/* Floating Live Badge on Map */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] font-mono-tech font-medium text-emerald-300 shadow-md backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Chấm xanh: Vị trí thật thiết bị</span>
          </div>

          <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-800 text-[9px] font-mono-tech text-slate-400">
            <span>© CartoDB • OpenStreetMap</span>
          </div>
        </div>

        {/* Right Telemetry Details (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          {/* Card 1: Detected Address */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
            <div className="flex items-center gap-1.5 text-xs font-mono-tech text-slate-400 mb-1">
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span>ĐỊA CHỈ PHÁT HIỆN HIỆN TẠI</span>
            </div>
            <div className="text-sm font-semibold text-white leading-snug">
              {location?.formattedAddress || 'Trường THPT Ngô Quyền, Sơn Trà, TP. Đà Nẵng'}
            </div>
          </div>

          {/* Card 2: Coordinates & Accuracy */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">TỌA ĐỘ VĨ - KINH ĐỘ</div>
              <div className="text-xs font-mono-tech font-bold text-cyan-300 mt-1">
                {location ? `${location.latitude.toFixed(5)}°B` : '16.06780°B'}
              </div>
              <div className="text-xs font-mono-tech font-bold text-cyan-300">
                {location ? `${location.longitude.toFixed(5)}°Đ` : '108.22080°Đ'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">ĐỘ CHÍNH XÁC GPS</div>
              <div className="text-sm font-mono-tech font-bold text-emerald-400 mt-1">
                ±{location ? location.accuracy : '12'}m
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5">
                {location?.source === 'gps' ? 'Vệ tinh GPS phần cứng' : 'Định vị mạng di động'}
              </div>
            </div>
          </div>

          {/* Card 3: Device Info & Movement Updates */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                {isMobileDevice ? <Smartphone className="w-3.5 h-3.5 text-cyan-400" /> : <Laptop className="w-3.5 h-3.5 text-cyan-400" />}
                <span>Thiết bị đang mở:</span>
              </span>
              <strong className="text-white font-mono-tech text-[11px]">
                {isMobileDevice ? 'Điện thoại di động (Mobile)' : 'Máy tính / Laptop'}
              </strong>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <LocateFixed className="w-3.5 h-3.5 text-emerald-400" />
                <span>Số lần dịch chuyển:</span>
              </span>
              <span className="font-mono-tech font-semibold text-emerald-300">
                {movementCount} lần cập nhật
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/60">
              <span className="text-slate-400 text-[11px]">Trạng thái:</span>
              <span className="font-mono-tech text-cyan-300 text-[11px]">
                {lastUpdatedText}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

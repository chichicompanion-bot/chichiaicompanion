import React, { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Laptop,
  LocateFixed,
  Plus,
  Minus,
  Crosshair,
  Layers,
} from 'lucide-react';

export interface GpsLocationData {
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

type MapStyleMode = 'street' | 'satellite' | 'osm';

const GPS_CACHE_KEY = 'strokeguard_gps_telemetry_cache';
const LEGACY_GPS_CACHE_KEY = 'smartwatch_gps_telemetry_cache';

const DEFAULT_FALLBACK_LOCATION: GpsLocationData = {
  latitude: 16.0678,
  longitude: 108.2208,
  accuracy: 18,
  city: 'Sơn Trà, Đà Nẵng',
  region: 'Đà Nẵng',
  country: 'Việt Nam',
  formattedAddress: 'Trường THPT Ngô Quyền, Quận Sơn Trà, TP. Đà Nẵng',
  source: 'network',
  timestamp: Date.now(),
  deviceType: 'desktop',
};

const MAP_TILE_CONFIGS: Record<
  MapStyleMode,
  { url: string; fallbackUrl: string; label: string; attribution: string }
> = {
  street: {
    url: 'https://mt1.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
    fallbackUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    label: 'Đường phố',
    attribution: '© Google Maps • OpenStreetMap',
  },
  satellite: {
    url: 'https://mt1.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}',
    fallbackUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    label: 'Vệ tinh',
    attribution: '© Google Satellite • Esri',
  },
  osm: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    fallbackUrl: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    label: 'Bản đồ OSM',
    attribution: '© OpenStreetMap Contributors',
  },
};

export const DeviceGpsTelemetryCard: React.FC = () => {
  const isMobileDevice =
    typeof window !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768);

  const [location, setLocation] = useState<GpsLocationData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached =
          localStorage.getItem(GPS_CACHE_KEY) || localStorage.getItem(LEGACY_GPS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (
            parsed &&
            typeof parsed.latitude === 'number' &&
            typeof parsed.longitude === 'number' &&
            !Number.isNaN(parsed.latitude) &&
            !Number.isNaN(parsed.longitude)
          ) {
            return parsed;
          }
        }
      } catch {}
    }
    return {
      ...DEFAULT_FALLBACK_LOCATION,
      deviceType: isMobileDevice ? 'mobile' : 'desktop',
    };
  });

  const [refreshing, setRefreshing] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyleMode>('street');
  const [lastUpdatedText, setLastUpdatedText] = useState('Đang định vị trực tiếp...');
  const [movementCount, setMovementCount] = useState(1);
  const [gpsStatusNote, setGpsStatusNote] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasHardwareGpsFixRef = useRef<boolean>(false);
  const locationRef = useRef<GpsLocationData>(location);
  locationRef.current = location;

  // Reverse geocode lat/lng to readable Vietnamese address
  const fetchAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { 'Accept-Language': 'vi,en;q=0.8' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
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

  // Multi-provider IP-based Network Fallback if GPS hardware is slow or blocked
  const fetchIpLocation = useCallback(async (): Promise<GpsLocationData> => {
    // Provider 1: ipwho.is
    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          const addr = await fetchAddress(d.latitude, d.longitude);
          return {
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 120,
            city: d.city || 'Đà Nẵng',
            region: d.region || '',
            country: d.country || 'Việt Nam',
            formattedAddress:
              addr !== `${d.latitude.toFixed(5)}°B, ${d.longitude.toFixed(5)}°Đ`
                ? addr
                : `${d.city || 'Đà Nẵng'}, ${d.region || ''}, ${d.country || 'Việt Nam'}`.replace(
                    /^,\s*/,
                    ''
                  ),
            source: 'network',
            timestamp: Date.now(),
            deviceType: isMobileDevice ? 'mobile' : 'desktop',
          };
        }
      }
    } catch {}

    // Provider 2: freeipapi.com
    try {
      const res = await fetch('https://freeipapi.com/api/json');
      if (res.ok) {
        const d = await res.json();
        if (d && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
          const addr = await fetchAddress(d.latitude, d.longitude);
          return {
            latitude: d.latitude,
            longitude: d.longitude,
            accuracy: 150,
            city: d.cityName || 'Đà Nẵng',
            region: d.regionName || '',
            country: d.countryName || 'Việt Nam',
            formattedAddress:
              addr !== `${d.latitude.toFixed(5)}°B, ${d.longitude.toFixed(5)}°Đ`
                ? addr
                : `${d.cityName || 'Đà Nẵng'}, ${d.regionName || ''}, ${d.countryName || 'Việt Nam'}`.replace(
                    /^,\s*/,
                    ''
                  ),
            source: 'network',
            timestamp: Date.now(),
            deviceType: isMobileDevice ? 'mobile' : 'desktop',
          };
        }
      }
    } catch {}

    // Default Fallback: Da Nang center (Ngo Quyen High School area)
    return {
      ...DEFAULT_FALLBACK_LOCATION,
      timestamp: Date.now(),
      deviceType: isMobileDevice ? 'mobile' : 'desktop',
    };
  }, [isMobileDevice]);

  // Custom Glowing Green Beacon Marker Icon
  const createGreenDotIcon = useCallback(() => {
    return L.divIcon({
      className: 'strokeguard-gps-marker',
      html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
          <span style="position: absolute; width: 42px; height: 42px; border-radius: 9999px; background: rgba(16, 185, 129, 0.38); animation: sg-gps-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
          <span style="position: absolute; width: 26px; height: 26px; border-radius: 9999px; border: 2px solid rgba(16, 185, 129, 0.95); background: rgba(16, 185, 129, 0.28);"></span>
          <div style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: #10B981; border: 2.5px solid #FFFFFF; box-shadow: 0 0 14px #10B981, 0 2px 6px rgba(0,0,0,0.45);"></div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }, []);

  // Initialize or update Leaflet Map
  const updateMapPosition = useCallback(
    (lat: number, lng: number, acc: number, addressLabel?: string, panSmooth = true) => {
      const container = mapContainerRef.current;
      if (!container) return;

      const safeLat = Number.isFinite(lat) ? lat : DEFAULT_FALLBACK_LOCATION.latitude;
      const safeLng = Number.isFinite(lng) ? lng : DEFAULT_FALLBACK_LOCATION.longitude;
      const safeAcc = Number.isFinite(acc) && acc > 0 ? acc : 25;

      if (!mapInstanceRef.current) {
        const map = L.map(container, {
          center: [safeLat, safeLng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
        });

        const cfg = MAP_TILE_CONFIGS[mapStyle];
        const layer = L.tileLayer(cfg.url, {
          maxZoom: 20,
          crossOrigin: true,
        });

        // Automatic fallback to secondary tile server if any tile fails to load
        let switchedToFallback = false;
        layer.on('tileerror', () => {
          if (!switchedToFallback && mapInstanceRef.current) {
            switchedToFallback = true;
            layer.setUrl(cfg.fallbackUrl);
          }
        });

        layer.addTo(map);
        tileLayerRef.current = layer;

        // Add faint accuracy radar circle
        const circle = L.circle([safeLat, safeLng], {
          radius: Math.min(Math.max(safeAcc, 18), 90),
          color: '#10B981',
          weight: 1.5,
          fillColor: '#10B981',
          fillOpacity: 0.14,
        }).addTo(map);

        // Add Glowing Green Dot Marker
        const marker = L.marker([safeLat, safeLng], {
          icon: createGreenDotIcon(),
          title: 'Vị trí thiết bị STROKEGUARD - BAND',
        }).addTo(map);

        marker.bindPopup(
          `<div style="font-family: Inter, sans-serif; font-size: 12px; color: #0f172a; line-height: 1.4; min-width: 180px;">
            <strong style="color: #059669; display: block; margin-bottom: 2px;">● STROKEGUARD - BAND</strong>
            <div style="font-weight: 600; margin-bottom: 3px;">${addressLabel || locationRef.current.formattedAddress}</div>
            <div style="font-family: monospace; font-size: 11px; color: #475569;">${safeLat.toFixed(5)}°B, ${safeLng.toFixed(5)}°Đ (±${safeAcc}m)</div>
          </div>`
        );

        mapInstanceRef.current = map;
        markerRef.current = marker;
        accuracyCircleRef.current = circle;

        // Multiple invalidateSize passes so Framer Motion / Intro transitions never clip tiles
        [60, 250, 600, 1500, 3400].forEach((delay) => {
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.invalidateSize();
            }
          }, delay);
        });
      } else {
        if (markerRef.current) {
          markerRef.current.setLatLng([safeLat, safeLng]);
          if (addressLabel) {
            markerRef.current.setPopupContent(
              `<div style="font-family: Inter, sans-serif; font-size: 12px; color: #0f172a; line-height: 1.4; min-width: 180px;">
                <strong style="color: #059669; display: block; margin-bottom: 2px;">● STROKEGUARD - BAND</strong>
                <div style="font-weight: 600; margin-bottom: 3px;">${addressLabel}</div>
                <div style="font-family: monospace; font-size: 11px; color: #475569;">${safeLat.toFixed(5)}°B, ${safeLng.toFixed(5)}°Đ (±${safeAcc}m)</div>
              </div>`
            );
          }
        }
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([safeLat, safeLng]);
          accuracyCircleRef.current.setRadius(Math.min(Math.max(safeAcc, 18), 90));
        }
        mapInstanceRef.current.invalidateSize();
        if (panSmooth) {
          mapInstanceRef.current.panTo([safeLat, safeLng], { animate: true, duration: 0.85 });
        } else {
          mapInstanceRef.current.setView([safeLat, safeLng], mapInstanceRef.current.getZoom());
        }
      }
    },
    [createGreenDotIcon, mapStyle]
  );

  // Switch map tile style on the fly
  const handleSelectMapStyle = (nextStyle: MapStyleMode) => {
    setMapStyle(nextStyle);
    if (mapInstanceRef.current && tileLayerRef.current) {
      const cfg = MAP_TILE_CONFIGS[nextStyle];
      tileLayerRef.current.setUrl(cfg.url);
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.invalidateSize();
      mapInstanceRef.current.setView(
        [location.latitude, location.longitude],
        Math.max(mapInstanceRef.current.getZoom(), 16),
        { animate: true }
      );
      if (markerRef.current) {
        markerRef.current.openPopup();
      }
    }
  };

  // Update location state and localStorage
  const handleLocationUpdate = useCallback(
    async (lat: number, lng: number, acc: number, source: 'gps' | 'network') => {
      if (source === 'gps') {
        hasHardwareGpsFixRef.current = true;
        setGpsStatusNote(null);
      }

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
      setRefreshing(false);
      updateMapPosition(lat, lng, acc, address, false);

      try {
        localStorage.setItem(GPS_CACHE_KEY, JSON.stringify(newLoc));
      } catch {}
    },
    [isMobileDevice, updateMapPosition]
  );

  // Start Real-Time Movement Watcher + Instant Parallel Fallback
  const startRealtimeWatcher = useCallback(() => {
    setRefreshing(true);

    // Ensure map is immediately visible with current known position
    updateMapPosition(
      locationRef.current.latitude,
      locationRef.current.longitude,
      locationRef.current.accuracy,
      locationRef.current.formattedAddress,
      false
    );

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      fetchIpLocation().then((loc) => {
        handleLocationUpdate(loc.latitude, loc.longitude, loc.accuracy, 'network');
      });
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Parallel safety fallback: if hardware GPS doesn't respond within 2.2s, resolve via IP network immediately
    const fallbackTimer = setTimeout(() => {
      if (!hasHardwareGpsFixRef.current) {
        fetchIpLocation().then((loc) => {
          if (!hasHardwareGpsFixRef.current) {
            handleLocationUpdate(loc.latitude, loc.longitude, loc.accuracy, 'network');
          }
        });
      }
    }, 2200);

    // Fast one-shot position check first
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallbackTimer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 12);
        handleLocationUpdate(lat, lng, acc, 'gps');
      },
      () => {
        // Handled by watchPosition or fallbackTimer
      },
      {
        enableHighAccuracy: false,
        timeout: 4500,
        maximumAge: 30000,
      }
    );

    // Continuous high-accuracy hardware GPS watcher
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        clearTimeout(fallbackTimer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = Math.round(pos.coords.accuracy || 10);
        handleLocationUpdate(lat, lng, acc, 'gps');
      },
      (err) => {
        clearTimeout(fallbackTimer);
        if (!hasHardwareGpsFixRef.current) {
          setGpsStatusNote('Đang dùng định vị trạm mạng (cấp quyền Vị trí trình duyệt để bật GPS vệ tinh ±5m)');
          fetchIpLocation().then((loc) => {
            handleLocationUpdate(loc.latitude, loc.longitude, loc.accuracy, 'network');
          });
        } else {
          setRefreshing(false);
        }
        console.warn('GPS watcher fallback:', err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );
  }, [fetchIpLocation, handleLocationUpdate, updateMapPosition]);

  // Mount: Initialize map immediately at 0ms + attach ResizeObserver + start GPS watcher
  useEffect(() => {
    updateMapPosition(
      locationRef.current.latitude,
      locationRef.current.longitude,
      locationRef.current.accuracy,
      locationRef.current.formattedAddress,
      false
    );

    startRealtimeWatcher();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Relative time updater
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - location.timestamp) / 1000);
      if (elapsedSec < 15) {
        setLastUpdatedText('Đang theo dõi di chuyển thời gian thực');
      } else if (elapsedSec < 60) {
        setLastUpdatedText(`Cập nhật ${elapsedSec} giây trước`);
      } else {
        const mins = Math.floor(elapsedSec / 60);
        setLastUpdatedText(`Cập nhật ${mins} phút trước`);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [location.timestamp]);

  const mapLat = location.latitude;
  const mapLng = location.longitude;
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
              <span className="text-xs text-slate-400 hidden sm:inline">
                • Định vị thiết bị &amp; bản đồ trực tuyến
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-display text-white mt-0.5">
              Vị Trí Vòng Tay &amp; Bản Đồ Cứu Hộ Khẩn Cấp
            </h2>
          </div>
        </div>

        {/* Right Action: Manual Refresh + Live Status + Google Maps */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800/90 text-[11px] font-mono-tech text-emerald-300 border border-slate-700">
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
            <span>Dò lại GPS</span>
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

      {/* Main Grid: Interactive Map + Telemetry Readout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Map View (7 cols) */}
        <div className="lg:col-span-7 relative h-[300px] sm:h-[340px] md:h-[370px] rounded-2xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-900">
          {/* Leaflet DOM Container */}
          <div
            ref={mapContainerRef}
            className="w-full h-full z-10"
            style={{ minHeight: '300px', width: '100%', height: '100%' }}
          />

          {/* Top-Left Floating Live Badge */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] font-mono-tech font-medium text-emerald-300 shadow-md backdrop-blur-md pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Vị trí thiết bị: {location.city || 'Đà Nẵng'}</span>
          </div>

          {/* Top-Right Map Layer Switcher (Đường phố / Vệ tinh / OSM) */}
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 p-1 rounded-xl bg-slate-900/90 border border-slate-700 shadow-md backdrop-blur-md">
            <Layers className="w-3.5 h-3.5 text-cyan-400 ml-1.5 mr-0.5 hidden xs:inline" />
            {(['street', 'satellite', 'osm'] as MapStyleMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleSelectMapStyle(mode)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono-tech font-semibold transition cursor-pointer ${
                  mapStyle === mode
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {MAP_TILE_CONFIGS[mode].label}
              </button>
            ))}
          </div>

          {/* Bottom-Left Map Zoom & Recenter Controls */}
          <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleRecenter}
              title="Đưa bản đồ về đúng tâm vị trí thiết bị"
              className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition"
            >
              <Crosshair className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              title="Phóng to bản đồ"
              className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              title="Thu nhỏ bản đồ"
              className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom-Right Map Attribution */}
          <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900/85 border border-slate-800 text-[9px] font-mono-tech text-slate-300 pointer-events-none">
            <span>{MAP_TILE_CONFIGS[mapStyle].attribution}</span>
          </div>
        </div>

        {/* Right Telemetry Details (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3">
          {/* Card 1: Detected Address */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70">
            <div className="flex items-center justify-between gap-2 text-xs font-mono-tech text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-400" />
                <span>ĐỊA CHỈ PHÁT HIỆN HIỆN TẠI</span>
              </span>
              <button
                type="button"
                onClick={handleRecenter}
                className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
              >
                Xem trên bản đồ
              </button>
            </div>
            <div className="text-sm font-semibold text-white leading-snug">
              {location.formattedAddress}
            </div>
            {gpsStatusNote && (
              <div className="text-[11px] text-amber-300/90 mt-1.5 font-mono-tech">
                • {gpsStatusNote}
              </div>
            )}
          </div>

          {/* Card 2: Coordinates & Accuracy */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">
                TỌA ĐỘ VĨ - KINH ĐỘ
              </div>
              <div className="text-xs font-mono-tech font-bold text-cyan-300 mt-1">
                {location.latitude.toFixed(5)}°B
              </div>
              <div className="text-xs font-mono-tech font-bold text-cyan-300">
                {location.longitude.toFixed(5)}°Đ
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70">
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">
                ĐỘ CHÍNH XÁC GPS
              </div>
              <div className="text-sm font-mono-tech font-bold text-emerald-400 mt-1">
                ±{location.accuracy}m
              </div>
              <div className="text-[10px] text-emerald-400/80 mt-0.5">
                {location.source === 'gps' ? 'Vệ tinh GPS phần cứng' : 'Định vị mạng / Wi-Fi'}
              </div>
            </div>
          </div>

          {/* Card 3: Device Info & Movement Updates */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                {isMobileDevice ? (
                  <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>Thiết bị đang mở:</span>
              </span>
              <strong className="text-white font-mono-tech text-[11px]">
                {isMobileDevice ? 'Điện thoại di động (Mobile)' : 'Máy tính / Laptop'}
              </strong>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <LocateFixed className="w-3.5 h-3.5 text-emerald-400" />
                <span>Số lần đồng bộ vị trí:</span>
              </span>
              <span className="font-mono-tech font-semibold text-emerald-300">
                {movementCount} lần cập nhật
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/60">
              <span className="text-slate-400 text-[11px]">Trạng thái:</span>
              <span className="font-mono-tech text-cyan-300 text-[11px]">{lastUpdatedText}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

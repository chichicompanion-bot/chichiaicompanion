import React, { useState } from 'react';
import { MapPin, Eye, EyeOff, ShieldAlert, Radio } from 'lucide-react';

export const HealthMapPanel: React.FC = () => {
  const [showDemoMap, setShowDemoMap] = useState(false);

  return (
    <div className="rounded-2xl nexus-glass p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/35 flex items-center justify-center text-sky-300">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg">
                Wearable Location & Safe-Zone Beacon
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-tech font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                OPTIONAL GPS MODULE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Module định vị khẩn cấp (dành cho phiên bản mở rộng tích hợp GPS NEO-6M / L80-R)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDemoMap((prev) => !prev)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400/40 text-xs font-mono-tech text-slate-200 transition-all cursor-pointer"
        >
          {showDemoMap ? <EyeOff className="w-3.5 h-3.5 text-cyan-400" /> : <Eye className="w-3.5 h-3.5 text-cyan-400" />}
          <span>{showDemoMap ? 'Ẩn bản đồ mô phỏng' : 'Mở bản đồ Radar Demo'}</span>
        </button>
      </div>

      {!showDemoMap ? (
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center gap-3 text-xs text-slate-400">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <span>
            Mạch ESP32 + MAX30102 hiện tại chưa gắn module GPS phần cứng. Hệ thống đã ẩn bản đồ theo mặc định để không tự suy diễn vị trí thật của người đeo. Bấm <strong>"Mở bản đồ Radar Demo"</strong> nếu bạn muốn xem giao diện mô phỏng vùng an toàn (Safe-Zone).
          </span>
        </div>
      ) : (
        <div className="relative h-64 rounded-xl bg-[#060d1f] border border-cyan-500/30 overflow-hidden flex items-center justify-center p-4">
          {/* Simulated Radar Grid */}
          <div className="absolute inset-0 nexus-tech-grid opacity-80" />
          <div className="relative flex items-center justify-center">
            <div className="w-48 h-48 rounded-full border border-cyan-400/20 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border border-cyan-400/35 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border border-emerald-400/50 bg-emerald-500/10 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          <div className="absolute top-3 left-3 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-[11px] font-mono-tech text-amber-200">
            BẢN ĐỒ RADAR DEMO — TỌA ĐỘ MÔ PHỎNG PHÒNG LAB KHKT (KHÔNG PHẢI GPS THẬT)
          </div>

          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/85 border border-slate-800 text-[11px] font-mono-tech text-slate-300">
            Bán kính Safe-Zone: 150m • Trạng thái GPS thật: Chưa lắp module NEO-6M
          </div>
        </div>
      )}
    </div>
  );
};

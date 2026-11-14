import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  X,
  HeartPulse,
  Activity,
  Wind,
  Flame,
  RotateCcw,
} from 'lucide-react';

interface StrokeEmergencyAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetNormal: () => void;
  heartRate: number | string;
  bloodPressure: string;
  spo2: number | string;
  respiratoryRate: number | string;
}

export const StrokeEmergencyAlertModal: React.FC<StrokeEmergencyAlertModalProps> = ({
  isOpen,
  onClose,
  onResetNormal,
  heartRate,
  bloodPressure,
  spo2,
  respiratoryRate,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none pointer-events-auto">
          {/* Backdrop with subtle glass blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Ultra-compact, sleek Centered Warning Box ("Bảng cảnh báo thu gọn") */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.9, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: 'spring', damping: 26, stiffness: 360 }}
            className="relative w-full max-w-[390px] rounded-2xl p-4 sm:p-4.5 bg-slate-900/95 text-white border-2 border-rose-500/90 shadow-[0_0_40px_rgba(244,63,94,0.45)] z-10 overflow-hidden backdrop-blur-xl"
          >
            {/* Top Animated Hazard Laser Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600 animate-pulse" />

            {/* Top Close Button 'X' */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cảnh báo"
              className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Header: Compact Siren + Title */}
            <div className="flex items-center gap-2.5 pr-7">
              <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-500/50 shrink-0">
                <AlertTriangle className="w-4 h-4 animate-bounce" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-tech font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    BÁO ĐỘNG ĐỎ
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono-tech">• ĐỘT QUỴ CẤP</span>
                </div>
                <h3 className="text-sm font-bold font-display text-white tracking-wide truncate">
                  CẢNH BÁO NGUY CƠ ĐỘT QUỴ!
                </h3>
              </div>
            </div>

            {/* Compact 2x2 Telemetry Grid */}
            <div className="grid grid-cols-2 gap-2 my-3">
              {/* Nhịp tim vọt */}
              <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-500/40">
                <div className="flex items-center justify-between text-[10px] font-mono-tech text-rose-300">
                  <span className="flex items-center gap-1">
                    <HeartPulse className="w-3 h-3 text-rose-400 animate-pulse" />
                    NHỊP TIM
                  </span>
                  <span className="text-[9px] text-rose-400">Rung nhĩ</span>
                </div>
                <div className="text-lg font-bold font-display text-rose-400 mt-0.5">
                  {heartRate} <span className="text-[11px] font-normal text-rose-300/80">BPM</span>
                </div>
              </div>

              {/* Huyết áp cao */}
              <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-500/40">
                <div className="flex items-center justify-between text-[10px] font-mono-tech text-rose-300">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-rose-400" />
                    HUYẾT ÁP
                  </span>
                  <span className="text-[9px] text-rose-400">Tăng vọt</span>
                </div>
                <div className="text-lg font-bold font-display text-rose-400 mt-0.5">
                  {bloodPressure} <span className="text-[11px] font-normal text-rose-300/80">mmHg</span>
                </div>
              </div>

              {/* Oxy máu tụt */}
              <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/40">
                <div className="flex items-center justify-between text-[10px] font-mono-tech text-amber-300">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    OXY MÁU
                  </span>
                  <span className="text-[9px] text-amber-400">Tụt não</span>
                </div>
                <div className="text-lg font-bold font-display text-amber-400 mt-0.5">
                  {spo2}<span className="text-[11px] font-normal text-amber-300/80">%</span>
                </div>
              </div>

              {/* Nhịp thở nhanh */}
              <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/40">
                <div className="flex items-center justify-between text-[10px] font-mono-tech text-amber-300">
                  <span className="flex items-center gap-1">
                    <Wind className="w-3 h-3 text-amber-400" />
                    NHỊP THỞ
                  </span>
                  <span className="text-[9px] text-amber-400">Dồn dập</span>
                </div>
                <div className="text-lg font-bold font-display text-amber-400 mt-0.5">
                  {respiratoryRate} <span className="text-[11px] font-normal text-amber-300/80">l/p</span>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={onResetNormal}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/30 transition active:scale-95 cursor-pointer text-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Khôi phục an toàn</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

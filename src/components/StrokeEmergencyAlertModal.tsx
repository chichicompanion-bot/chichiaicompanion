import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  X,
  HeartPulse,
  Activity,
  Wind,
  PhoneCall,
  ShieldAlert,
  ArrowRight,
  Flame,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
          />

          {/* Centered Small Alert Card ("Biển báo nhỏ nhỏ giữa màn hình") */}
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.88, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="relative w-full max-w-[440px] rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 border-2 border-rose-500 shadow-[0_0_50px_rgba(244,63,94,0.35)] z-10 overflow-hidden"
          >
            {/* Top Glowing Hazard Stripe */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600 animate-pulse" />

            {/* Top Close Button 'X' on top-right */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng biển báo cảnh báo"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-rose-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Alert Header */}
            <div className="flex items-start gap-3.5 pr-8">
              <div className="relative w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/40 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-bounce" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-bold uppercase tracking-wider bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                    BÁO ĐỘNG ĐỎ • Y TẾ KHẨN CẤP
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold font-display text-rose-600 dark:text-rose-400 mt-1">
                  CẢNH BÁO NGUY CƠ ĐỘT QUỴ!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                  Phát hiện biến động tim mạch &amp; huyết áp đạt ngưỡng nguy hiểm.
                </p>
              </div>
            </div>

            {/* Critical Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 my-4">
              {/* Nhịp tim */}
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                <div className="flex items-center gap-1 text-[11px] font-mono-tech text-rose-700 dark:text-rose-300">
                  <HeartPulse className="w-3.5 h-3.5" />
                  <span>NHỊP TIM VỌT</span>
                </div>
                <div className="text-xl font-bold font-display text-rose-600 dark:text-rose-400 mt-0.5">
                  {heartRate} <span className="text-xs font-normal">BPM</span>
                </div>
                <div className="text-[10px] text-rose-600/80">Rung nhĩ / Tắc mạch não</div>
              </div>

              {/* Huyết áp */}
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60">
                <div className="flex items-center gap-1 text-[11px] font-mono-tech text-rose-700 dark:text-rose-300">
                  <Activity className="w-3.5 h-3.5" />
                  <span>HUYẾT ÁP CAO</span>
                </div>
                <div className="text-xl font-bold font-display text-rose-600 dark:text-rose-400 mt-0.5">
                  {bloodPressure}
                </div>
                <div className="text-[10px] text-rose-600/80">Cơn tăng áp ác tính</div>
              </div>

              {/* Nồng độ Oxy SpO2 */}
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <div className="flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-300">
                  <Flame className="w-3.5 h-3.5" />
                  <span>OXY MÁU TỤT</span>
                </div>
                <div className="text-xl font-bold font-display text-amber-600 dark:text-amber-400 mt-0.5">
                  {spo2}<span className="text-xs font-normal">%</span>
                </div>
                <div className="text-[10px] text-amber-600/80">Thiếu oxy tế bào não</div>
              </div>

              {/* Nhịp thở */}
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60">
                <div className="flex items-center gap-1 text-[11px] font-mono-tech text-amber-700 dark:text-amber-300">
                  <Wind className="w-3.5 h-3.5" />
                  <span>NHỊP THỞ NHANH</span>
                </div>
                <div className="text-xl font-bold font-display text-amber-600 dark:text-amber-400 mt-0.5">
                  {respiratoryRate} <span className="text-xs font-normal">lần/p</span>
                </div>
                <div className="text-[10px] text-amber-600/80">Thở nông, dồn dập</div>
              </div>
            </div>

            {/* Quick F.A.S.T Medical Guidance Box */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1.5 mb-4">
              <div className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                <span>Quy tắc nhận biết đột quỵ F.A.S.T:</span>
              </div>
              <ul className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5 pl-5 list-disc">
                <li><strong>F (Mặt):</strong> Mặt cười lệch một bên, méo miệng.</li>
                <li><strong>A (Tay):</strong> Một cánh tay bị yếu, tê buốt hoặc rơi xuống.</li>
                <li><strong>S (Nói):</strong> Giọng nói ú ớ, ngọng nghịu, khó diễn đạt.</li>
                <li><strong>T (Thời gian):</strong> Gọi cấp cứu y tế <strong>115</strong> ngay!</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onResetNormal}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer text-center"
              >
                Khôi phục chỉ số bình thường
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium border border-slate-200 dark:border-slate-700 transition cursor-pointer"
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

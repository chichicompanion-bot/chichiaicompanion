import React, { useRef } from 'react';
import {
  Heart,
  Droplets,
  Activity,
  Thermometer,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { MetricKey, NavSection } from '../types/health';

interface HealthInsightNotificationCardsProps {
  onSelectMetric: (key: MetricKey) => void;
  onOpenSection: (section: NavSection) => void;
  isLightMode: boolean;
}

interface InsightCardItem {
  id: string;
  badge: string;
  scoreText: string;
  scorePercent: number; // 0 to 100 for gradient bar
  title: string;
  description: string;
  buttonLabel: string;
  gradientClass: string;
  borderClass: string;
  iconBg: string;
  iconColor: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

export const HealthInsightNotificationCards: React.FC<HealthInsightNotificationCardsProps> = ({
  onSelectMetric,
  onOpenSection,
  isLightMode,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const distance = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  const cards: InsightCardItem[] = [
    {
      id: 'cardiac-age',
      badge: 'AI Health Score',
      scoreText: 'Trẻ hơn 2 tuổi • Tối ưu',
      scorePercent: 78,
      title: 'Tuổi Sinh Học Tim Mạch',
      description: 'Nhịp tim 74 BPM ổn định. Tuổi sinh học của tim trẻ hơn 2 tuổi so với tuổi thực tế.',
      buttonLabel: 'Xem báo cáo',
      gradientClass:
        'bg-gradient-to-br from-sky-50 via-white to-blue-50/70 dark:from-[#0b1d3a] dark:via-[#08152b] dark:to-[#050e1d]',
      borderClass: 'border-sky-200/90 dark:border-sky-500/35 hover:border-sky-400',
      iconBg: 'rgba(2, 132, 199, 0.12)',
      iconColor: '#0284c7',
      icon: Heart,
      onClick: () => onSelectMetric('heartRate'),
    },
    {
      id: 'spo2-telemetry',
      badge: 'Bão Hòa Oxy Máu',
      scoreText: 'SpO₂ 98.4% • Bình thường',
      scorePercent: 92,
      title: 'Giám Sát Hô Hấp Tế Bào',
      description: 'Độ bão hòa oxy duy trì 98.4% ổn định trong 4 giờ qua. Tần số hô hấp bình thường.',
      buttonLabel: 'Chi tiết SpO₂',
      gradientClass:
        'bg-gradient-to-br from-cyan-50 via-white to-teal-50/70 dark:from-[#08202b] dark:via-[#061821] dark:to-[#030e14]',
      borderClass: 'border-cyan-200/90 dark:border-cyan-500/35 hover:border-cyan-400',
      iconBg: 'rgba(0, 240, 255, 0.12)',
      iconColor: '#00c8e0',
      icon: Droplets,
      onClick: () => onSelectMetric('spo2'),
    },
    {
      id: 'hrv-recovery',
      badge: 'Phục Hồi Tự Chủ',
      scoreText: 'HRV 62ms • Hồi phục 88%',
      scorePercent: 88,
      title: 'Biến Thiên Tim & Stress',
      description: 'Hệ thần kinh đối giao cảm hoạt động tối ưu. Mức độ căng thẳng giảm 18% sau giấc ngủ sâu.',
      buttonLabel: 'Xem mức stress',
      gradientClass:
        'bg-gradient-to-br from-indigo-50 via-white to-purple-50/70 dark:from-[#1b0e2f] dark:via-[#140a24] dark:to-[#0a0512]',
      borderClass: 'border-indigo-200/90 dark:border-indigo-500/35 hover:border-indigo-400',
      iconBg: 'rgba(129, 140, 248, 0.14)',
      iconColor: '#6366f1',
      icon: Activity,
      onClick: () => onSelectMetric('hrv'),
    },
    {
      id: 'skin-temp',
      badge: 'Thân Nhiệt Ngoại Vi',
      scoreText: '36.4°C • An toàn',
      scorePercent: 70,
      title: 'Nhiệt Độ Da Ban Đêm',
      description: 'Nhiệt độ biểu bì không có biến động bất thường. Cơ thể duy trì chu kỳ điều nhiệt tốt.',
      buttonLabel: 'Biểu đồ nhiệt',
      gradientClass:
        'bg-gradient-to-br from-amber-50 via-white to-orange-50/70 dark:from-[#2a1708] dark:via-[#1f1005] dark:to-[#0f0702]',
      borderClass: 'border-amber-200/90 dark:border-amber-500/35 hover:border-amber-400',
      iconBg: 'rgba(245, 158, 11, 0.14)',
      iconColor: '#f59e0b',
      icon: Thermometer,
      onClick: () => onSelectMetric('skinTemp'),
    },
    {
      id: 'esp32-stream',
      badge: 'Vòng Tay Thông Minh',
      scoreText: 'ESP32 • 1,425 Gói tin',
      scorePercent: 99,
      title: 'MAX30102 Live Telemetry',
      description: 'Tín hiệu PPG quang học truyền về thời gian thực đạt độ tin cậy 99.8% qua Wi-Fi.',
      buttonLabel: 'Quản lý vòng tay',
      gradientClass:
        'bg-gradient-to-br from-emerald-50 via-white to-teal-50/70 dark:from-[#092318] dark:via-[#061a12] dark:to-[#030f0a]',
      borderClass: 'border-emerald-200/90 dark:border-emerald-500/35 hover:border-emerald-400',
      iconBg: 'rgba(16, 185, 129, 0.14)',
      iconColor: '#10b981',
      icon: Cpu,
      onClick: () => onOpenSection('device'),
    },
  ];

  return (
    <div className="relative w-full">
      {/* Section Header with Left / Right Scroll Buttons */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-xs font-mono-tech font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Thông Báo Sinh Học &amp; AI Health Insights (5 Thẻ)
          </h2>
        </div>

        <div className="hidden sm:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label="Cuộn sang trái"
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer active:scale-95 shadow-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label="Cuộn sang phải"
            className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition cursor-pointer active:scale-95 shadow-sm"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Touch Scrollable Strip (Swipe with finger on mobile) */}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Danh sách thông báo sinh học"
        className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory py-1 px-1 focus:outline-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {cards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div
              key={card.id}
              className={`w-[272px] sm:w-[285px] shrink-0 snap-start rounded-2xl p-3 sm:p-3.5 border shadow-sm transition-all duration-300 flex flex-col justify-between ${card.gradientClass} ${card.borderClass}`}
            >
              {/* Top: Badge + Gradient Indicator Bar (Image 1 Style) */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[10px] font-mono-tech uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    {card.badge}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] font-mono-tech font-semibold text-slate-700 dark:text-slate-200">
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span>{card.scoreText}</span>
                  </div>
                </div>

                {/* Score Progress Bar: Red -> Yellow -> Green */}
                <div className="relative w-full h-1.5 rounded-full overflow-hidden mb-2.5 bg-slate-200/80 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${card.scorePercent}%`,
                      background: 'linear-gradient(90deg, #f97316 0%, #eab308 50%, #22c55e 100%)',
                    }}
                  />
                  {/* Glowing Indicator Dot */}
                  <div
                    className="absolute top-0 bottom-0 w-2.5 h-2.5 -mt-0.5 rounded-full bg-white border border-emerald-500 shadow-sm"
                    style={{ left: `calc(${card.scorePercent}% - 5px)` }}
                  />
                </div>

                {/* Content: Title & Description */}
                <div className="flex items-start gap-2.5">
                  <div
                    style={{ backgroundColor: card.iconBg, color: card.iconColor }}
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-sm"
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold font-display text-slate-900 dark:text-white truncate">
                      {card.title}
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button: View Full Report */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={card.onClick}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-[11px] font-medium text-slate-800 dark:text-slate-100 shadow-xs transition cursor-pointer active:scale-95"
                >
                  <span>{card.buttonLabel}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </button>
                <span className="text-[9px] font-mono-tech text-slate-400">Thời gian thực</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

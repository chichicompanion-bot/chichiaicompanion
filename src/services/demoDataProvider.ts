import {
  ActivityRingItem,
  DeviceStatusInfo,
  HealthHistoryRecord,
  MetricCardData,
  PPGWavePoint,
  SleepSummaryData,
  SystemNotification,
  TelemetryTimeSeriesPoint,
  TimeRange,
} from '../types/health';
import { estimateStressIndex } from '../utils/chartProcessing';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export class DemoDataProvider {
  private currentHr = 74;
  private currentSpo2 = 98.4;
  private currentHrv = 62;
  private currentTemp = 36.4;
  private currentSteps = 8420;
  private sleepMinutes = 452; // 7h 32m
  private batteryPercent = 86;
  private totalPackets = 1428;
  private validPackets = 1425;
  private phase = 0;

  public tickSimulation(): {
    metrics: MetricCardData[];
    device: DeviceStatusInfo;
    latestPoint: TelemetryTimeSeriesPoint;
  } {
    this.phase += 0.35;
    this.totalPackets += 1;
    if (Math.random() > 0.003) {
      this.validPackets += 1;
    }

    // Bounded physiological drift for realistic demo evaluation
    this.currentHr = Math.round(
      clamp(this.currentHr + Math.sin(this.phase) * 1.4 + (Math.random() - 0.48) * 1.8, 62, 96)
    );
    this.currentSpo2 =
      Math.round(
        clamp(this.currentSpo2 + (Math.random() - 0.5) * 0.3, 96.5, 99.6) * 10
      ) / 10;
    this.currentHrv = Math.round(
      clamp(this.currentHrv - (this.currentHr - 74) * 0.25 + (Math.random() - 0.5) * 2.2, 42, 88)
    );
    this.currentTemp =
      Math.round(
        clamp(this.currentTemp + (Math.random() - 0.5) * 0.06, 36.1, 36.8) * 10
      ) / 10;

    if (Math.random() > 0.45) {
      this.currentSteps += Math.floor(Math.random() * 4);
    }

    const stress = estimateStressIndex(this.currentHr, this.currentHrv) ?? 28;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const latestPoint: TelemetryTimeSeriesPoint = {
      timestamp: now.toISOString(),
      timeLabel: timeStr,
      heartRate: this.currentHr,
      spo2: this.currentSpo2,
      hrv: this.currentHrv,
      skinTemp: this.currentTemp,
      stress,
    };

    return {
      metrics: this.buildMetricCards(timeStr, stress),
      device: this.getDeviceStatus(now.toLocaleTimeString('vi-VN')),
      latestPoint,
    };
  }

  public buildMetricCards(measuredAtLabel: string, stressIndex: number): MetricCardData[] {
    const sleepHours = Math.floor(this.sleepMinutes / 60);
    const sleepRem = this.sleepMinutes % 60;

    // Normal healthy baseline cardiovascular metrics
    const systolicBp = Math.round(116 + Math.sin(this.phase * 0.7) * 3);
    const diastolicBp = Math.round(76 + Math.cos(this.phase * 0.7) * 2);
    const respiration = Math.round(15 + Math.sin(this.phase * 0.5) * 2);

    return [
      {
        key: 'heartRate',
        title: 'HEART RATE',
        vietnameseTitle: 'Nhịp tim tức thời',
        value: this.currentHr,
        formattedValue: `${this.currentHr}`,
        unit: 'BPM',
        deltaPercent: 1.8,
        deltaLabel: 'Bình thường (60-100 BPM)',
        sensorSource: 'Cảm biến quang học MAX30102',
        measuredAt: measuredAtLabel,
        freshness: 'DEMO',
        accentColor: '#FF2E54',
        glowColor: 'rgba(255, 46, 84, 0.28)',
        sparkline: this.generateMiniSpark(this.currentHr, 4, 14),
        note: 'Tần số tim đập/phút đo từ cảm biến quang học PPG.',
      },
      {
        key: 'bloodPressure',
        title: 'BLOOD PRESSURE',
        vietnameseTitle: 'Huyết áp ước tính',
        value: systolicBp,
        formattedValue: `${systolicBp}/${diastolicBp}`,
        unit: 'mmHg',
        deltaPercent: 0.5,
        deltaLabel: 'Lý tưởng (< 120/80 mmHg)',
        sensorSource: 'Ước tính sóng mạch PTT/PPG',
        measuredAt: measuredAtLabel,
        freshness: 'DEMO',
        accentColor: '#E11D48',
        glowColor: 'rgba(225, 29, 72, 0.28)',
        sparkline: this.generateMiniSpark(systolicBp, 3, 14),
        note: 'Huyết áp tâm thu và tâm trương (bình thường < 120/80 mmHg).',
      },
      {
        key: 'spo2',
        title: 'BLOOD OXYGEN',
        vietnameseTitle: 'Oxy trong máu (SpO₂)',
        value: this.currentSpo2,
        formattedValue: `${this.currentSpo2.toFixed(1)}`,
        unit: '%',
        deltaPercent: 0.2,
        deltaLabel: 'Tối ưu (95-100%)',
        sensorSource: 'Quang phổ Red/IR MAX30102',
        measuredAt: measuredAtLabel,
        freshness: 'DEMO',
        accentColor: '#00F0FF',
        glowColor: 'rgba(0, 240, 255, 0.26)',
        sparkline: this.generateMiniSpark(this.currentSpo2, 0.3, 14),
        note: 'Tỷ lệ hemoglobin gắn oxy trong máu mao mạch.',
      },
      {
        key: 'respiratoryRate',
        title: 'RESPIRATORY RATE',
        vietnameseTitle: 'Nhịp thở lồng ngực',
        value: respiration,
        formattedValue: `${respiration}`,
        unit: 'lần/phút',
        deltaPercent: 0.0,
        deltaLabel: 'Nhịp thở êm (12-20 lần/phút)',
        sensorSource: 'Dao động lồng ngực & PPG',
        measuredAt: measuredAtLabel,
        freshness: 'DEMO',
        accentColor: '#0284C7',
        glowColor: 'rgba(2, 132, 199, 0.25)',
        sparkline: this.generateMiniSpark(respiration, 1, 14),
        note: 'Số chu kỳ hít vào - thở ra trong một phút.',
      },
      {
        key: 'skinTemp',
        title: 'BODY TEMPERATURE',
        vietnameseTitle: 'Nhiệt độ cơ thể',
        value: this.currentTemp,
        formattedValue: `${this.currentTemp.toFixed(1)}`,
        unit: '°C',
        deltaPercent: -0.1,
        deltaLabel: 'Thân nhiệt ổn định (36.5-37.2°C)',
        sensorSource: 'Cảm biến nhiệt độ bề mặt',
        measuredAt: measuredAtLabel,
        freshness: 'DEMO',
        accentColor: '#F59E0B',
        glowColor: 'rgba(245, 158, 11, 0.25)',
        sparkline: this.generateMiniSpark(this.currentTemp, 0.1, 14),
        note: 'Thân nhiệt đo tại cổ tay tham chiếu nhiệt độ cơ thể.',
      },
      {
        key: 'stress',
        title: 'CARDIAC STRESS',
        vietnameseTitle: 'Mức độ căng thẳng Tim',
        value: stressIndex,
        formattedValue: `${stressIndex}`,
        unit: '%',
        deltaPercent: -2.0,
        deltaLabel: 'Mức thấp - Thư giãn (< 40%)',
        sensorSource: 'Phân tích biến thiên nhịp tim',
        measuredAt: measuredAtLabel,
        freshness: 'DEMO',
        accentColor: '#10B981',
        glowColor: 'rgba(16, 185, 129, 0.25)',
        sparkline: this.generateMiniSpark(stressIndex, 2, 14),
        note: 'Mức độ tải áp lực thần kinh thực vật lên tim.',
      },
    ];
  }

  private generateMiniSpark(center: number, variance: number, count: number) {
    return Array.from({ length: count }, (_, idx) => ({
      time: `${idx}`,
      value: Math.round((center + Math.sin(idx * 0.7 + this.phase) * variance * 0.6 + (Math.random() - 0.5) * variance * 0.5) * 10) / 10,
    }));
  }

  public getTimeSeries(range: TimeRange): TelemetryTimeSeriesPoint[] {
    const counts: Record<TimeRange, number> = {
      '1h': 30,
      '6h': 36,
      '24h': 48,
      '7d': 28,
    };
    const stepMinutes: Record<TimeRange, number> = {
      '1h': 2,
      '6h': 10,
      '24h': 30,
      '7d': 360,
    };

    const total = counts[range];
    const step = stepMinutes[range];
    const now = Date.now();

    return Array.from({ length: total }, (_, idx) => {
      const pointTime = new Date(now - (total - 1 - idx) * step * 60 * 1000);
      const wave = Math.sin(idx * 0.45) * 6 + Math.cos(idx * 0.2) * 3;
      const hr = Math.round(clamp(73 + wave + (idx === total - 1 ? this.currentHr - 73 : 0), 58, 108));
      const spo2 = Math.round(clamp(98.2 + Math.sin(idx * 0.3) * 0.7, 96.2, 99.6) * 10) / 10;
      const hrv = Math.round(clamp(64 - wave * 1.4, 38, 92));
      const skinTemp = Math.round(clamp(36.3 + Math.sin(idx * 0.25) * 0.25, 35.9, 36.8) * 10) / 10;
      const stress = estimateStressIndex(hr, hrv) ?? 30;

      const timeLabel =
        range === '7d'
          ? pointTime.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : pointTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

      return {
        timestamp: pointTime.toISOString(),
        timeLabel,
        heartRate: hr,
        spo2,
        hrv,
        skinTemp,
        stress,
      };
    });
  }

  /**
   * Generates simulated optical PPG waveform (Photoplethysmography from MAX30102)
   * with systolic peak, dicrotic notch, and diastolic runoff.
   * Explicitly labeled as Optical PPG Waveform, NOT a clinical 12-lead ECG.
   */
  public getOpticalPPGWaveform(sampleCount = 64, phaseOffset = 0): PPGWavePoint[] {
    return Array.from({ length: sampleCount }, (_, i) => {
      const t = ((i + phaseOffset) % 16) / 16; // Normalized cardiac cycle 0..1
      // Systolic peak around t = 0.22, dicrotic notch around t = 0.48, diastolic wave around t = 0.58
      const systolic = Math.exp(-Math.pow((t - 0.22) / 0.085, 2)) * 1.0;
      const diastolic = Math.exp(-Math.pow((t - 0.56) / 0.14, 2)) * 0.38;
      const baseline = Math.sin(((i + phaseOffset) / sampleCount) * Math.PI * 2) * 0.04;
      const irSignal = Math.round((systolic + diastolic + baseline) * 1000) / 10;
      const redSignal = Math.round((systolic * 0.82 + diastolic * 0.31 + baseline) * 1000) / 10;

      return {
        index: i,
        timeMs: i * 40,
        irSignal,
        redSignal,
      };
    });
  }

  public getActivityRings(): ActivityRingItem[] {
    const moveCurrent = Math.round(480 + (this.currentSteps - 8400) * 0.05);
    const moveGoal = 600;
    const exerciseCurrent = 38;
    const exerciseGoal = 45;
    const standCurrent = 10;
    const standGoal = 12;

    return [
      {
        id: 'move',
        label: 'MOVE',
        vietnameseLabel: 'Năng lượng vận động',
        current: moveCurrent,
        goal: moveGoal,
        unit: 'kcal',
        percentage: Math.min(100, Math.round((moveCurrent / moveGoal) * 100)),
        colorStart: '#00F0FF',
        colorEnd: '#0284C7',
        description: 'Ước tính tiêu hao calo hoạt động từ gia tốc kế MPU6050 & nhịp tim PPG.',
      },
      {
        id: 'exercise',
        label: 'EXERCISE',
        vietnameseLabel: 'Phút vận động tích cực',
        current: exerciseCurrent,
        goal: exerciseGoal,
        unit: 'phút',
        percentage: Math.min(100, Math.round((exerciseCurrent / exerciseGoal) * 100)),
        colorStart: '#00E5A3',
        colorEnd: '#059669',
        description: 'Thời gian nhịp tim và cường độ bước chân vượt ngưỡng vận động vừa.',
      },
      {
        id: 'stand',
        label: 'STAND',
        vietnameseLabel: 'Giờ đứng & di chuyển',
        current: standCurrent,
        goal: standGoal,
        unit: 'giờ',
        percentage: Math.min(100, Math.round((standCurrent / standGoal) * 100)),
        colorStart: '#38BDF8',
        colorEnd: '#6366F1',
        description: 'Số giờ trong ngày có ít nhất 1 phút đứng dậy và di chuyển cổ tay.',
      },
    ];
  }

  public getSleepSummary(): SleepSummaryData {
    return {
      totalMinutes: this.sleepMinutes,
      formattedTotal: '7h 32m',
      efficiencyPercent: 91,
      isDemoOrEstimated: true,
      estimationMethod:
        'Dữ liệu DEMO — Ước tính giai đoạn ngủ dựa trên thuật toán Actigraphy (gia tốc cổ tay MPU6050) kết hợp biến thiên nhịp tim PPG (MAX30102).',
      stages: {
        awakeMinutes: 24,
        lightMinutes: 238,
        deepMinutes: 102,
        remMinutes: 88,
      },
      timeline: [
        { time: '23:00', stage: 'Awake', stageLevel: 4, durationMinutes: 14, heartRateAvg: 70 },
        { time: '23:30', stage: 'Light', stageLevel: 2, durationMinutes: 45, heartRateAvg: 63 },
        { time: '00:15', stage: 'Deep', stageLevel: 1, durationMinutes: 55, heartRateAvg: 56 },
        { time: '01:10', stage: 'Light', stageLevel: 2, durationMinutes: 40, heartRateAvg: 61 },
        { time: '01:50', stage: 'REM', stageLevel: 3, durationMinutes: 35, heartRateAvg: 66 },
        { time: '02:25', stage: 'Light', stageLevel: 2, durationMinutes: 50, heartRateAvg: 60 },
        { time: '03:15', stage: 'Deep', stageLevel: 1, durationMinutes: 47, heartRateAvg: 55 },
        { time: '04:02', stage: 'Light', stageLevel: 2, durationMinutes: 58, heartRateAvg: 60 },
        { time: '05:00', stage: 'REM', stageLevel: 3, durationMinutes: 53, heartRateAvg: 65 },
        { time: '05:53', stage: 'Light', stageLevel: 2, durationMinutes: 45, heartRateAvg: 62 },
        { time: '06:30', stage: 'Awake', stageLevel: 4, durationMinutes: 10, heartRateAvg: 72 },
      ],
    };
  }

  public getHistoryRecords(count = 48): HealthHistoryRecord[] {
    const now = Date.now();
    const templates: Array<{
      key: HealthHistoryRecord['metricKey'];
      name: string;
      unit: string;
      sensor: string;
      compute: (i: number) => number;
    }> = [
      {
        key: 'heartRate',
        name: 'Heart Rate (Nhịp tim PPG)',
        unit: 'BPM',
        sensor: 'MAX30102 Optical PPG',
        compute: (i) => Math.round(72 + Math.sin(i * 0.5) * 8),
      },
      {
        key: 'spo2',
        name: 'Blood Oxygen (SpO₂)',
        unit: '%',
        sensor: 'MAX30102 Red/IR Ratio',
        compute: (i) => Math.round((98.2 + Math.cos(i * 0.4) * 0.8) * 10) / 10,
      },
      {
        key: 'hrv',
        name: 'HRV (Biến thiên nhịp tim RMSSD)',
        unit: 'ms',
        sensor: 'ESP32 IBI Analyzer',
        compute: (i) => Math.round(62 + Math.cos(i * 0.6) * 11),
      },
      {
        key: 'skinTemp',
        name: 'Skin Temperature (Nhiệt độ da)',
        unit: '°C',
        sensor: 'MAX30102 Die / NTC',
        compute: (i) => Math.round((36.4 + Math.sin(i * 0.3) * 0.25) * 10) / 10,
      },
      {
        key: 'steps',
        name: 'Steps (Bước chân tích lũy)',
        unit: 'bước',
        sensor: 'MPU6050 6-Axis IMU',
        compute: (i) => Math.max(120, 8420 - i * 165),
      },
      {
        key: 'stress',
        name: 'Stress Index (Chỉ số căng thẳng ước tính)',
        unit: '/100',
        sensor: 'ANS Estimator (HR/HRV)',
        compute: (i) => Math.round(29 + Math.sin(i * 0.45) * 9),
      },
    ];

    return Array.from({ length: count }, (_, idx) => {
      const tpl = templates[idx % templates.length];
      const dt = new Date(now - idx * 12 * 60 * 1000);
      return {
        id: `NX-REC-${(9840 - idx).toString().padStart(4, '0')}`,
        timestamp: dt.toISOString(),
        formattedDate: dt.toLocaleDateString('vi-VN'),
        formattedTime: dt.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        metricKey: tpl.key,
        metricName: tpl.name,
        value: tpl.compute(idx),
        unit: tpl.unit,
        sensor: tpl.sensor,
        freshness: 'DEMO',
        packetIntegrity: Math.round((99.2 + (idx % 7) * 0.1) * 10) / 10,
      };
    });
  }

  public getDeviceStatus(lastPacketLabel: string): DeviceStatusInfo {
    const ratio =
      this.totalPackets > 0
        ? Math.round((this.validPackets / this.totalPackets) * 1000) / 10
        : 99.8;

    return {
      deviceName: 'NEXUS Band Pro (Mô phỏng phần cứng)',
      hardwareModel: 'NX-WEAR-ESP32S3-REV2',
      mcuChip: 'ESP32-S3 Dual-Core XTensa LX7 @ 240MHz',
      opticalSensor: 'Maxim MAX30102 (Red 660nm + IR 880nm)',
      imuSensor: 'InvenSense MPU6050 6-Axis Gyro/Accel',
      tempSensor: 'High-Precision Wrist NTC / Die Sensor',
      firmwareVersion: 'v2.4.1-nexus-sim',
      connectionState: 'connected',
      isSimulated: true,
      batteryPercent: this.batteryPercent,
      batteryVoltage: 3.98,
      transportType: 'Wi-Fi REST / WebSocket',
      wifiRssiDbm: -54,
      lastPacketAt: lastPacketLabel,
      validPacketRatio: ratio,
      totalPackets: this.totalPackets,
      samplingRateHz: 50,
      endpointUrl: import.meta.env.VITE_HEALTH_API_URL || '/api/telemetry',
    };
  }

  public getInitialNotifications(): SystemNotification[] {
    return [
      {
        id: 'notif-1',
        title: 'Chế độ DEMO đang hoạt động',
        message:
          'Hệ thống đang hiển thị luồng dữ liệu mô phỏng giới hạn sinh lý để kiểm thử giao diện. Chuyển sang LIVE MODE khi vòng tay ESP32 sẵn sàng.',
        timestamp: 'Vừa xong',
        type: 'info',
        read: false,
      },
      {
        id: 'notif-2',
        title: 'Cổng Telemetry /api/telemetry đã sẵn sàng',
        message:
          'Mạch ESP32 + MAX30102 có thể gửi gói JSON trực tiếp qua HTTP POST tới endpoint /api/telemetry.',
        timestamp: '2 phút trước',
        type: 'telemetry',
        read: false,
      },
      {
        id: 'notif-3',
        title: 'Lưu ý hiệu chuẩn quang học MAX30102',
        message:
          'Sóng hiển thị trên màn hình là sóng quang học PPG (Photoplethysmography), không phải điện tâm đồ ECG y khoa.',
        timestamp: '10 phút trước',
        type: 'warning',
        read: true,
      },
    ];
  }
}

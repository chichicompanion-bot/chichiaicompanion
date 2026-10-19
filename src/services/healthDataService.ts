import {
  DataFreshness,
  DeviceStatusInfo,
  HealthHistoryRecord,
  MetricCardData,
  TelemetryTimeSeriesPoint,
} from '../types/health';
import { estimateStressIndex } from '../utils/chartProcessing';

export interface LiveBackendResponse {
  ok: boolean;
  connected: boolean;
  stale: boolean;
  ageMs: number | null;
  latest: {
    deviceId: string;
    firmware: string;
    timestamp: string;
    heartRate: number;
    spo2: number | null;
    hrv: number | null;
    skinTemp: number | null;
    steps: number | null;
    battery: number | null;
    rssi: number | null;
    ppgWaveform?: number[];
  } | null;
  history: Array<{
    deviceId: string;
    firmware: string;
    timestamp: string;
    heartRate: number;
    spo2: number | null;
    hrv: number | null;
    skinTemp: number | null;
    steps: number | null;
    battery: number | null;
    rssi: number | null;
  }>;
  stats: {
    totalPacketsReceived: number;
    validPacketsCount: number;
    validPacketRatio: number | null;
  };
}

export class LiveHealthDataService {
  private apiUrl: string;
  private timeoutMs: number;

  constructor() {
    this.apiUrl = import.meta.env.VITE_HEALTH_API_URL || '/api/telemetry';
    this.timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 5000;
  }

  public getEndpointUrl(): string {
    return this.apiUrl;
  }

  public async fetchLiveTelemetry(): Promise<{
    device: DeviceStatusInfo;
    metrics: MetricCardData[];
    series: TelemetryTimeSeriesPoint[];
    history: HealthHistoryRecord[];
  }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.apiUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Không thể truy cập cổng telemetry`);
      }

      const data: LiveBackendResponse = await response.json();
      return this.transformResponse(data);
    } catch (err) {
      clearTimeout(timer);
      const message =
        err instanceof Error
          ? err.name === 'AbortError'
            ? 'Timeout kết nối tới cổng ESP32 backend'
            : err.message
          : 'Lỗi mạng không xác định';

      return {
        device: {
          deviceName: 'NEXUS Band Pro (ESP32 Hardware)',
          hardwareModel: 'NX-WEAR-ESP32S3-REV2',
          mcuChip: 'ESP32-S3 Dual-Core @ 240MHz',
          opticalSensor: 'Maxim MAX30102 PPG',
          imuSensor: 'MPU6050 6-Axis IMU',
          tempSensor: 'Wrist NTC Sensor',
          firmwareVersion: 'Chưa xác nhận',
          connectionState: 'disconnected',
          isSimulated: false,
          batteryPercent: null,
          batteryVoltage: null,
          transportType: 'Offline',
          wifiRssiDbm: null,
          lastPacketAt: null,
          validPacketRatio: null,
          totalPackets: 0,
          samplingRateHz: 0,
          endpointUrl: this.apiUrl,
          errorMessage: message,
        },
        metrics: this.buildEmptyOrStaleMetrics(null, 'STALE'),
        series: [],
        history: [],
      };
    }
  }

  /**
   * Sends a real HTTP POST packet to /api/telemetry so the user or developer can verify
   * end-to-end backend telemetry ingestion before flashing the physical ESP32 board.
   */
  public async sendTestHardwarePacket(customPayload?: Partial<{
    heartRate: number;
    spo2: number;
    hrv: number;
    skinTemp: number;
    steps: number;
    battery: number;
    rssi: number;
  }>): Promise<boolean> {
    const payload = {
      deviceId: 'NX-ESP32-MAX30102-REALTIME',
      firmware: 'v2.4.1-esp32s3-ino',
      heartRate: customPayload?.heartRate ?? Math.round(71 + Math.random() * 12),
      spo2: customPayload?.spo2 ?? Math.round((97.8 + Math.random() * 1.4) * 10) / 10,
      hrv: customPayload?.hrv ?? Math.round(58 + Math.random() * 16),
      skinTemp: customPayload?.skinTemp ?? Math.round((36.3 + Math.random() * 0.4) * 10) / 10,
      steps: customPayload?.steps ?? 8540,
      battery: customPayload?.battery ?? 91,
      rssi: customPayload?.rssi ?? -51,
    };

    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  }

  private transformResponse(data: LiveBackendResponse): {
    device: DeviceStatusInfo;
    metrics: MetricCardData[];
    series: TelemetryTimeSeriesPoint[];
    history: HealthHistoryRecord[];
  } {
    const latest = data.latest;
    const isConnected = Boolean(data.connected && latest);
    const freshness: DataFreshness = isConnected ? 'LIVE' : 'STALE';

    const lastPacketTime = latest
      ? new Date(latest.timestamp).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null;

    const device: DeviceStatusInfo = {
      deviceName: latest ? `ESP32 (${latest.deviceId})` : 'NEXUS Band Pro (Chờ gói tin ESP32)',
      hardwareModel: 'ESP32 + MAX30102 + MPU6050',
      mcuChip: 'ESP32 / ESP32-S3 Wi-Fi + BLE SoC',
      opticalSensor: 'MAX30102 Pulse Oximeter & Heart-Rate',
      imuSensor: 'MPU6050 6-Axis Accelerometer',
      tempSensor: 'MAX30102 Die / NTC Thermistor',
      firmwareVersion: latest?.firmware || 'Chưa nhận gói tin',
      connectionState: isConnected ? 'connected' : 'disconnected',
      isSimulated: false,
      batteryPercent: latest?.battery ?? null,
      batteryVoltage: latest?.battery ? Math.round((3.3 + (latest.battery / 100) * 0.9) * 100) / 100 : null,
      transportType: isConnected ? 'Wi-Fi REST / WebSocket' : 'Offline',
      wifiRssiDbm: latest?.rssi ?? null,
      lastPacketAt: lastPacketTime,
      validPacketRatio: data.stats?.validPacketRatio ?? null,
      totalPackets: data.stats?.totalPacketsReceived ?? 0,
      samplingRateHz: isConnected ? 50 : 0,
      endpointUrl: this.apiUrl,
      errorMessage: !latest
        ? 'Chưa nhận được gói dữ liệu nào từ mạch ESP32 trên cổng /api/telemetry.'
        : data.stale
        ? `Gói dữ liệu cuối cùng đã cũ (${Math.round((data.ageMs || 0) / 1000)}s trước). Không hiển thị giá trị cũ như dữ liệu trực tiếp mới nhất.`
        : undefined,
    };

    const rawHistory = Array.isArray(data.history) ? [...data.history].reverse() : [];
    const series: TelemetryTimeSeriesPoint[] = rawHistory.map((item) => {
      const dt = new Date(item.timestamp);
      return {
        timestamp: item.timestamp,
        timeLabel: dt.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        heartRate: item.heartRate,
        spo2: item.spo2,
        hrv: item.hrv,
        skinTemp: item.skinTemp,
        stress: estimateStressIndex(item.heartRate, item.hrv),
      };
    });

    const historyRecords: HealthHistoryRecord[] = [];
    if (Array.isArray(data.history)) {
      data.history.forEach((pkt, idx) => {
        const dt = new Date(pkt.timestamp);
        const dateStr = dt.toLocaleDateString('vi-VN');
        const timeStr = dt.toLocaleTimeString('vi-VN');
        historyRecords.push({
          id: `LIVE-HR-${idx}`,
          timestamp: pkt.timestamp,
          formattedDate: dateStr,
          formattedTime: timeStr,
          metricKey: 'heartRate',
          metricName: 'Heart Rate (ESP32 MAX30102)',
          value: pkt.heartRate,
          unit: 'BPM',
          sensor: pkt.deviceId,
          freshness,
          packetIntegrity: data.stats?.validPacketRatio ?? 100,
        });
        if (pkt.spo2 !== null) {
          historyRecords.push({
            id: `LIVE-SPO2-${idx}`,
            timestamp: pkt.timestamp,
            formattedDate: dateStr,
            formattedTime: timeStr,
            metricKey: 'spo2',
            metricName: 'Blood Oxygen SpO₂ (ESP32)',
            value: pkt.spo2,
            unit: '%',
            sensor: pkt.deviceId,
            freshness,
            packetIntegrity: data.stats?.validPacketRatio ?? 100,
          });
        }
      });
    }

    return {
      device,
      metrics: this.buildEmptyOrStaleMetrics(latest, freshness),
      series,
      history: historyRecords,
    };
  }

  private buildEmptyOrStaleMetrics(
    latest: LiveBackendResponse['latest'],
    freshness: DataFreshness
  ): MetricCardData[] {
    const measuredLabel = latest
      ? new Date(latest.timestamp).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : 'Chưa có gói tin';

    const stress = latest ? estimateStressIndex(latest.heartRate, latest.hrv) : null;

    return [
      {
        key: 'heartRate',
        title: 'HEART RATE',
        vietnameseTitle: 'Nhịp tim thực tế (ESP32)',
        value: latest ? latest.heartRate : null,
        formattedValue: latest ? `${latest.heartRate}` : '--',
        unit: 'BPM',
        deltaPercent: null,
        deltaLabel: latest ? `Gói tin từ ${latest.deviceId}` : 'Đang chờ kết nối mạch ESP32...',
        sensorSource: 'MAX30102 Live Telemetry',
        measuredAt: measuredLabel,
        freshness,
        accentColor: '#FF2E54',
        glowColor: 'rgba(255, 46, 84, 0.28)',
        sparkline: latest ? [{ time: 'now', value: latest.heartRate }] : [],
        note:
          freshness === 'LIVE'
            ? 'Đang nhận trực tiếp từ mạch cảm biến MAX30102.'
            : 'Chưa có gói dữ liệu trực tiếp mới trong 15 giây qua.',
      },
      {
        key: 'spo2',
        title: 'BLOOD OXYGEN',
        vietnameseTitle: 'Độ bão hòa Oxy máu (SpO₂)',
        value: latest?.spo2 ?? null,
        formattedValue: latest?.spo2 !== null && latest?.spo2 !== undefined ? `${latest.spo2}` : '--',
        unit: '%',
        deltaPercent: null,
        deltaLabel: latest?.spo2 ? 'Tỷ lệ Red/IR thực tế' : 'Chờ dữ liệu SpO₂ từ MAX30102',
        sensorSource: 'MAX30102 Live Telemetry',
        measuredAt: measuredLabel,
        freshness,
        accentColor: '#00F0FF',
        glowColor: 'rgba(0, 240, 255, 0.26)',
        sparkline: latest?.spo2 ? [{ time: 'now', value: latest.spo2 }] : [],
        note: 'Chỉ hiển thị khi thiết bị thực sự gửi trường spo2 hợp lệ.',
      },
      {
        key: 'hrv',
        title: 'HRV (RMSSD)',
        vietnameseTitle: 'Biến thiên nhịp tim',
        value: latest?.hrv ?? null,
        formattedValue: latest?.hrv !== null && latest?.hrv !== undefined ? `${latest.hrv}` : '--',
        unit: 'ms',
        deltaPercent: null,
        deltaLabel: latest?.hrv ? 'Đo từ khoảng IBI thực tế' : 'Chờ dữ liệu IBI/HRV từ ESP32',
        sensorSource: 'ESP32 IBI Processor',
        measuredAt: measuredLabel,
        freshness,
        accentColor: '#00E5A3',
        glowColor: 'rgba(0, 229, 163, 0.25)',
        sparkline: latest?.hrv ? [{ time: 'now', value: latest.hrv }] : [],
        note: 'Đòi hỏi mạch gửi khoảng cách giữa các đỉnh nhịp (Inter-Beat Interval).',
      },
      {
        key: 'skinTemp',
        title: 'SKIN TEMPERATURE',
        vietnameseTitle: 'Nhiệt độ bề mặt da',
        value: latest?.skinTemp ?? null,
        formattedValue:
          latest?.skinTemp !== null && latest?.skinTemp !== undefined ? `${latest.skinTemp}` : '--',
        unit: '°C',
        deltaPercent: null,
        deltaLabel: latest?.skinTemp ? 'Đo từ cảm biến nhiệt cổ tay' : 'Chờ dữ liệu nhiệt độ',
        sensorSource: 'NTC / MLX90614 / MAX30102 Die',
        measuredAt: measuredLabel,
        freshness,
        accentColor: '#38BDF8',
        glowColor: 'rgba(56, 189, 248, 0.25)',
        sparkline: latest?.skinTemp ? [{ time: 'now', value: latest.skinTemp }] : [],
        note: 'Chỉ hiển thị khi gói JSON từ ESP32 có trường skinTemp.',
      },
      {
        key: 'steps',
        title: 'STEPS COUNT',
        vietnameseTitle: 'Số bước chân vận động',
        value: latest?.steps ?? null,
        formattedValue:
          latest?.steps !== null && latest?.steps !== undefined
            ? latest.steps.toLocaleString('vi-VN')
            : '--',
        unit: 'bước',
        deltaPercent: null,
        deltaLabel: latest?.steps ? 'Từ cảm biến gia tốc IMU' : 'Chờ dữ liệu MPU6050',
        sensorSource: 'MPU6050 6-Axis IMU',
        measuredAt: measuredLabel,
        freshness,
        accentColor: '#10B981',
        glowColor: 'rgba(16, 185, 129, 0.25)',
        sparkline: latest?.steps ? [{ time: 'now', value: latest.steps }] : [],
        note: 'Yêu cầu module gia tốc kế MPU6050 gửi trường steps.',
      },
      {
        key: 'sleep',
        title: 'SLEEP DURATION',
        vietnameseTitle: 'Thời lượng ngủ thực tế',
        value: null,
        formattedValue: '--',
        unit: 'giờ',
        deltaPercent: null,
        deltaLabel: 'Cần lưu trữ liên tục >= 4 giờ để phân tích giấc ngủ',
        sensorSource: 'Continuous Wearable Log',
        measuredAt: measuredLabel,
        freshness: 'STALE',
        accentColor: '#22D3EE',
        glowColor: 'rgba(34, 211, 238, 0.24)',
        sparkline: [],
        note: 'Trong Live Mode, không tự bịa thời lượng ngủ nếu chưa đủ chuỗi đo liên tục qua đêm.',
      },
      {
        key: 'stress',
        title: 'STRESS INDEX',
        vietnameseTitle: 'Chỉ số tải thần kinh ước tính',
        value: stress,
        formattedValue: stress !== null ? `${stress}` : '--',
        unit: '/ 100',
        deltaPercent: null,
        deltaLabel: stress !== null ? 'Ước tính từ HR & HRV thực' : 'Cần đồng thời cả HR và HRV',
        sensorSource: 'ANS Estimator (HR + HRV)',
        measuredAt: measuredLabel,
        freshness,
        accentColor: '#06B6D4',
        glowColor: 'rgba(6, 182, 212, 0.25)',
        sparkline: stress !== null ? [{ time: 'now', value: stress }] : [],
        note: 'Tính toán tự động khi ESP32 gửi đầy đủ cả nhịp tim (heartRate) và biến thiên nhịp tim (hrv).',
      },
    ];
  }
}

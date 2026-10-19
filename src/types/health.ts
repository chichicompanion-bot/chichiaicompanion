export type DataMode = 'demo' | 'live';

export type DataFreshness = 'LIVE' | 'DEMO' | 'STALE';

export type TimeRange = '1h' | '6h' | '24h' | '7d';

export type NavSection =
  | 'overview'
  | 'live'
  | 'heart'
  | 'activity'
  | 'history'
  | 'device'
  | 'settings';

export type MetricKey =
  | 'heartRate'
  | 'spo2'
  | 'hrv'
  | 'skinTemp'
  | 'steps'
  | 'sleep'
  | 'stress';

export type ChartMetricKey = 'heartRate' | 'spo2' | 'hrv';

export interface MetricSparkPoint {
  time: string;
  value: number;
}

export interface MetricCardData {
  key: MetricKey;
  title: string;
  vietnameseTitle: string;
  value: number | null;
  formattedValue: string;
  unit: string;
  deltaPercent: number | null;
  deltaLabel: string;
  sensorSource: string;
  measuredAt: string;
  freshness: DataFreshness;
  accentColor: string;
  glowColor: string;
  sparkline: MetricSparkPoint[];
  note: string;
}

export interface TelemetryTimeSeriesPoint {
  timestamp: string;
  timeLabel: string;
  heartRate: number | null;
  spo2: number | null;
  hrv: number | null;
  skinTemp: number | null;
  stress: number | null;
}

export interface PPGWavePoint {
  index: number;
  timeMs: number;
  irSignal: number;
  redSignal: number;
}

export interface ActivityRingItem {
  id: 'move' | 'exercise' | 'stand';
  label: string;
  vietnameseLabel: string;
  current: number;
  goal: number;
  unit: string;
  percentage: number;
  colorStart: string;
  colorEnd: string;
  description: string;
}

export interface SleepStageSegment {
  time: string;
  stage: 'Awake' | 'REM' | 'Light' | 'Deep';
  stageLevel: number; // 4: Awake, 3: REM, 2: Light, 1: Deep
  durationMinutes: number;
  heartRateAvg: number;
}

export interface SleepSummaryData {
  totalMinutes: number;
  formattedTotal: string;
  efficiencyPercent: number;
  isDemoOrEstimated: boolean;
  estimationMethod: string;
  stages: {
    awakeMinutes: number;
    lightMinutes: number;
    deepMinutes: number;
    remMinutes: number;
  };
  timeline: SleepStageSegment[];
}

export interface HealthHistoryRecord {
  id: string;
  timestamp: string;
  formattedDate: string;
  formattedTime: string;
  metricKey: MetricKey;
  metricName: string;
  value: number;
  unit: string;
  sensor: string;
  freshness: DataFreshness;
  packetIntegrity: number;
}

export interface DeviceStatusInfo {
  deviceName: string;
  hardwareModel: string;
  mcuChip: string;
  opticalSensor: string;
  imuSensor: string;
  tempSensor: string;
  firmwareVersion: string;
  connectionState: 'connected' | 'connecting' | 'disconnected' | 'error';
  isSimulated: boolean;
  batteryPercent: number | null;
  batteryVoltage: number | null;
  transportType: 'Wi-Fi REST / WebSocket' | 'BLE Gatt Bridge' | 'Offline';
  wifiRssiDbm: number | null;
  lastPacketAt: string | null;
  validPacketRatio: number | null;
  totalPackets: number;
  samplingRateHz: number;
  endpointUrl: string;
  errorMessage?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'warning' | 'telemetry';
  read: boolean;
}

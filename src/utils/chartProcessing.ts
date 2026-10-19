import { HealthHistoryRecord, TelemetryTimeSeriesPoint } from '../types/health';

/**
 * Estimates a bounded non-diagnostic Stress Index (0-100) from Heart Rate (BPM)
 * and HRV RMSSD (ms), inspired by autonomic nervous system sympathetic/parasympathetic balance.
 * Explicitly documented as an algorithmic estimation, not a clinical diagnosis.
 */
export function estimateStressIndex(heartRate: number | null, hrvRmssd: number | null): number | null {
  if (heartRate === null || hrvRmssd === null || hrvRmssd <= 0) return null;
  const normalizedHr = Math.max(0, Math.min(1, (heartRate - 55) / 65));
  const normalizedHrv = Math.max(0, Math.min(1, (85 - hrvRmssd) / 65));
  const score = Math.round((normalizedHr * 0.45 + normalizedHrv * 0.55) * 100);
  return Math.max(8, Math.min(95, score));
}

export function calculateSeriesStats(
  series: TelemetryTimeSeriesPoint[],
  key: 'heartRate' | 'spo2' | 'hrv'
): { min: number | null; max: number | null; avg: number | null; latest: number | null } {
  const valid = series
    .map((pt) => pt[key])
    .filter((v): v is number => v !== null && !Number.isNaN(v));

  if (valid.length === 0) {
    return { min: null, max: null, avg: null, latest: null };
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const sum = valid.reduce((acc, cur) => acc + cur, 0);
  const avg = Math.round((sum / valid.length) * 10) / 10;
  const latest = valid[valid.length - 1];

  return { min, max, avg, latest };
}

export function exportHistoryToCSV(records: HealthHistoryRecord[], modeLabel: string): void {
  if (records.length === 0) return;

  const headers = [
    'Record ID',
    'Timestamp (ISO)',
    'Date',
    'Time',
    'Metric',
    'Value',
    'Unit',
    'Sensor Hardware',
    'Data Status',
    'Packet Integrity (%)',
  ];

  const rows = records.map((r) => [
    r.id,
    r.timestamp,
    r.formattedDate,
    r.formattedTime,
    `"${r.metricName.replace(/"/g, '""')}"`,
    r.value,
    r.unit,
    `"${r.sensor.replace(/"/g, '""')}"`,
    r.freshness,
    r.packetIntegrity,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestampSlug = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.href = url;
  link.setAttribute('download', `nexus-health-telemetry-${modeLabel.toLowerCase()}-${timestampSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

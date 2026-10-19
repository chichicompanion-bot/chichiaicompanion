import React, { useState } from 'react';
import {
  Cpu,
  BatteryCharging,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Code2,
  Copy,
  Check,
  Send,
} from 'lucide-react';
import { DataMode, DeviceStatusInfo } from '../types/health';

interface DeviceStatusPanelProps {
  device: DeviceStatusInfo;
  dataMode: DataMode;
  onReconnect: () => Promise<void>;
  onSendTestPacket: () => Promise<void>;
}

const ESP32_FIRMWARE_SNIPPET = `// Sketch mẫu cho ESP32 + MAX30102 gửi dữ liệu thật lên NEXUS HEALTH
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL = "https://chichiaicompanion.com/api/telemetry";

void sendHealthPacket(float bpm, float spo2, int hrvMs, float skinTemp, int steps, int battery) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  String payload = "{";
  payload += "\\"deviceId\\":\\"NX-ESP32S3-BAND01\\",";
  payload += "\\"firmware\\":\\"v2.4.1-esp32\\",";
  payload += "\\"heartRate\\":" + String(bpm, 1) + ",";
  payload += "\\"spo2\\":" + String(spo2, 1) + ",";
  payload += "\\"hrv\\":" + String(hrvMs) + ",";
  payload += "\\"skinTemp\\":" + String(skinTemp, 1) + ",";
  payload += "\\"steps\\":" + String(steps) + ",";
  payload += "\\"battery\\":" + String(battery) + ",";
  payload += "\\"rssi\\":" + String(WiFi.RSSI());
  payload += "}";

  int httpCode = http.POST(payload);
  http.end();
}`;

export const DeviceStatusPanel: React.FC<DeviceStatusPanelProps> = ({
  device,
  dataMode,
  onReconnect,
  onSendTestPacket,
}) => {
  const [reconnecting, setReconnecting] = useState(false);
  const [sendingPacket, setSendingPacket] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = device.connectionState === 'connected';

  const handleReconnectClick = async () => {
    setReconnecting(true);
    try {
      await onReconnect();
    } finally {
      setTimeout(() => setReconnecting(false), 450);
    }
  };

  const handleTestPacketClick = async () => {
    setSendingPacket(true);
    try {
      await onSendTestPacket();
    } finally {
      setSendingPacket(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(ESP32_FIRMWARE_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl nexus-glass p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg">{device.deviceName}</h3>
            <p className="text-xs font-mono-tech text-slate-400">
              {device.mcuChip} • {device.opticalSensor}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono-tech font-semibold border ${
            isConnected
              ? dataMode === 'demo'
                ? 'bg-amber-500/15 text-amber-300 border-amber-400/40'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
              : 'bg-rose-500/15 text-rose-300 border-rose-400/40'
          }`}
        >
          {isConnected ? (
            <CheckCircle2 className="w-3.5 h-3.5" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" />
          )}
          {isConnected
            ? dataMode === 'demo'
              ? 'Simulated Link Active'
              : 'ESP32 Hardware Connected'
            : 'Disconnected'}
        </span>
      </div>

      {/* Error / Status Banner in Live Mode */}
      {device.errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-400/30 text-xs text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold">Thông báo trạng thái kết nối phần cứng:</div>
            <div className="text-rose-200/80">{device.errorMessage}</div>
          </div>
        </div>
      )}

      {/* Telemetry Specs Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-900/65 border border-slate-800/80 space-y-1">
          <div className="text-slate-400 font-mono-tech text-[11px] flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            <span>DUNG LƯỢNG PIN</span>
          </div>
          <div className="font-mono-tech font-bold text-base text-white">
            {device.batteryPercent !== null
              ? `${device.batteryPercent}% (${device.batteryVoltage}V)`
              : 'Chưa gửi dữ liệu pin'}
          </div>
          <div className="text-[10px] text-slate-400">
            {device.isSimulated ? 'Giá trị pin mô phỏng (DEMO)' : 'Từ cảm biến ADC pin LiPo'}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/65 border border-slate-800/80 space-y-1">
          <div className="text-slate-400 font-mono-tech text-[11px] flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-cyan-400" />
            <span>GIAO THỨC & TÍN HIỆU</span>
          </div>
          <div className="font-mono-tech font-bold text-base text-white">
            {device.wifiRssiDbm !== null ? `${device.wifiRssiDbm} dBm` : device.transportType}
          </div>
          <div className="text-[10px] text-slate-400 truncate">
            Endpoint: {device.endpointUrl}
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/65 border border-slate-800/80 space-y-1">
          <div className="text-slate-400 font-mono-tech text-[11px]">GÓI TIN HỢP LỆ</div>
          <div className="font-mono-tech font-bold text-base text-emerald-300">
            {device.validPacketRatio !== null ? `${device.validPacketRatio}%` : '--'}
          </div>
          <div className="text-[10px] text-slate-400">
            Tổng nhận: {device.totalPackets} gói • Cuối: {device.lastPacketAt || '--'}
          </div>
        </div>
      </div>

      {/* Action Buttons: Reconnect, Send Test Packet, Show Firmware Code */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={handleReconnectClick}
          disabled={reconnecting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-mono-tech font-semibold transition-all cursor-pointer active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
          <span>
            {reconnecting
              ? 'Đang kiểm tra cổng Backend...'
              : dataMode === 'live'
              ? 'Kết nối lại / Kiểm tra cổng ESP32'
              : 'Đồng bộ lại luồng Demo'}
          </span>
        </button>

        <button
          type="button"
          onClick={handleTestPacketClick}
          disabled={sendingPacket}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-mono-tech font-semibold transition-all cursor-pointer active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
          <span>
            {sendingPacket ? 'Đang truyền gói tin...' : 'Bắn gói JSON thử nghiệm vào /api/telemetry'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setShowCode((s) => !s)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono-tech transition-all cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>{showCode ? 'Ẩn code nạp ESP32' : 'Xem code C++ nạp cho ESP32'}</span>
        </button>
      </div>

      {/* Collapsible Arduino/ESP32 Firmware Snippet */}
      {showCode && (
        <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono-tech text-cyan-300">
              ESP32_MAX30102_NexusHealth.ino (HTTP POST JSON)
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono-tech text-slate-200 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Đã sao chép' : 'Copy Code'}</span>
            </button>
          </div>
          <pre className="text-[11px] font-mono-tech text-slate-300 overflow-x-auto leading-relaxed">
            {ESP32_FIRMWARE_SNIPPET}
          </pre>
        </div>
      )}
    </div>
  );
};

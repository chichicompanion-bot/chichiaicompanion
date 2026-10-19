// NEXUS HEALTH — Real ESP32 + MAX30102 Telemetry Serverless Endpoint
// Supports:
//   POST /api/telemetry -> Receive real sensor JSON packet from ESP32 wearable
//   GET  /api/telemetry -> Poll latest verified telemetry state for Live Mode frontend

let latestPacket = null;
let packetHistory = [];
let totalPacketsReceived = 0;
let validPacketsCount = 0;

function validatePacket(body) {
  if (!body || typeof body !== 'object') return { valid: false, reason: 'Payload must be a JSON object' };
  const hr = Number(body.heartRate ?? body.bpm);
  const spo2 = Number(body.spo2 ?? body.bloodOxygen);
  if (Number.isNaN(hr) || hr < 25 || hr > 240) {
    return { valid: false, reason: 'Invalid heartRate (expected 25-240 BPM from MAX30102)' };
  }
  if (!Number.isNaN(spo2) && (spo2 < 50 || spo2 > 100)) {
    return { valid: false, reason: 'Invalid SpO2 (expected 50-100%)' };
  }
  return { valid: true };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    totalPacketsReceived += 1;
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const check = validatePacket(body);

    if (!check.valid) {
      return res.status(400).json({
        ok: false,
        error: check.reason,
        validPacketRatio: totalPacketsReceived > 0 ? Math.round((validPacketsCount / totalPacketsReceived) * 1000) / 10 : 100,
      });
    }

    validPacketsCount += 1;
    const now = new Date().toISOString();
    const normalized = {
      deviceId: String(body.deviceId || 'NX-ESP32-MAX30102'),
      firmware: String(body.firmware || 'v2.4.1-esp32s3'),
      timestamp: now,
      heartRate: Math.round(Number(body.heartRate ?? body.bpm) * 10) / 10,
      spo2: body.spo2 !== undefined ? Math.round(Number(body.spo2) * 10) / 10 : null,
      hrv: body.hrv !== undefined ? Math.round(Number(body.hrv)) : null,
      skinTemp: body.skinTemp !== undefined ? Math.round(Number(body.skinTemp) * 10) / 10 : null,
      steps: body.steps !== undefined ? Math.round(Number(body.steps)) : null,
      battery: body.battery !== undefined ? Math.round(Number(body.battery)) : null,
      rssi: body.rssi !== undefined ? Math.round(Number(body.rssi)) : null,
      ppgWaveform: Array.isArray(body.ppgWaveform) ? body.ppgWaveform.slice(0, 60) : [],
    };

    latestPacket = normalized;
    packetHistory.unshift(normalized);
    if (packetHistory.length > 200) packetHistory.pop();

    return res.status(200).json({
      ok: true,
      receivedAt: now,
      validPacketRatio: Math.round((validPacketsCount / totalPacketsReceived) * 1000) / 10,
    });
  }

  if (req.method === 'GET') {
    const nowMs = Date.now();
    const lastMs = latestPacket ? new Date(latestPacket.timestamp).getTime() : 0;
    const ageMs = latestPacket ? nowMs - lastMs : null;
    // Consider hardware actually connected only if a valid packet arrived within the last 15 seconds
    const isLiveConnected = Boolean(latestPacket && ageMs !== null && ageMs <= 15000);

    return res.status(200).json({
      ok: true,
      connected: isLiveConnected,
      stale: Boolean(latestPacket && ageMs !== null && ageMs > 15000),
      ageMs,
      latest: latestPacket,
      history: packetHistory.slice(0, 50),
      stats: {
        totalPacketsReceived,
        validPacketsCount,
        validPacketRatio:
          totalPacketsReceived > 0
            ? Math.round((validPacketsCount / totalPacketsReceived) * 1000) / 10
            : null,
      },
    });
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

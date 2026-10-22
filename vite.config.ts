import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function localTelemetryApiPlugin(): Plugin {
  let latestPacket: Record<string, unknown> | null = null;
  const packetHistory: Record<string, unknown>[] = [];
  let totalPacketsReceived = 0;
  let validPacketsCount = 0;

  return {
    name: 'nexus-local-telemetry-api',
    configureServer(server) {
      server.middlewares.use('/api/telemetry', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });
          req.on('end', () => {
            totalPacketsReceived += 1;
            try {
              const body = JSON.parse(bodyStr || '{}');
              const hr = Number(body.heartRate ?? body.bpm);
              if (Number.isNaN(hr) || hr < 25 || hr > 240) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: 'Invalid heartRate (25-240 BPM)' }));
                return;
              }
              validPacketsCount += 1;
              const now = new Date().toISOString();
              const normalized = {
                deviceId: String(body.deviceId || 'NX-ESP32-MAX30102'),
                firmware: String(body.firmware || 'v2.4.1-esp32s3'),
                timestamp: now,
                heartRate: Math.round(hr * 10) / 10,
                spo2: body.spo2 !== undefined ? Math.round(Number(body.spo2) * 10) / 10 : null,
                hrv: body.hrv !== undefined ? Math.round(Number(body.hrv)) : null,
                skinTemp: body.skinTemp !== undefined ? Math.round(Number(body.skinTemp) * 10) / 10 : null,
                steps: body.steps !== undefined ? Math.round(Number(body.steps)) : null,
                battery: body.battery !== undefined ? Math.round(Number(body.battery)) : null,
                rssi: body.rssi !== undefined ? Math.round(Number(body.rssi)) : null,
              };
              latestPacket = normalized;
              packetHistory.unshift(normalized);
              if (packetHistory.length > 200) packetHistory.pop();

              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  ok: true,
                  receivedAt: now,
                  validPacketRatio: Math.round((validPacketsCount / totalPacketsReceived) * 1000) / 10,
                })
              );
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Invalid JSON payload' }));
            }
          });
          return;
        }

        if (req.method === 'GET') {
          const nowMs = Date.now();
          const lastMs = latestPacket ? new Date(String(latestPacket.timestamp)).getTime() : 0;
          const ageMs = latestPacket ? nowMs - lastMs : null;
          const isLiveConnected = Boolean(latestPacket && ageMs !== null && ageMs <= 15000);

          res.statusCode = 200;
          res.end(
            JSON.stringify({
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
            })
          );
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), localTelemetryApiPlugin()],
  build: {
    outDir: 'web',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          vendor: ['react', 'react-dom', 'framer-motion'],
          charts: ['recharts'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});

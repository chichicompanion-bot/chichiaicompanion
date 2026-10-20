import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DataMode,
  DeviceStatus,
  MetricCardData,
  MetricKey,
  TelemetryTimeSeriesPoint,
  WaveformSample,
} from '../types/health';
import { FloatingHeartChartsHUD } from './FloatingHeartChartsHUD';

interface BiomedicalHeartCommandCenterProps {
  metrics: MetricCardData[];
  series: TelemetryTimeSeriesPoint[];
  deviceStatus: DeviceStatus;
  dataMode: DataMode;
  ppgWave: WaveformSample[];
  reducedMotion: boolean;
  isLightMode: boolean;
  onSelectMetricModal: (key: MetricKey) => void;
  onSwitchDataMode: (mode: DataMode) => void;
}

type AnatomicalGroupName =
  | 'Myocardium'
  | 'Aorta'
  | 'PulmonaryArtery'
  | 'PulmonaryVeins'
  | 'VenaCava'
  | 'CoronaryArteries'
  | 'CardiacVeins';

interface LoadedHeartGeometry {
  positions: Float32Array; // length = numVerts * 3
  normals: Float32Array; // length = numVerts * 3
  vertexGroup: Uint8Array; // 0..6 per vertex
  vertexAO: Float32Array; // 0.4..1.0 ambient occlusion per vertex
  indices: Uint32Array; // length = numTris * 3
}

interface OrbitalParticle3D {
  angle: number;
  radius: number;
  speed: number;
  tiltX: number;
  tiltZ: number;
  size: number;
  isCyan: boolean;
}

const GROUP_IDS: Record<AnatomicalGroupName, number> = {
  Myocardium: 0,
  Aorta: 1,
  PulmonaryArtery: 2,
  PulmonaryVeins: 3,
  VenaCava: 4,
  CoronaryArteries: 5,
  CardiacVeins: 6,
};

/**
 * Evaluates a physiological "lub-dub" cardiac contraction curve for phase in [0, 1).
 */
function evaluateCardiacCycle(phase: number): {
  ventricularPulse: number;
  atrialPulse: number;
  arterialWave: number;
  shockwavePhase: number;
  phaseLabel: string;
} {
  const p = ((phase % 1) + 1) % 1;

  // Atrial contraction ("lub" preparation): peaks at p = 0.10
  const atrialDiff = (p - 0.1) / 0.048;
  const atrialPulse = Math.exp(-atrialDiff * atrialDiff);

  // Primary ventricular systole ("LUB" S1 peak): sharp rise around p = 0.21
  const sysDiff = (p - 0.21) / 0.054;
  const primarySystole = Math.exp(-sysDiff * sysDiff);

  // Secondary aortic valve closure / dicrotic notch ("DUB" S2 peak): around p = 0.34
  const dubDiff = (p - 0.34) / 0.05;
  const secondaryDub = 0.52 * Math.exp(-dubDiff * dubDiff);

  // Arterial expansion wave in Aorta & Pulmonary Trunk (slightly delayed after ventricular ejection)
  const artDiff = (p - 0.26) / 0.065;
  const arterialWave = Math.exp(-artDiff * artDiff);

  const ventricularPulse = Math.min(1, primarySystole + secondaryDub);
  const shockwavePhase = p >= 0.18 && p <= 0.92 ? (p - 0.18) / 0.74 : 0;

  let phaseLabel = 'DIASTOLE (THƯ GIÃN TÂM TRƯƠNG)';
  if (p >= 0.05 && p < 0.15) {
    phaseLabel = 'ATRIAL SYSTOLE (TÂM NHĨ CO)';
  } else if (p >= 0.15 && p < 0.29) {
    phaseLabel = 'VENTRICULAR SYSTOLE • LUB (S1)';
  } else if (p >= 0.29 && p < 0.42) {
    phaseLabel = 'DICROTIC RECOIL • DUB (S2)';
  }

  return { ventricularPulse, atrialPulse, arterialWave, shockwavePhase, phaseLabel };
}

/**
 * Parses our binary glTF 2.0 (`public/models/anatomical_heart.glb`) built from
 * BodyParts3D anatomical cardiac meshes into flat typed arrays for ultra-fast rendering.
 */
async function loadAnatomicalHeartGlb(url: string): Promise<LoadedHeartGeometry> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch anatomical heart GLB: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const view = new DataView(arrayBuffer);

  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) {
    throw new Error('Invalid GLB magic header');
  }

  const jsonChunkLength = view.getUint32(12, true);
  const jsonChunkType = view.getUint32(16, true);
  if (jsonChunkType !== 0x4e4f534a) {
    throw new Error('Expected GLB JSON chunk');
  }

  const jsonBytes = new Uint8Array(arrayBuffer, 20, jsonChunkLength);
  const gltf = JSON.parse(new TextDecoder().decode(jsonBytes));

  const binHeaderOffset = 20 + jsonChunkLength;
  const binByteOffset = binHeaderOffset + 8;

  let totalVerts = 0;
  let totalIndices = 0;

  interface ParsedMeshPart {
    groupId: number;
    pos: Float32Array;
    nrm: Float32Array;
    idx: Uint16Array | Uint32Array;
  }

  const parts: ParsedMeshPart[] = [];

  for (const mesh of gltf.meshes) {
    const groupName = (mesh.name as AnatomicalGroupName) || 'Myocardium';
    const groupId = GROUP_IDS[groupName] ?? 0;

    for (const prim of mesh.primitives) {
      const posAcc = gltf.accessors[prim.attributes.POSITION];
      const nrmAcc = gltf.accessors[prim.attributes.NORMAL];
      const idxAcc = gltf.accessors[prim.indices];

      const posBV = gltf.bufferViews[posAcc.bufferView];
      const nrmBV = gltf.bufferViews[nrmAcc.bufferView];
      const idxBV = gltf.bufferViews[idxAcc.bufferView];

      const pos = new Float32Array(
        arrayBuffer,
        binByteOffset + (posBV.byteOffset || 0) + (posAcc.byteOffset || 0),
        posAcc.count * 3
      );
      const nrm = new Float32Array(
        arrayBuffer,
        binByteOffset + (nrmBV.byteOffset || 0) + (nrmAcc.byteOffset || 0),
        nrmAcc.count * 3
      );

      const idx =
        idxAcc.componentType === 5123
          ? new Uint16Array(
              arrayBuffer,
              binByteOffset + (idxBV.byteOffset || 0) + (idxAcc.byteOffset || 0),
              idxAcc.count
            )
          : new Uint32Array(
              arrayBuffer,
              binByteOffset + (idxBV.byteOffset || 0) + (idxAcc.byteOffset || 0),
              idxAcc.count
            );

      parts.push({ groupId, pos, nrm, idx });
      totalVerts += posAcc.count;
      totalIndices += idxAcc.count;
    }
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const vertexGroup = new Uint8Array(totalVerts);
  const vertexAO = new Float32Array(totalVerts);
  const indices = new Uint32Array(totalIndices);

  let vOffset = 0;
  let iOffset = 0;

  for (const part of parts) {
    positions.set(part.pos, vOffset * 3);
    normals.set(part.nrm, vOffset * 3);
    const vCount = part.pos.length / 3;

    for (let i = 0; i < vCount; i++) {
      const vi = vOffset + i;
      vertexGroup[vi] = part.groupId;

      const x = part.pos[i * 3];
      const y = part.pos[i * 3 + 1];
      const z = part.pos[i * 3 + 2];
      const nx = part.nrm[i * 3];
      const ny = part.nrm[i * 3 + 1];
      const nz = part.nrm[i * 3 + 2];

      // Compute radial outward alignment for natural crevice/sulcus ambient occlusion
      const rLen = Math.hypot(x, y, z) || 1;
      const radialDot = (x * nx + y * ny + z * nz) / rLen;
      const baseAO = 0.58 + 0.42 * Math.max(0, Math.min(1, (radialDot + 0.35) / 1.15));
      vertexAO[vi] = baseAO;
    }

    for (let j = 0; j < part.idx.length; j++) {
      indices[iOffset + j] = part.idx[j] + vOffset;
    }

    vOffset += vCount;
    iOffset += part.idx.length;
  }

  return { positions, normals, vertexGroup, vertexAO, indices };
}

let cachedHeartGeometryPromise: Promise<LoadedHeartGeometry> | null = null;

export const BiomedicalHeartCommandCenter: React.FC<BiomedicalHeartCommandCenterProps> = ({
  metrics,
  series,
  deviceStatus,
  dataMode,
  ppgWave,
  reducedMotion,
  onSelectMetricModal,
  onSwitchDataMode,
}) => {
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  // Open the 4 floating glass charts by default so the exact reference composition is immediately visible,
  // and allow right-clicking the 3D heart (or clicking the bottom prompt) to toggle them closed/open.
  const [floatingChartsOpen, setFloatingChartsOpen] = useState(true);
  const [cardiacPhaseLabel, setCardiacPhaseLabel] = useState('VENTRICULAR SYSTOLE • LUB (S1)');
  const [displayedSmoothedBpm, setDisplayedSmoothedBpm] = useState<number>(74);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  // Extract metrics
  const heartMetric = useMemo(
    () => metrics.find((m) => m.key === 'heartRate'),
    [metrics]
  );

  const isLiveValid =
    dataMode === 'live' &&
    deviceStatus.connectionState === 'connected' &&
    !deviceStatus.isSimulated &&
    heartMetric?.value !== null &&
    (heartMetric?.value ?? 0) > 30;

  const rawTargetBpm =
    dataMode === 'demo'
      ? heartMetric?.value ?? 74
      : isLiveValid
      ? heartMetric?.value ?? 72
      : 60;

  const statusBadge = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        code: 'DEMO SIMULATION',
        sub: 'Đồng bộ BPM mô phỏng sinh học',
        colorClass: 'text-amber-300 border-amber-400/40 bg-amber-500/15',
        dotClass: 'bg-amber-400',
      };
    }
    if (isLiveValid) {
      return {
        code: 'CONNECTED • LIVE ESP32',
        sub: 'Đồng bộ BPM thực từ MAX30102',
        colorClass: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/15',
        dotClass: 'bg-emerald-400',
      };
    }
    if (deviceStatus.connectionState === 'reconnecting') {
      return {
        code: 'STALE / RECONNECTING',
        sub: 'Đang chờ gói tin mới từ mạch...',
        colorClass: 'text-amber-300 border-amber-400/40 bg-amber-500/15',
        dotClass: 'bg-amber-400',
      };
    }
    return {
      code: 'DISCONNECTED • STANDBY',
      sub: 'Chưa có dữ liệu thực — Nhịp chờ 60 BPM',
      colorClass: 'text-rose-300 border-rose-400/40 bg-rose-500/15',
      dotClass: 'bg-rose-400',
    };
  }, [dataMode, isLiveValid, deviceStatus.connectionState]);

  const signalQualityInfo = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        value: '98.4%',
        detail: `PPG Optical Lock • RSSI ${deviceStatus.wifiRssi ?? -54} dBm`,
      };
    }
    if (isLiveValid && deviceStatus.wifiRssi !== null) {
      const rssi = deviceStatus.wifiRssi;
      const pct = Math.max(10, Math.min(100, Math.round(100 + (rssi + 45) * 1.2)));
      return {
        value: `${pct}%`,
        detail: `ESP32 Wi-Fi RSSI ${rssi} dBm`,
      };
    }
    return {
      value: 'N/A',
      detail: 'Chưa nhận tín hiệu từ cảm biến',
    };
  }, [dataMode, isLiveValid, deviceStatus.wifiRssi]);

  // Refs synced into the single rAF loop
  const targetBpmRef = useRef<number>(rawTargetBpm);
  const smoothedBpmRef = useRef<number>(rawTargetBpm);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const resetCameraTriggerRef = useRef<boolean>(false);
  const rightClickWavePhaseRef = useRef<number>(0);

  useEffect(() => {
    targetBpmRef.current = rawTargetBpm;
  }, [rawTargetBpm]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  // Trigger right-click cyan activation shockwave & toggle 4 floating charts
  const handleToggleFloatingCharts = useCallback(() => {
    rightClickWavePhaseRef.current = 0.01;
    setFloatingChartsOpen((prev) => !prev);
  }, []);

  // Build SVG path for mini PPG waveform in bottom-right HUD pill
  const ppgPath = useMemo(() => {
    if (!ppgWave || ppgWave.length < 2) return '';
    const w = 150;
    const h = 28;
    const vals = ppgWave.map((p) => p.opticalIr);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    return ppgWave
      .map((pt, idx) => {
        const x = (idx / (ppgWave.length - 1)) * w;
        const y = h - ((pt.opticalIr - min) / span) * (h - 6) - 3;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [ppgWave]);

  // Load BodyParts3D anatomical_heart.glb and run Per-Pixel Smooth Phong + Subsurface Scattering 3D Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;
    let geometry: LoadedHeartGeometry | null = null;

    // Pre-allocated vertex transformation buffers (populated once GLB loads)
    let txArr = new Float32Array(0);
    let tyArr = new Float32Array(0);
    let tzArr = new Float32Array(0);
    let nxArr = new Float32Array(0);
    let nyArr = new Float32Array(0);
    let nzArr = new Float32Array(0);
    let crArr = new Float32Array(0);
    let cgArr = new Float32Array(0);
    let cbArr = new Float32Array(0);

    if (!cachedHeartGeometryPromise) {
      cachedHeartGeometryPromise = loadAnatomicalHeartGlb('./models/anatomical_heart.glb');
    }

    cachedHeartGeometryPromise
      .then((loaded) => {
        if (isCancelled) return;
        geometry = loaded;
        const numVerts = loaded.positions.length / 3;
        txArr = new Float32Array(numVerts);
        tyArr = new Float32Array(numVerts);
        tzArr = new Float32Array(numVerts);
        nxArr = new Float32Array(numVerts);
        nyArr = new Float32Array(numVerts);
        nzArr = new Float32Array(numVerts);
        crArr = new Float32Array(numVerts);
        cgArr = new Float32Array(numVerts);
        cbArr = new Float32Array(numVerts);
        setModelLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load anatomical_heart.glb:', err);
      });

    // Offscreen Z-buffer & pixel buffer for real 3D anatomical heart rendering
    const BUF_W = 440;
    const BUF_H = 440;
    const offscreen = document.createElement('canvas');
    offscreen.width = BUF_W;
    offscreen.height = BUF_H;
    const offCtx = offscreen.getContext('2d');
    const imgData = offCtx ? offCtx.createImageData(BUF_W, BUF_H) : null;
    const pixelBuf32 = imgData ? new Uint32Array(imgData.data.buffer) : null;
    const zBuffer = new Float32Array(BUF_W * BUF_H);

    // 48 3D orbital particles around the heart
    const orbitalParticles: OrbitalParticle3D[] = Array.from({ length: 48 }, (_, i) => ({
      angle: (i / 48) * Math.PI * 2,
      radius: 1.48 + (i % 4) * 0.14,
      speed: (0.28 + (i % 5) * 0.07) * (i % 2 === 0 ? 1 : -1),
      tiltX: (i % 3 === 0 ? 0.42 : i % 3 === 1 ? -0.36 : 0.14),
      tiltZ: (i % 2 === 0 ? 0.18 : -0.22),
      size: 1.4 + (i % 3) * 0.7,
      isCyan: i % 5 !== 0,
    }));

    // Interactive camera orbit state
    let rotY = -0.18;
    let rotX = 0.08;
    let targetRotX = 0.08;
    let zoom = 1.0;
    let targetZoom = 1.0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only left-click drags; right-click toggles floating HUD charts
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
      rotY += dx * 0.0085;
      targetRotX = Math.max(-0.48, Math.min(0.52, targetRotX + dy * 0.0065));
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZoom = Math.max(0.84, Math.min(1.28, targetZoom - e.deltaY * 0.0008));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let animId = 0;
    let lastTime = performance.now();
    let beatPhase = 0;
    let lastUiSyncTime = 0;

    // Normalized 3-point biomedical studio lighting vectors
    // Key light: warm front-top-left studio light
    const L1x = -0.44,
      L1y = 0.56,
      L1z = 0.7;
    // Half-vector H1 for Key Light + View (0, 0, 1)
    const H1Len = Math.hypot(L1x, L1y, L1z + 1);
    const H1x = L1x / H1Len,
      H1y = L1y / H1Len,
      H1z = (L1z + 1) / H1Len;

    // Fill/Rim light: cool cyan right-side laboratory rim light
    const L2x = 0.78,
      L2y = 0.18,
      L2z = 0.6;
    const H2Len = Math.hypot(L2x, L2y, L2z + 1);
    const H2x = L2x / H2Len,
      H2y = L2y / H2Len,
      H2z = (L2z + 1) / H2Len;

    // Bottom pedestal cyan uplight
    const L3x = 0.0,
      L3y = -0.92,
      L3z = 0.39;

    const renderFrame = (now: number) => {
      if (isCancelled) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (resetCameraTriggerRef.current) {
        resetCameraTriggerRef.current = false;
        rotY = -0.18;
        targetRotX = 0.08;
        targetZoom = 1.0;
      }

      // Smooth BPM interpolation
      const targetBpm = Math.max(42, Math.min(195, targetBpmRef.current));
      smoothedBpmRef.current += (targetBpm - smoothedBpmRef.current) * Math.min(1, dt * 4.0);
      const currentBpm = smoothedBpmRef.current;

      // Advance cardiac cycle phase
      const beatsPerSec = currentBpm / 60;
      beatPhase = (beatPhase + dt * beatsPerSec) % 1;
      const { ventricularPulse, atrialPulse, arterialWave, shockwavePhase, phaseLabel } =
        evaluateCardiacCycle(beatPhase);

      // Advance right-click activation wave if active
      if (rightClickWavePhaseRef.current > 0) {
        rightClickWavePhaseRef.current += dt * 1.45;
        if (rightClickWavePhaseRef.current > 1) {
          rightClickWavePhaseRef.current = 0;
        }
      }

      if (now - lastUiSyncTime > 240) {
        lastUiSyncTime = now;
        setCardiacPhaseLabel(phaseLabel);
        setDisplayedSmoothedBpm(Math.round(currentBpm));
      }

      // Continuous 360-degree Y-axis rotation (~25 seconds per full turn)
      if (!isDragging && autoRotateRef.current && !reducedMotionRef.current) {
        rotY += dt * ((Math.PI * 2) / 25.0);
      }
      rotX += (targetRotX - rotX) * Math.min(1, dt * 7);
      zoom += (targetZoom - zoom) * Math.min(1, dt * 7);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const cw = Math.max(300, Math.floor(rect.width));
      const ch = Math.max(300, Math.floor(rect.height));
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw * 0.5;
      const cy = ch * 0.47;
      const baseScale = Math.min(cw, ch) * 0.255 * zoom;

      // --- 1. VOLUMETRIC BIOMEDICAL STAGE LIGHTING & HOLOGRAPHIC EMITTER PEDESTAL ---
      // Central crimson + cyan volumetric aura behind the heart
      const auraRadius = baseScale * (2.15 + ventricularPulse * 0.14);
      const auraGrad = ctx.createRadialGradient(cx, cy, baseScale * 0.12, cx, cy, auraRadius);
      auraGrad.addColorStop(0, `rgba(195, 22, 48, ${0.28 + ventricularPulse * 0.14})`);
      auraGrad.addColorStop(0.45, `rgba(0, 210, 255, ${0.12 + ventricularPulse * 0.06})`);
      auraGrad.addColorStop(0.75, 'rgba(6, 18, 42, 0.05)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      // Holographic Projector Pedestal at bottom of stage (matching reference image)
      const pedY = cy + baseScale * 1.42;
      const pedRx = baseScale * 1.32;
      const pedRy = baseScale * 0.31;

      // Vertical volumetric cyan light cone rising from emitter base through the heart
      const coneGrad = ctx.createLinearGradient(cx, pedY, cx, cy - baseScale * 1.15);
      coneGrad.addColorStop(0, `rgba(0, 240, 255, ${0.24 + ventricularPulse * 0.08})`);
      coneGrad.addColorStop(0.35, 'rgba(0, 210, 255, 0.08)');
      coneGrad.addColorStop(1, 'rgba(0, 210, 255, 0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(cx - pedRx * 0.82, pedY);
      ctx.lineTo(cx + pedRx * 0.82, pedY);
      ctx.lineTo(cx + pedRx * 1.12, cy - baseScale * 1.05);
      ctx.lineTo(cx - pedRx * 1.12, cy - baseScale * 1.05);
      ctx.closePath();
      ctx.fill();

      // Pedestal glowing concentric ellipses & radial tick marks
      const pedGlow = ctx.createRadialGradient(cx, pedY, 4, cx, pedY, pedRx * 1.15);
      pedGlow.addColorStop(0, `rgba(0, 240, 255, ${0.38 + ventricularPulse * 0.15})`);
      pedGlow.addColorStop(0.55, 'rgba(0, 185, 245, 0.14)');
      pedGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.translate(cx, pedY);
      ctx.scale(1, pedRy / pedRx);
      ctx.fillStyle = pedGlow;
      ctx.beginPath();
      ctx.arc(0, 0, pedRx * 1.15, 0, Math.PI * 2);
      ctx.fill();

      for (const rFrac of [1.0, 0.82, 0.62, 0.38]) {
        ctx.strokeStyle =
          rFrac === 0.82
            ? `rgba(0, 240, 255, ${0.65 + ventricularPulse * 0.2})`
            : 'rgba(0, 240, 255, 0.32)';
        ctx.lineWidth = rFrac === 0.82 ? 2.0 : 1.1;
        ctx.beginPath();
        ctx.arc(0, 0, pedRx * rFrac, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radial degree ticks on pedestal
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.2;
      for (let t = 0; t < 36; t++) {
        const ang = (t / 36) * Math.PI * 2 + now * 0.00025;
        const inner = pedRx * (t % 3 === 0 ? 0.84 : 0.88);
        const outer = pedRx * 0.96;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
        ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
        ctx.stroke();
      }
      ctx.restore();

      // --- 2. BACK HALF OF TILTED 3D ORBITAL RINGS AROUND THE HEART ---
      const drawOrbitalArcs = (frontHalf: boolean) => {
        const rings = [
          { rx: baseScale * 1.48, ry: baseScale * 0.44, tilt: -0.24, speed: 0.35, alpha: 0.48 },
          { rx: baseScale * 1.34, ry: baseScale * 0.38, tilt: 0.32, speed: -0.28, alpha: 0.34 },
          { rx: baseScale * 1.62, ry: baseScale * 0.26, tilt: 0.08, speed: 0.18, alpha: 0.26 },
        ];
        for (const ring of rings) {
          ctx.save();
          ctx.translate(cx, cy + baseScale * 0.1);
          ctx.rotate(ring.tilt);
          ctx.beginPath();
          // Back half is [PI, 2*PI], front half is [0, PI]
          ctx.ellipse(
            0,
            0,
            ring.rx,
            ring.ry,
            0,
            frontHalf ? 0 : Math.PI,
            frontHalf ? Math.PI : Math.PI * 2
          );
          ctx.strokeStyle = `rgba(0, 240, 255, ${
            frontHalf ? ring.alpha : ring.alpha * 0.45
          })`;
          ctx.lineWidth = frontHalf ? 1.5 : 1.0;
          ctx.stroke();

          // Orbiting bright cyan node on each ring
          const nodeAngle = ((now * 0.001 * ring.speed) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const isFrontNode = nodeAngle >= 0 && nodeAngle <= Math.PI;
          if (isFrontNode === frontHalf) {
            const nx = Math.cos(nodeAngle) * ring.rx;
            const ny = Math.sin(nodeAngle) * ring.ry;
            ctx.fillStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(nx, ny, frontHalf ? 3.4 : 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        }
      };

      drawOrbitalArcs(false);

      // --- 3. REAL BODYPARTS3D ANATOMICAL HEART RASTERIZATION (Z-BUFFER GOURAUD/PHONG + SSS) ---
      if (geometry && offCtx && imgData && pixelBuf32) {
        pixelBuf32.fill(0);
        zBuffer.fill(-1e9);

        const sinY = Math.sin(rotY);
        const cosY = Math.cos(rotY);
        const sinX = Math.sin(rotX);
        const cosX = Math.cos(rotX);

        const pos = geometry.positions;
        const nrm = geometry.normals;
        const grp = geometry.vertexGroup;
        const aoArr = geometry.vertexAO;
        const idxArr = geometry.indices;
        const numVerts = pos.length / 3;
        const numIndices = idxArr.length;

        const halfW = BUF_W * 0.5;
        const halfH = BUF_H * 0.6;
        const bufScale = BUF_W * 0.248;

        // Traveling pulse wave position along coronary vessels
        const vesselWavePhase = (now * 0.0028) % 1;

        for (let i = 0; i < numVerts; i++) {
          const i3 = i * 3;
          let px = pos[i3];
          let py = pos[i3 + 1];
          let pz = pos[i3 + 2];
          const gId = grp[i];

          // Physiological cardiac contraction deformation in anatomical coordinates:
          // py < 0.15 is ventricular region; py >= 0.15 is atrial & great vessel region
          if (py < 0.18) {
            const vWeight = Math.min(1, Math.max(0, (0.18 - py) / 0.95));
            const squeeze = 1 - ventricularPulse * 0.078 * vWeight;
            const twist = ventricularPulse * 0.055 * vWeight;
            const rx = px * Math.cos(twist) - pz * Math.sin(twist);
            const rz = px * Math.sin(twist) + pz * Math.cos(twist);
            px = rx * squeeze;
            pz = rz * squeeze;
            py *= 1 - ventricularPulse * 0.032 * vWeight;
          } else if (gId === 0 || gId === 3) {
            // Atria & pulmonary veins contract during atrial systole
            const aWeight = Math.min(1, (py - 0.18) / 0.55);
            const aSqueeze = 1 - atrialPulse * 0.055 * aWeight;
            px *= aSqueeze;
            pz *= aSqueeze;
          } else if (gId === 1 || gId === 2) {
            // Aorta & Pulmonary Trunk distend slightly with arterial systolic pressure wave
            const expand = 1 + arterialWave * 0.042;
            px *= expand;
            pz *= expand;
          }

          // Rotate vertex position around Y then X
          const x1 = px * cosY + pz * sinY;
          const z1 = -px * sinY + pz * cosY;
          const y2 = py * cosX - z1 * sinX;
          const z2 = py * sinX + z1 * cosX;

          // Perspective projection (note: -y2 because +Y is superior/up in glTF)
          const persp = 1 / (1 - z2 * 0.16);
          txArr[i] = halfW + x1 * bufScale * persp;
          tyArr[i] = halfH - y2 * bufScale * persp;
          tzArr[i] = z2;

          // Rotate vertex normal
          const vnx = nrm[i3];
          const vny = nrm[i3 + 1];
          const vnz = nrm[i3 + 2];
          const nx1 = vnx * cosY + vnz * sinY;
          const nz1 = -vnx * sinY + vnz * cosY;
          const ny2 = vny * cosX - nz1 * sinX;
          const nz2 = vny * sinX + nz1 * cosX;

          nxArr[i] = nx1;
          nyArr[i] = ny2;
          nzArr[i] = nz2;

          // --- COMPUTE PHYSICALLY-INSPIRED BIOLOGICAL TISSUE SHADING PER VERTEX ---
          // (With 31,598 triangles, each triangle is ~1.8px wide, so vertex lighting + barycentric interpolation is ultra-smooth!)
          // Flip inward-pointing normals on double-sided vessel walls
          const sign = nz2 < -0.15 && (gId === 1 || gId === 2 || gId === 3 || gId === 4) ? -1 : 1;
          const N_x = nx1 * sign;
          const N_y = ny2 * sign;
          const N_z = nz2 * sign;

          // Select biological tissue albedo & material properties by anatomical group
          let baseR = 148,
            baseG = 16,
            baseB = 30;
          let roughness = 0.32;
          let cyanRimBoost = 0.42;

          if (gId === 0) {
            // Myocardium (Ventricles, Atria, Auricles) — rich oxygenated deep crimson-burgundy
            // Subtle natural variation across epicardial surface
            const epiVar = Math.sin(px * 4.2 + py * 3.1) * Math.cos(pz * 3.8);
            baseR = 152 + epiVar * 14;
            baseG = 17 + Math.max(0, epiVar) * 12;
            baseB = 31 + Math.max(0, epiVar) * 10;
            roughness = 0.3;
            cyanRimBoost = 0.45;
          } else if (gId === 1) {
            // Aorta & Supra-aortic branches — bright arterial crimson-scarlet
            baseR = 186;
            baseG = 24;
            baseB = 40;
            roughness = 0.26;
            cyanRimBoost = 0.5;
          } else if (gId === 2) {
            // Pulmonary Artery & Trunk — deep burgundy-violet with cyan-blue rim
            baseR = 116;
            baseG = 28;
            baseB = 64;
            roughness = 0.28;
            cyanRimBoost = 0.85;
          } else if (gId === 3) {
            // Pulmonary Veins — rich deep arterial rose-crimson
            baseR = 164;
            baseG = 22;
            baseB = 42;
            roughness = 0.32;
            cyanRimBoost = 0.48;
          } else if (gId === 4) {
            // Superior & Inferior Vena Cava — deep venous crimson-blue with strong cyan rim
            baseR = 96;
            baseG = 32;
            baseB = 74;
            roughness = 0.28;
            cyanRimBoost = 0.92;
          } else if (gId === 5) {
            // Coronary Arteries — glowing arterial scarlet with systolic pulse wave
            const wave = Math.max(0, Math.sin((py * 1.4 + vesselWavePhase) * Math.PI * 2));
            baseR = 224 + wave * 30;
            baseG = 38 + wave * 36;
            baseB = 52 + wave * 28;
            roughness = 0.2;
            cyanRimBoost = 0.55;
          } else if (gId === 6) {
            // Cardiac Veins — bioluminescent cyan-blue epicardial vessels matching reference image!
            const wave = Math.max(0, Math.sin((-py * 1.4 + vesselWavePhase) * Math.PI * 2));
            baseR = 28 + wave * 45;
            baseG = 165 + wave * 65;
            baseB = 225 + wave * 30;
            roughness = 0.2;
            cyanRimBoost = 1.1;
          }

          const ao = aoArr[i];

          // 1. Key Light diffuse + wrapped subsurface scattering (warm crimson translucency)
          const ndotl1 = N_x * L1x + N_y * L1y + N_z * L1z;
          const diff1 = Math.max(0, ndotl1);
          const wrapSSS = Math.max(0, (ndotl1 + 0.48) / 1.48) * 0.42;

          // 2. Cyan Rim/Fill Light
          const ndotl2 = Math.max(0, N_x * L2x + N_y * L2y + N_z * L2z);

          // 3. Pedestal Cyan Uplight (stronger on inferior apex/base)
          const ndotl3 = Math.max(0, N_x * L3x + N_y * L3y + N_z * L3z);

          // 4. Wet epicardial dual-lobe specular reflection (Blinn-Phong)
          const ndoth1 = Math.max(0, N_x * H1x + N_y * H1y + N_z * H1z);
          const ndoth2 = Math.max(0, N_x * H2x + N_y * H2y + N_z * H2z);
          const specPower = roughness < 0.25 ? 42 : 28;
          const spec1 = Math.pow(ndoth1, specPower) * (0.58 + ventricularPulse * 0.14);
          const spec2 = Math.pow(ndoth2, 22) * 0.42;

          // 5. Fresnel rim grazing angle (1 - N.z) for subtle cyan holographic edge illumination
          const fresnel = Math.pow(1 - Math.max(0, Math.min(1, Math.abs(N_z))), 2.65);

          const directLight = (0.26 + diff1 * 0.78) * ao;
          let r =
            baseR * directLight +
            205 * wrapSSS * ao +
            spec1 * 255 +
            spec2 * 70 +
            fresnel * 24 * cyanRimBoost;
          let g =
            baseG * directLight +
            24 * wrapSSS * ao +
            ndotl2 * 38 * ao +
            ndotl3 * 28 * ao +
            spec1 * 185 +
            spec2 * 225 +
            fresnel * 195 * cyanRimBoost;
          let b =
            baseB * directLight +
            36 * wrapSSS * ao +
            ndotl2 * 56 * ao +
            ndotl3 * 45 * ao +
            spec1 * 195 +
            spec2 * 255 +
            fresnel * 245 * cyanRimBoost;

          // Boost emissive glow on CardiacVeins (group 6) and CoronaryArteries (group 5)
          if (gId === 6) {
            r += 18;
            g += 75;
            b += 115;
          } else if (gId === 5) {
            r += 42 + ventricularPulse * 28;
            g += 10;
            b += 16;
          }

          crArr[i] = Math.min(255, Math.max(0, r));
          cgArr[i] = Math.min(255, Math.max(0, g));
          cbArr[i] = Math.min(255, Math.max(0, b));
        }

        // Rasterize all 31,598 triangles into the Z-buffer with barycentric color interpolation
        for (let t = 0; t < numIndices; t += 3) {
          const i0 = idxArr[t];
          const i1 = idxArr[t + 1];
          const i2 = idxArr[t + 2];

          const x0 = txArr[i0],
            y0 = tyArr[i0],
            z0 = tzArr[i0];
          const x1 = txArr[i1],
            y1 = tyArr[i1],
            z1 = tzArr[i1];
          const x2 = txArr[i2],
            y2 = tyArr[i2],
            z2 = tzArr[i2];

          // 2D signed area (note screen Y is downward)
          const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
          if (Math.abs(area) < 0.05) continue;

          // Back-face culling for closed Myocardium (group 0) to double rasterization speed;
          // keep double-sided for thin vessel walls
          if (grp[i0] === 0 && area > 0) continue;

          const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
          const maxX = Math.min(BUF_W - 1, Math.ceil(Math.max(x0, x1, x2)));
          const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
          const maxY = Math.min(BUF_H - 1, Math.ceil(Math.max(y0, y1, y2)));
          if (minX > maxX || minY > maxY) continue;

          const invArea = 1 / area;
          const r0 = crArr[i0],
            g0 = cgArr[i0],
            b0 = cbArr[i0];
          const r1 = crArr[i1],
            g1 = cgArr[i1],
            b1 = cbArr[i1];
          const r2 = crArr[i2],
            g2 = cgArr[i2],
            b2 = cbArr[i2];

          for (let py = minY; py <= maxY; py++) {
            const cySample = py + 0.5;
            const rowOffset = py * BUF_W;
            for (let px = minX; px <= maxX; px++) {
              const cxSample = px + 0.5;
              const w0 = ((x1 - cxSample) * (y2 - cySample) - (x2 - cxSample) * (y1 - cySample)) * invArea;
              const w1 = ((x2 - cxSample) * (y0 - cySample) - (x0 - cxSample) * (y2 - cySample)) * invArea;
              const w2 = 1 - w0 - w1;

              if (w0 >= -0.001 && w1 >= -0.001 && w2 >= -0.001) {
                const z = w0 * z0 + w1 * z1 + w2 * z2;
                const bufIdx = rowOffset + px;
                if (z > zBuffer[bufIdx]) {
                  zBuffer[bufIdx] = z;
                  const rr = (w0 * r0 + w1 * r1 + w2 * r2) | 0;
                  const gg = (w0 * g0 + w1 * g1 + w2 * g2) | 0;
                  const bb = (w0 * b0 + w1 * b1 + w2 * b2) | 0;
                  pixelBuf32[bufIdx] = (255 << 24) | (bb << 16) | (gg << 8) | rr;
                }
              }
            }
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        // Draw the rendered 3D anatomical heart centered on the stage
        const drawSize = baseScale * 3.48;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          offscreen,
          cx - drawSize * 0.5,
          cy - drawSize * 0.53,
          drawSize,
          drawSize
        );
        ctx.restore();
      }

      // --- 4. FRONT HALF OF TILTED 3D ORBITAL RINGS & FLOATING BIOPHOTON PARTICLES ---
      drawOrbitalArcs(true);

      for (const pt of orbitalParticles) {
        pt.angle = (pt.angle + dt * pt.speed) % (Math.PI * 2);
        const ox = Math.cos(pt.angle) * pt.radius;
        const oz = Math.sin(pt.angle) * pt.radius;
        const oy = ox * Math.sin(pt.tiltX) + oz * Math.sin(pt.tiltZ);
        const sx = cx + ox * baseScale;
        const sy = cy + oy * baseScale;
        const alpha = 0.35 + 0.45 * ((oz + 1.6) / 3.2);
        ctx.fillStyle = pt.isCyan
          ? `rgba(0, 240, 255, ${alpha.toFixed(2)})`
          : `rgba(255, 65, 105, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- 5. SYSTOLIC PULSE RING & RIGHT-CLICK ACTIVATION SHOCKWAVE ---
      if (shockwavePhase > 0) {
        const pRadius = baseScale * (0.95 + shockwavePhase * 0.65);
        const pAlpha = (1 - shockwavePhase) * 0.26;
        ctx.strokeStyle = `rgba(0, 240, 255, ${pAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, pRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (rightClickWavePhaseRef.current > 0) {
        const rw = rightClickWavePhaseRef.current;
        const rwRadius = baseScale * (0.55 + rw * 1.45);
        const rwAlpha = (1 - rw) * 0.72;
        ctx.strokeStyle = `rgba(0, 240, 255, ${rwAlpha.toFixed(3)})`;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(cx, cy, rwRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <section
      aria-label="3D Cardiac Biomedical Command Center"
      className="nexus-heart-stage-dark relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)]"
      style={{
        background:
          'radial-gradient(ellipse at 50% 46%, #0b1b36 0%, #060e1f 52%, #030711 100%)',
      }}
    >
      {/* Subtle holographic grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundSize: '44px 44px',
          backgroundImage:
            'linear-gradient(to right, rgba(0, 240, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 240, 255, 0.06) 1px, transparent 1px)',
        }}
      />

      {/* TOP COMMAND HEADER BAR */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-2.5 border-b border-cyan-500/20 bg-slate-950/60 backdrop-blur-md">
        {/* Controls: DEMO / LIVE ESP32 + 3D Camera Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl p-0.5 bg-slate-900/90 border border-slate-700/80">
            <button
              type="button"
              onClick={() => onSwitchDataMode('demo')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech font-semibold transition cursor-pointer ${
                dataMode === 'demo'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_12px_rgba(0,240,255,0.25)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              DEMO MODE
            </button>
            <button
              type="button"
              onClick={() => onSwitchDataMode('live')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-tech font-semibold transition cursor-pointer ${
                dataMode === 'live'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              LIVE ESP32
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono-tech bg-slate-900/80 hover:bg-slate-800 text-cyan-200 border border-cyan-500/30 transition cursor-pointer"
            title={autoRotate ? 'Tạm dừng tự xoay 360°' : 'Tiếp tục tự xoay 360°'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{autoRotate ? 'Đang xoay 360°' : 'Đã dừng xoay'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetCameraTriggerRef.current = true;
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-mono-tech bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition cursor-pointer"
            title="Đặt lại góc nhìn 3D mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Live BPM + Cardiac Phase Readout */}
        <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-cyan-500/25">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs font-mono-tech uppercase text-slate-400">BPM:</span>
            <span className="text-xl font-bold font-display text-white">
              {displayedSmoothedBpm}
            </span>
            <span className="text-[10px] font-mono-tech text-cyan-300">bpm</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="text-[10px] font-mono-tech text-cyan-300 tracking-wider">
            {cardiacPhaseLabel}
          </div>
        </div>
      </div>

      {/* DEDICATED FULL-WIDTH 3D HEART + 4 FLOATING CHARTS STAGE */}
      <div
        ref={stageContainerRef}
        onContextMenu={(e) => {
          e.preventDefault();
          handleToggleFloatingCharts();
        }}
        className="relative w-full min-h-[560px] md:min-h-[640px] flex flex-col items-center justify-center select-none overflow-hidden"
      >
        {/* Central 3D Anatomical Heart Canvas */}
        <div className="relative z-10 w-full h-[460px] md:h-[620px] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full max-w-[780px] max-h-[620px] cursor-grab active:cursor-grabbing"
          />

          {!modelLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="px-4 py-2 rounded-xl bg-slate-950/85 border border-cyan-400/40 text-xs font-mono-tech text-cyan-300 shadow-lg">
                Đang tải mô hình giải phẫu 3D (BodyParts3D)...
              </div>
            </div>
          )}
        </div>

        {/* FOUR FLOATING GLASSMORPHISM CHARTS AROUND THE 3D HEART (2 Left, 2 Right on Desktop) */}
        <FloatingHeartChartsHUD
          visible={floatingChartsOpen}
          metrics={metrics}
          series={series}
          dataMode={dataMode}
          isLiveConnected={isLiveValid}
          reducedMotion={reducedMotion}
          onClose={() => setFloatingChartsOpen(false)}
        />

        {/* BOTTOM HUD STATUS BAR (Device Status Left, PPG Signal Right) */}
        <div className="relative md:absolute md:bottom-4 md:left-5 md:right-5 z-20 w-full md:w-auto px-4 md:px-0 pb-4 md:pb-0 flex flex-col md:flex-row items-center justify-between gap-2.5 pointer-events-none">
          {/* Bottom-Left: Connection & Sync Status Pill */}
          <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-cyan-500/30 backdrop-blur-md shadow-lg">
            <span className={`w-2.5 h-2.5 rounded-full animate-ping ${statusBadge.dotClass}`} />
            <span className={`w-2.5 h-2.5 rounded-full -ml-5 ${statusBadge.dotClass}`} />
            <div>
              <div className="flex items-center gap-1.5">
                {dataMode === 'live' && isLiveValid ? (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                ) : dataMode === 'demo' ? (
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                )}
                <span className="text-[11px] font-mono-tech font-bold tracking-wider text-white">
                  {statusBadge.code}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{statusBadge.sub}</p>
            </div>
          </div>

          {/* Bottom-Right: Live PPG Waveform & Signal Quality Pill */}
          <div className="pointer-events-auto flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 backdrop-blur-md shadow-lg">
            <div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-mono-tech uppercase tracking-wider text-slate-300">
                  PPG SIGNAL: <strong className="text-cyan-300">{signalQualityInfo.value}</strong>
                </span>
              </div>
              <p className="text-[9px] font-mono-tech text-slate-400">{signalQualityInfo.detail}</p>
            </div>
            {ppgPath && (
              <svg width="110" height="26" viewBox="0 0 150 28" className="overflow-visible">
                <path
                  d={ppgPath}
                  fill="none"
                  stroke="#00f0ff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  User,
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
  | 'BodyTorso'
  | 'Lungs'
  | 'Liver'
  | 'Stomach'
  | 'Myocardium'
  | 'Aorta'
  | 'PulmonaryArtery'
  | 'PulmonaryVeins'
  | 'VenaCava'
  | 'CoronaryArteries'
  | 'CardiacVeins';

interface LoadedAnatomyGeometry {
  positions: Float32Array;
  normals: Float32Array;
  vertexGroup: Uint8Array;
  vertexAO: Float32Array;
  indices: Uint32Array;
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
  BodyTorso: 0,
  Lungs: 1,
  Liver: 2,
  Stomach: 3,
  Myocardium: 4,
  Aorta: 5,
  PulmonaryArtery: 6,
  PulmonaryVeins: 7,
  VenaCava: 8,
  CoronaryArteries: 9,
  CardiacVeins: 10,
};

function evaluateCardiacCycle(phase: number): {
  ventricularPulse: number;
  atrialPulse: number;
  arterialWave: number;
  shockwavePhase: number;
  phaseLabel: string;
} {
  const p = ((phase % 1) + 1) % 1;

  const atrialDiff = (p - 0.1) / 0.048;
  const atrialPulse = Math.exp(-atrialDiff * atrialDiff);

  const sysDiff = (p - 0.21) / 0.054;
  const primarySystole = Math.exp(-sysDiff * sysDiff);

  const dubDiff = (p - 0.34) / 0.05;
  const secondaryDub = 0.52 * Math.exp(-dubDiff * dubDiff);

  const artDiff = (p - 0.26) / 0.065;
  const arterialWave = Math.exp(-artDiff * artDiff);

  const ventricularPulse = Math.min(1, primarySystole + secondaryDub);
  const shockwavePhase = p >= 0.18 && p <= 0.92 ? (p - 0.18) / 0.74 : 0;

  let phaseLabel = 'DIASTOLE (THƯ GIÃN)';
  if (p >= 0.05 && p < 0.15) {
    phaseLabel = 'ATRIAL SYSTOLE (TÂM NHĨ CO)';
  } else if (p >= 0.15 && p < 0.29) {
    phaseLabel = 'VENTRICULAR SYSTOLE • LUB (S1)';
  } else if (p >= 0.29 && p < 0.42) {
    phaseLabel = 'DICROTIC RECOIL • DUB (S2)';
  }

  return { ventricularPulse, atrialPulse, arterialWave, shockwavePhase, phaseLabel };
}

async function loadAnatomicalBodyHeartGlb(url: string): Promise<LoadedAnatomyGeometry> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch anatomical body/heart GLB: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const view = new DataView(arrayBuffer);

  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) {
    throw new Error('Invalid GLB magic header');
  }

  const jsonChunkLength = view.getUint32(12, true);
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
    const groupId = GROUP_IDS[groupName] ?? 4;

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

let cachedGeometryPromise: Promise<LoadedAnatomyGeometry> | null = null;

export const BiomedicalHeartCommandCenter: React.FC<BiomedicalHeartCommandCenterProps> = ({
  metrics,
  series,
  deviceStatus,
  dataMode,
  ppgWave,
  reducedMotion,
  isLightMode,
  onSelectMetricModal,
  onSwitchDataMode,
}) => {
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 'body' = Translucent human body + organs + beating heart (Image 1)
  // 'heart' = Zoomed-in anatomical heart + 4 floating mini charts (Image 2)
  const [viewMode, setViewMode] = useState<'body' | 'heart'>('body');
  const [autoRotate, setAutoRotate] = useState(true);
  const [cardiacPhaseLabel, setCardiacPhaseLabel] = useState('VENTRICULAR SYSTOLE • LUB (S1)');
  const [displayedSmoothedBpm, setDisplayedSmoothedBpm] = useState<number>(74);
  const [modelLoaded, setModelLoaded] = useState<boolean>(false);

  const heartMetric = useMemo(() => metrics.find((m) => m.key === 'heartRate'), [metrics]);

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
        colorClass: 'text-amber-500 border-amber-400/40 bg-amber-500/10',
        dotClass: 'bg-amber-400',
      };
    }
    if (isLiveValid) {
      return {
        code: 'CONNECTED • LIVE ESP32',
        sub: 'Đồng bộ BPM thực từ MAX30102',
        colorClass: 'text-emerald-500 border-emerald-400/40 bg-emerald-500/10',
        dotClass: 'bg-emerald-400',
      };
    }
    return {
      code: 'DISCONNECTED • STANDBY',
      sub: 'Chưa có tín hiệu — Nhịp chờ 60 BPM',
      colorClass: 'text-rose-500 border-rose-400/40 bg-rose-500/10',
      dotClass: 'bg-rose-400',
    };
  }, [dataMode, isLiveValid]);

  const signalQualityInfo = useMemo(() => {
    if (dataMode === 'demo') {
      return {
        value: '98.4%',
        detail: `PPG Lock • RSSI ${deviceStatus.wifiRssi ?? -54} dBm`,
      };
    }
    if (isLiveValid && deviceStatus.wifiRssi !== null) {
      const rssi = deviceStatus.wifiRssi;
      const pct = Math.max(10, Math.min(100, Math.round(100 + (rssi + 45) * 1.2)));
      return {
        value: `${pct}%`,
        detail: `ESP32 Wi-Fi ${rssi} dBm`,
      };
    }
    return {
      value: 'N/A',
      detail: 'Chưa nhận tín hiệu',
    };
  }, [dataMode, isLiveValid, deviceStatus.wifiRssi]);

  // Sync refs into rAF render loop
  const targetBpmRef = useRef<number>(rawTargetBpm);
  const smoothedBpmRef = useRef<number>(rawTargetBpm);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const isLightModeRef = useRef<boolean>(isLightMode);
  const viewModeRef = useRef<'body' | 'heart'>(viewMode);
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

  useEffect(() => {
    isLightModeRef.current = isLightMode;
  }, [isLightMode]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const handleToggleViewMode = useCallback(() => {
    rightClickWavePhaseRef.current = 0.01;
    setViewMode((prev) => (prev === 'body' ? 'heart' : 'body'));
  }, []);

  const handleCloseDetail = useCallback(() => {
    rightClickWavePhaseRef.current = 0.01;
    setViewMode('body');
  }, []);

  // Mini PPG wave
  const ppgPath = useMemo(() => {
    if (!ppgWave || ppgWave.length < 2) return '';
    const w = 120;
    const h = 24;
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

  // Load anatomical_body_heart.glb and run 60FPS dual-mode Z-buffer rasterizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;
    let geometry: LoadedAnatomyGeometry | null = null;

    let txArr = new Float32Array(0);
    let tyArr = new Float32Array(0);
    let tzArr = new Float32Array(0);
    let nxArr = new Float32Array(0);
    let nyArr = new Float32Array(0);
    let nzArr = new Float32Array(0);
    let crArr = new Float32Array(0);
    let cgArr = new Float32Array(0);
    let cbArr = new Float32Array(0);
    let caArr = new Float32Array(0); // Alpha per vertex

    if (!cachedGeometryPromise) {
      cachedGeometryPromise = loadAnatomicalBodyHeartGlb('./models/anatomical_body_heart.glb');
    }

    cachedGeometryPromise
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
        caArr = new Float32Array(numVerts);
        setModelLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load anatomical_body_heart.glb:', err);
      });

    const BUF_W = 460;
    const BUF_H = 520;
    const offscreen = document.createElement('canvas');
    offscreen.width = BUF_W;
    offscreen.height = BUF_H;
    const offCtx = offscreen.getContext('2d');
    const imgData = offCtx ? offCtx.createImageData(BUF_W, BUF_H) : null;
    const pixelBuf32 = imgData ? new Uint32Array(imgData.data.buffer) : null;
    const zBuffer = new Float32Array(BUF_W * BUF_H);

    // Camera orbit & zoom interpolation
    let rotY = -0.12;
    let rotX = 0.04;
    let targetRotX = 0.04;
    let currZoom = 0.75;
    let targetZoom = 0.75;
    let currCenterY = -0.12;
    let targetCenterY = -0.12;
    let currOrganAlpha = 1.0;
    let targetOrganAlpha = 1.0;

    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let touchDistance = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
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
      targetRotX = Math.max(-0.45, Math.min(0.48, targetRotX + dy * 0.0065));
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
      targetZoom = Math.max(0.42, Math.min(1.35, targetZoom - e.deltaY * 0.0008));
    };

    // Touch pinch to zoom
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        touchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = dist - touchDistance;
        touchDistance = dist;
        targetZoom = Math.max(0.42, Math.min(1.35, targetZoom + diff * 0.004));
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', onTouchMove, { passive: true });

    let animId = 0;
    let lastTime = performance.now();
    let beatPhase = 0;
    let lastUiSyncTime = 0;

    // 3-Point Medical Studio Lighting
    const L1x = -0.42, L1y = 0.54, L1z = 0.72;
    const H1Len = Math.hypot(L1x, L1y, L1z + 1);
    const H1x = L1x / H1Len, H1y = L1y / H1Len, H1z = (L1z + 1) / H1Len;

    const L2x = 0.75, L2y = 0.16, L2z = 0.64;
    const H2Len = Math.hypot(L2x, L2y, L2z + 1);
    const H2x = L2x / H2Len, H2y = L2y / H2Len, H2z = (L2z + 1) / H2Len;

    const renderFrame = (now: number) => {
      if (isCancelled) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const cw = Math.max(280, Math.floor(rect.width));
      const ch = Math.max(380, Math.floor(rect.height));
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
      }

      const isMobileScreen = cw < 640;
      const isBodyView = viewModeRef.current === 'body';
      targetZoom = isBodyView ? (isMobileScreen ? 0.30 : 0.32) : (isMobileScreen ? 0.66 : 0.96);
      targetCenterY = isBodyView ? -0.40 : 0.04;
      targetOrganAlpha = isBodyView ? 1.0 : 0.0;

      if (resetCameraTriggerRef.current) {
        resetCameraTriggerRef.current = false;
        rotY = -0.15;
        targetRotX = 0.05;
      }

      // Smooth camera interpolation
      currZoom += (targetZoom - currZoom) * Math.min(1, dt * 5.5);
      currCenterY += (targetCenterY - currCenterY) * Math.min(1, dt * 5.5);
      currOrganAlpha += (targetOrganAlpha - currOrganAlpha) * Math.min(1, dt * 6.0);
      rotX += (targetRotX - rotX) * Math.min(1, dt * 7.0);

      // Smooth BPM interpolation
      const targetBpm = Math.max(42, Math.min(195, targetBpmRef.current));
      smoothedBpmRef.current += (targetBpm - smoothedBpmRef.current) * Math.min(1, dt * 4.0);
      const currentBpm = smoothedBpmRef.current;

      const beatsPerSec = currentBpm / 60;
      beatPhase = (beatPhase + dt * beatsPerSec) % 1;
      const { ventricularPulse, atrialPulse, arterialWave, shockwavePhase, phaseLabel } =
        evaluateCardiacCycle(beatPhase);

      if (rightClickWavePhaseRef.current > 0) {
        rightClickWavePhaseRef.current += dt * 1.45;
        if (rightClickWavePhaseRef.current > 1) rightClickWavePhaseRef.current = 0;
      }

      if (now - lastUiSyncTime > 240) {
        lastUiSyncTime = now;
        setCardiacPhaseLabel(phaseLabel);
        setDisplayedSmoothedBpm(Math.round(currentBpm));
      }

      // Auto rotation
      if (!isDragging && autoRotateRef.current && !reducedMotionRef.current) {
        rotY += dt * ((Math.PI * 2) / 28.0);
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);

      const isLight = isLightModeRef.current;
      const cx = cw * 0.5;
      const cy = ch * 0.5;
      const baseScale = Math.min(cw, ch) * 0.44;

      // 1. Clean Background & Volumetric Light
      if (isLight) {
        // Pure White Medical Aura (MediFlex style)
        const aura = ctx.createRadialGradient(cx, cy, baseScale * 0.1, cx, cy, baseScale * 2.4);
        aura.addColorStop(0, 'rgba(186, 230, 253, 0.42)');
        aura.addColorStop(0.55, 'rgba(224, 242, 254, 0.22)');
        aura.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, baseScale * 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Dark Studio Aura
        const aura = ctx.createRadialGradient(cx, cy, baseScale * 0.1, cx, cy, baseScale * 2.4);
        aura.addColorStop(0, `rgba(195, 22, 48, ${0.25 + ventricularPulse * 0.12})`);
        aura.addColorStop(0.5, `rgba(0, 210, 255, ${0.12 + ventricularPulse * 0.05})`);
        aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(cx, cy, baseScale * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Holographic Rings (in Heart Detail Mode)
      if (!isBodyView || currOrganAlpha < 0.6) {
        const ringAlpha = (1 - currOrganAlpha) * (isLight ? 0.35 : 0.6);
        ctx.save();
        ctx.translate(cx, cy + baseScale * 0.12);
        ctx.rotate(-0.22);
        ctx.beginPath();
        ctx.ellipse(0, 0, baseScale * 1.48, baseScale * 0.44, 0, 0, Math.PI * 2);
        ctx.strokeStyle = isLight ? `rgba(2, 132, 199, ${ringAlpha})` : `rgba(0, 240, 255, ${ringAlpha})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.restore();
      }

      // 3. 3D Body & Organs Rasterization
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
        const halfH = BUF_H * 0.5;
        const bufScale = BUF_W * 0.22 * currZoom;

        const vesselWavePhase = (now * 0.0028) % 1;

        for (let i = 0; i < numVerts; i++) {
          const i3 = i * 3;
          let px = pos[i3];
          let py = pos[i3 + 1];
          let pz = pos[i3 + 2];
          const gId = grp[i];

          // Cardiac contraction (only affects heart meshes: groups 4..10)
          if (gId >= 4) {
            if (py < 0.18) {
              const vWeight = Math.min(1, Math.max(0, (0.18 - py) / 0.95));
              const squeeze = 1 - ventricularPulse * 0.078 * vWeight;
              const twist = ventricularPulse * 0.055 * vWeight;
              const rx = px * Math.cos(twist) - pz * Math.sin(twist);
              const rz = px * Math.sin(twist) + pz * Math.cos(twist);
              px = rx * squeeze;
              pz = rz * squeeze;
              py *= 1 - ventricularPulse * 0.032 * vWeight;
            } else if (gId === 4 || gId === 7) {
              const aWeight = Math.min(1, (py - 0.18) / 0.55);
              const aSqueeze = 1 - atrialPulse * 0.055 * aWeight;
              px *= aSqueeze;
              pz *= aSqueeze;
            } else if (gId === 5 || gId === 6) {
              const expand = 1 + arterialWave * 0.042;
              px *= expand;
              pz *= expand;
            }
          }

          // Camera Y offset
          const pyShifted = py - currCenterY;

          // Rotation around Y then X
          const x1 = px * cosY + pz * sinY;
          const z1 = -px * sinY + pz * cosY;
          const y2 = pyShifted * cosX - z1 * sinX;
          const z2 = pyShifted * sinX + z1 * cosX;

          const persp = 1 / (1 - z2 * 0.14);
          txArr[i] = halfW + x1 * bufScale * persp;
          tyArr[i] = halfH - y2 * bufScale * persp;
          tzArr[i] = z2;

          // Rotate normals
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

          const fresnel = Math.pow(1 - Math.max(0, Math.min(1, Math.abs(nz2))), 2.2);

          // Shading per group
          let baseR = 148, baseG = 16, baseB = 30;
          let alpha = 1.0;
          let isTranslucentBody = false;

          if (gId === 0) {
            // BodyTorso: Translucent glass human body (Image 1 style)
            isTranslucentBody = true;
            // High transparency in center (0.04), glowing cyan/silver rim at silhouette (0.68)
            alpha = currOrganAlpha * (0.04 + fresnel * 0.65);
            if (isLight) {
              baseR = 14;
              baseG = 138;
              baseB = 205;
            } else {
              baseR = 0;
              baseG = 220;
              baseB = 255;
            }
          } else if (gId === 1) {
            // Lungs: soft sky-blue
            baseR = 56;
            baseG = 168;
            baseB = 224;
            alpha = currOrganAlpha * 0.88;
          } else if (gId === 2) {
            // Liver: warm terracotta-ruby
            baseR = 188;
            baseG = 65;
            baseB = 52;
            alpha = currOrganAlpha * 0.88;
          } else if (gId === 3) {
            // Stomach: coral-rose
            baseR = 218;
            baseG = 96;
            baseB = 114;
            alpha = currOrganAlpha * 0.88;
          } else if (gId === 4) {
            // Myocardium: vivid crimson-red (pops out prominently!)
            baseR = isBodyView ? 245 : 160;
            baseG = isBodyView ? 22 : 18;
            baseB = isBodyView ? 48 : 32;
            alpha = 1.0;
          } else if (gId === 5) {
            // Aorta: arterial scarlet
            baseR = 225;
            baseG = 28;
            baseB = 44;
            alpha = 1.0;
          } else if (gId === 6 || gId === 8) {
            // Pulmonary Artery & Vena Cava: deep venous blue-burgundy
            baseR = 118;
            baseG = 32;
            baseB = 82;
            alpha = 1.0;
          } else if (gId === 7) {
            // Pulmonary Veins: rose-crimson
            baseR = 180;
            baseG = 26;
            baseB = 48;
            alpha = 1.0;
          } else if (gId === 9) {
            // Coronary Arteries: bright glowing crimson with pulse wave
            const wave = Math.max(0, Math.sin((py * 1.4 + vesselWavePhase) * Math.PI * 2));
            baseR = 248 + wave * 7;
            baseG = 45 + wave * 30;
            baseB = 58 + wave * 20;
            alpha = 1.0;
          } else if (gId === 10) {
            // Cardiac Veins: glowing cyan-blue
            baseR = 24;
            baseG = 185;
            baseB = 245;
            alpha = 1.0;
          }

          const ao = aoArr[i];
          const ndotl1 = Math.max(0, nx1 * L1x + ny2 * L1y + nz2 * L1z);

          let r: number, g: number, b: number;

          if (isTranslucentBody) {
            // Translucent glass silhouette
            const rim = fresnel * 0.90;
            if (isLight) {
              r = 232 * (1 - rim) + 14 * rim;
              g = 244 * (1 - rim) + 140 * rim;
              b = 254 * (1 - rim) + 215 * rim;
            } else {
              r = 4 * (1 - rim) + 0 * rim;
              g = 18 * (1 - rim) + 230 * rim;
              b = 40 * (1 - rim) + 255 * rim;
            }
          } else {
            const direct = (0.32 + ndotl1 * 0.72) * ao;
            const sss = Math.max(0, (ndotl1 + 0.4) / 1.4) * 0.28;
            if (gId >= 4 && isBodyView) {
              // Heart stands out with bioluminescent pulse warmth in body view
              const heartGlow = 0.22 + ventricularPulse * 0.12;
              r = baseR * (direct + heartGlow) + 60 * sss + fresnel * 40;
              g = baseG * (direct + heartGlow * 0.2) + 15 * sss + fresnel * 25;
              b = baseB * (direct + heartGlow * 0.2) + 20 * sss + fresnel * 35;
            } else {
              r = baseR * direct + 180 * sss + fresnel * 35;
              g = baseG * direct + 20 * sss + fresnel * 55;
              b = baseB * direct + 30 * sss + fresnel * 75;
            }
          }

          crArr[i] = Math.min(255, Math.max(0, r));
          cgArr[i] = Math.min(255, Math.max(0, g));
          cbArr[i] = Math.min(255, Math.max(0, b));
          caArr[i] = alpha;
        }

        // Two-pass rasterizer:
        // Pass 1: Opaque organs & heart (grp >= 1)
        // Pass 2: Translucent BodyTorso (grp === 0)
        for (let pass = 1; pass <= 2; pass++) {
          for (let t = 0; t < numIndices; t += 3) {
            const i0 = idxArr[t], i1 = idxArr[t + 1], i2 = idxArr[t + 2];
            const gId = grp[i0];
            const isTorso = gId === 0;

            if (pass === 1 && isTorso) continue;
            if (pass === 2 && !isTorso) continue;

            // If in heart detail mode and organ is fully faded, skip torso/lungs/liver/stomach
            if (!isBodyView && gId < 4 && currOrganAlpha < 0.05) continue;

            const x0 = txArr[i0], y0 = tyArr[i0], z0 = tzArr[i0];
            const x1 = txArr[i1], y1 = tyArr[i1], z1 = tzArr[i1];
            const x2 = txArr[i2], y2 = tyArr[i2], z2 = tzArr[i2];

            const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
            if (Math.abs(area) < 0.05) continue;

            // Backface culling for opaque organs; torso backface culling keeps clean silhouette
            if (area > 0 && (gId >= 4 || isTorso)) continue;

            const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
            const maxX = Math.min(BUF_W - 1, Math.ceil(Math.max(x0, x1, x2)));
            const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
            const maxY = Math.min(BUF_H - 1, Math.ceil(Math.max(y0, y1, y2)));
            if (minX > maxX || minY > maxY) continue;

            const invArea = 1 / area;
            const r0 = crArr[i0], g0 = cgArr[i0], b0 = cbArr[i0], a0 = caArr[i0];
            const r1 = crArr[i1], g1 = cgArr[i1], b1 = cbArr[i1], a1 = caArr[i1];
            const r2 = crArr[i2], g2 = cgArr[i2], b2 = cbArr[i2], a2 = caArr[i2];

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

                  if (pass === 1) {
                    // Opaque organs & heart
                    if (z > zBuffer[bufIdx]) {
                      zBuffer[bufIdx] = z;
                      const rr = (w0 * r0 + w1 * r1 + w2 * r2) | 0;
                      const gg = (w0 * g0 + w1 * g1 + w2 * g2) | 0;
                      const bb = (w0 * b0 + w1 * b1 + w2 * b2) | 0;
                      pixelBuf32[bufIdx] = (255 << 24) | (bb << 16) | (gg << 8) | rr;
                    }
                  } else {
                    // Pass 2: Translucent BodyTorso glass blend
                    if (z > zBuffer[bufIdx] - 0.2) {
                      const cur = pixelBuf32[bufIdx];
                      const curA = (cur >> 24) & 0xff;
                      const curB = (cur >> 16) & 0xff;
                      const curG = (cur >> 8) & 0xff;
                      const curR = cur & 0xff;

                      const tr = (w0 * r0 + w1 * r1 + w2 * r2) | 0;
                      const tg = (w0 * g0 + w1 * g1 + w2 * g2) | 0;
                      const tb = (w0 * b0 + w1 * b1 + w2 * b2) | 0;
                      const interpAlpha = w0 * a0 + w1 * a1 + w2 * a2;
                      const ta = Math.min(0.72, Math.max(0.02, interpAlpha));

                      if (curA === 0) {
                        // Empty background
                        const finalA = (ta * 255) | 0;
                        pixelBuf32[bufIdx] = (finalA << 24) | (tb << 16) | (tg << 8) | tr;
                      } else {
                        // Over organ: alpha blend
                        const outR = (tr * ta + curR * (1 - ta)) | 0;
                        const outG = (tg * ta + curG * (1 - ta)) | 0;
                        const outB = (tb * ta + curB * (1 - ta)) | 0;
                        pixelBuf32[bufIdx] = (255 << 24) | (outB << 16) | (outG << 8) | outR;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        offCtx.putImageData(imgData, 0, 0);

        const drawSize = Math.min(cw, ch);
        const drawW = drawSize;
        const drawH = drawSize;
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offscreen, cx - drawW * 0.5, cy - drawH * 0.5, drawW, drawH);
        ctx.restore();

        // 4. Hotspot Target over Heart in Body View (Image 1 Style)
        if (isBodyView && currOrganAlpha > 0.6) {
          const heartShiftedY = -currCenterY;
          const heartRotY = heartShiftedY * cosX;
          const heartBufX = halfW;
          const heartBufY = halfH - heartRotY * bufScale;
          const heartScreenX = cx - (drawW * 0.5) + (heartBufX / BUF_W) * drawW;
          const heartScreenY = cy - (drawH * 0.5) + (heartBufY / BUF_H) * drawH;

          ctx.save();
          // Pulsing radar ring
          const pRing = ((now * 0.0018) % 1);
          ctx.strokeStyle = `rgba(225, 29, 72, ${(1 - pRing) * 0.85})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(heartScreenX, heartScreenY, 8 + pRing * 18, 0, Math.PI * 2);
          ctx.stroke();

          // Solid inner red/white dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(heartScreenX, heartScreenY, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.arc(heartScreenX, heartScreenY, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 5. Right-click wave
      if (rightClickWavePhaseRef.current > 0) {
        const rw = rightClickWavePhaseRef.current;
        const rwRadius = baseScale * (0.45 + rw * 1.5);
        ctx.strokeStyle = isLight
          ? `rgba(2, 132, 199, ${(1 - rw) * 0.75})`
          : `rgba(0, 240, 255, ${(1 - rw) * 0.75})`;
        ctx.lineWidth = 2.4;
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
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <section
      aria-label="3D Biomedical Body & Heart Command Center"
      className="nexus-heart-stage-card relative rounded-2xl md:rounded-3xl overflow-hidden border border-slate-200 dark:border-cyan-500/30 transition-all duration-300"
      style={{
        background: isLightMode
          ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
          : 'radial-gradient(ellipse at 50% 46%, #0b1b36 0%, #060e1f 52%, #030711 100%)',
      }}
    >
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundSize: '36px 36px',
          backgroundImage: isLightMode
            ? 'linear-gradient(to right, rgba(2, 132, 199, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(2, 132, 199, 0.08) 1px, transparent 1px)'
            : 'linear-gradient(to right, rgba(0, 240, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 240, 255, 0.06) 1px, transparent 1px)',
        }}
      />

      {/* TOP COMMAND BAR */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-2.5 px-3.5 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-cyan-500/20 bg-white/70 dark:bg-slate-950/60 backdrop-blur-md">
        {/* View Mode Toggle: Body Overview vs Heart Focus */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => setViewMode('body')}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-mono-tech font-semibold transition cursor-pointer ${
              viewMode === 'body'
                ? 'bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-200 shadow-sm border border-slate-200 dark:border-cyan-400/50'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mô hình Cơ thể</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('heart')}
            className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-[11px] font-mono-tech font-semibold transition cursor-pointer ${
              viewMode === 'heart'
                ? 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-200 shadow-sm border border-rose-200 dark:border-rose-400/50'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cận cảnh Trái Tim</span>
          </button>
        </div>

        {/* Live BPM & Cardiac Phase Readout */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-cyan-500/25">
          <div className="flex items-baseline gap-1">
            <span className="text-[10px] font-mono-tech uppercase text-slate-500 dark:text-slate-400">BPM:</span>
            <span className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">
              {displayedSmoothedBpm}
            </span>
          </div>
          <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
          <div className="text-[10px] font-mono-tech text-cyan-600 dark:text-cyan-300 truncate max-w-[130px] sm:max-w-none">
            {cardiacPhaseLabel}
          </div>
        </div>

        {/* Right Controls: DEMO/LIVE + 360 Rotate + Reset */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="inline-flex rounded-xl p-0.5 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => onSwitchDataMode('demo')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono-tech font-semibold transition cursor-pointer ${
                dataMode === 'demo'
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-200 border border-amber-400/50'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              DEMO
            </button>
            <button
              type="button"
              onClick={() => onSwitchDataMode('live')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono-tech font-semibold transition cursor-pointer ${
                dataMode === 'live'
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200 border border-emerald-400/50'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              LIVE
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-cyan-200 border border-slate-200 dark:border-cyan-500/30 transition cursor-pointer"
            title={autoRotate ? 'Dừng tự xoay' : 'Tiếp tục tự xoay'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => {
              resetCameraTriggerRef.current = true;
            }}
            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition cursor-pointer"
            title="Đặt lại góc nhìn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* DEDICATED VISUALIZATION STAGE */}
      <div
        ref={stageContainerRef}
        onContextMenu={(e) => {
          e.preventDefault();
          handleToggleViewMode();
        }}
        onClick={(e) => {
          // If in body mode, clicking near the center/heart zooms into heart mode
          if (viewMode === 'body') {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const clickY = e.clientY - rect.top;
              const midY = rect.height * 0.45;
              if (Math.abs(clickY - midY) < rect.height * 0.35) {
                handleToggleViewMode();
              }
            }
          }
        }}
        className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[580px] flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer"
      >
        {/* 3D Canvas */}
        <div className="relative z-10 w-full h-[460px] sm:h-[520px] md:h-[580px] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full max-w-[780px] cursor-grab active:cursor-grabbing"
          />

          {!modelLoaded && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="px-4 py-2 rounded-xl bg-white/90 dark:bg-slate-950/85 border border-cyan-400/40 text-xs font-mono-tech text-cyan-600 dark:text-cyan-300 shadow-lg">
                Đang nạp mô hình cơ thể người 3D &amp; nội tạng...
              </div>
            </div>
          )}

          {/* Prompt in Body Mode: Tap on Heart to Zoom */}
          {viewMode === 'body' && (
            <div className="pointer-events-none absolute bottom-12 md:bottom-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-slate-950/85 border border-rose-300 dark:border-rose-400/40 text-[11px] font-medium text-rose-600 dark:text-rose-200 shadow-md">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Chạm vào Trái Tim để phóng to &amp; xem 4 biểu đồ</span>
            </div>
          )}
        </div>

        {/* 4 FLOATING GLASSMORPHISM CHARTS (Active in 'heart' mode) */}
        <FloatingHeartChartsHUD
          visible={viewMode === 'heart'}
          metrics={metrics}
          series={series}
          dataMode={dataMode}
          isLiveConnected={isLiveValid}
          reducedMotion={reducedMotion}
          onClose={handleCloseDetail}
        />

        {/* BOTTOM STATUS BAR */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          {/* Connection Pill */}
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-950/80 border border-slate-200 dark:border-cyan-500/30 backdrop-blur-md shadow-sm">
            <span className={`w-2 h-2 rounded-full ${statusBadge.dotClass}`} />
            <div>
              <div className="flex items-center gap-1">
                {dataMode === 'live' && isLiveValid ? (
                  <Wifi className="w-3 h-3 text-emerald-500" />
                ) : dataMode === 'demo' ? (
                  <Radio className="w-3 h-3 text-amber-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-rose-500" />
                )}
                <span className="text-[10px] font-mono-tech font-bold text-slate-800 dark:text-white">
                  {statusBadge.code}
                </span>
              </div>
            </div>
          </div>

          {/* Return to Body button when in Heart mode */}
          {viewMode === 'heart' && (
            <button
              type="button"
              onClick={handleCloseDetail}
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-cyan-400/40 text-[11px] font-medium text-cyan-700 dark:text-cyan-200 shadow-md cursor-pointer transition"
            >
              <Minimize2 className="w-3.5 h-3.5 text-cyan-500" />
              <span>Xem toàn bộ cơ thể</span>
            </button>
          )}

          {/* PPG Signal Pill */}
          <div className="hidden sm:flex pointer-events-auto items-center gap-2 px-3 py-1 rounded-xl bg-white/85 dark:bg-slate-950/80 border border-slate-200 dark:border-cyan-500/30 backdrop-blur-md shadow-sm">
            <div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-500" />
                <span className="text-[9px] font-mono-tech text-slate-500 dark:text-slate-300">
                  PPG: <strong className="text-cyan-600 dark:text-cyan-300">{signalQualityInfo.value}</strong>
                </span>
              </div>
            </div>
            {ppgPath && (
              <svg width="80" height="20" viewBox="0 0 120 24" className="overflow-visible">
                <path d={ppgPath} fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

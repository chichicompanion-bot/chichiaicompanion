import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  Eye,
  Heart,
  Maximize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DataMode,
  DeviceStatus,
  MetricCardData,
  MetricKey,
  WaveformSample,
} from '../types/health';

interface BiomedicalHeartCommandCenterProps {
  metrics: MetricCardData[];
  deviceStatus: DeviceStatus;
  dataMode: DataMode;
  ppgWave: WaveformSample[];
  reducedMotion: boolean;
  isLightMode: boolean;
  onSelectMetricModal: (key: MetricKey) => void;
  onSwitchDataMode: (mode: DataMode) => void;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface HeartFace {
  v0: Vec3;
  v1: Vec3;
  v2: Vec3;
  normal: Vec3;
  center: Vec3;
  chamber: 'lv' | 'rv' | 'la' | 'ra' | 'aorta' | 'pulmonary' | 'svc';
  baseColor: [number, number, number];
}

interface CoronaryPath3D {
  points: Vec3[];
  color: string;
  width: number;
  isMain: boolean;
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

/**
 * Evaluates a physiological "lub-dub" cardiac contraction curve for phase in [0, 1).
 */
function evaluateCardiacCycle(phase: number): {
  ventricularPulse: number;
  atrialPulse: number;
  shockwavePhase: number;
  phaseLabel: string;
} {
  const p = ((phase % 1) + 1) % 1;

  // Atrial contraction ("lub" preparation): peaks at p = 0.10
  const atrialDiff = (p - 0.1) / 0.045;
  const atrialPulse = Math.exp(-atrialDiff * atrialDiff);

  // Primary ventricular systole ("LUB" S1 peak): sharp rise around p = 0.21
  const sysDiff = (p - 0.21) / 0.052;
  const primarySystole = Math.exp(-sysDiff * sysDiff);

  // Secondary aortic valve closure / dicrotic notch ("DUB" S2 peak): around p = 0.34
  const dubDiff = (p - 0.34) / 0.048;
  const secondaryDub = 0.52 * Math.exp(-dubDiff * dubDiff);

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

  return { ventricularPulse, atrialPulse, shockwavePhase, phaseLabel };
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function computeFaceNormal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const uz = b.z - a.z;
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  const vz = c.z - a.z;
  return normalize3({
    x: uy * vz - uz * vy,
    y: uz * vx - ux * vz,
    z: ux * vy - uy * vx,
  });
}

/**
 * Generates a complete 3D triangulated multi-chamber anatomical heart mesh
 * (Left/Right Ventricles, Left/Right Atria, Aortic Arch, Pulmonary Trunk, Superior Vena Cava)
 * plus 3D Coronary Artery trees. Works universally on 100% of browsers with zero WebGL driver issues.
 */
function build3DAnatomicalHeartModel(): {
  faces: HeartFace[];
  coronaries: CoronaryPath3D[];
} {
  const faces: HeartFace[] = [];

  // Helper to sculpt an anatomical point on the main ventricular/atrial myocardium
  const sculptMyocardiumPoint = (u: number, v: number): Vec3 => {
    // u in [0, PI] (0 = top base, PI = bottom apex), v in [0, 2*PI]
    const sinU = Math.sin(u);
    const cosU = Math.cos(u);
    const sinV = Math.sin(v);
    const cosV = Math.cos(v);

    // yn: 1 at top base, 0 at bottom apex
    const yn = (cosU + 1) * 0.5;

    // Anatomical heart profile: broad muscular upper ventricles tapering to a tilted apex
    const profileRadius = 0.34 + 0.78 * Math.pow(sinU, 0.76) * (0.65 + 0.38 * yn);
    let x = profileRadius * cosV;
    let z = profileRadius * sinV * 0.84;
    let y = cosU * 1.18 - 0.12;

    // Tilt the apex toward the left-anterior inferior direction
    const apexFactor = Math.pow(1 - yn, 1.35);
    x += apexFactor * 0.32;
    z += apexFactor * 0.16;

    // Right ventricular anterior-right muscular bulge
    if (x < 0.1 && y > -0.6 && y < 0.55) {
      const rvFactor = Math.exp(-Math.pow((x + 0.45) * 2.2, 2)) * Math.exp(-Math.pow(y * 1.8, 2));
      x -= rvFactor * 0.18;
      z += rvFactor * 0.14;
    }

    // Interventricular sulcus (groove separating Left and Right Ventricles)
    const sulcusDist = x + 0.14 * y - 0.06;
    const sulcusGroove = Math.exp(-Math.pow(sulcusDist * 6.0, 2)) * Math.sin(u);
    const grooveScale = 1 - sulcusGroove * 0.11;
    x *= grooveScale;
    z *= grooveScale;

    // Atrioventricular coronary sulcus (groove between atria and ventricles near y = 0.42)
    const avGroove = Math.exp(-Math.pow((y - 0.42) * 7.5, 2));
    x *= 1 - avGroove * 0.08;
    z *= 1 - avGroove * 0.08;

    // Organic myocardial muscular fiber texture
    const ripple =
      0.016 * Math.sin(u * 10 + v * 6) * Math.cos(u * 6 - v * 4) +
      0.008 * Math.cos(u * 16 + v * 12);
    x += cosV * sinU * ripple;
    z += sinV * sinU * ripple;

    return { x, y, z };
  };

  // 1) Main Myocardium (Left & Right Ventricles + Atrial Base)
  const uSteps = 30;
  const vSteps = 44;
  const grid: Vec3[][] = [];

  for (let iu = 0; iu <= uSteps; iu++) {
    const u = (iu / uSteps) * Math.PI;
    const row: Vec3[] = [];
    for (let iv = 0; iv <= vSteps; iv++) {
      const v = (iv / vSteps) * Math.PI * 2;
      row.push(sculptMyocardiumPoint(u, v));
    }
    grid.push(row);
  }

  for (let iu = 0; iu < uSteps; iu++) {
    for (let iv = 0; iv < vSteps; iv++) {
      const p00 = grid[iu][iv];
      const p10 = grid[iu + 1][iv];
      const p11 = grid[iu + 1][iv + 1];
      const p01 = grid[iu][iv + 1];

      const pushTri = (a: Vec3, b: Vec3, c: Vec3) => {
        const center = {
          x: (a.x + b.x + c.x) / 3,
          y: (a.y + b.y + c.y) / 3,
          z: (a.z + b.z + c.z) / 3,
        };
        const normal = computeFaceNormal(a, b, c);
        const isUpper = center.y > 0.44;
        const isLeft = center.x >= -0.05;
        const chamber = isUpper ? (isLeft ? 'la' : 'ra') : isLeft ? 'lv' : 'rv';
        const baseColor: [number, number, number] =
          chamber === 'lv'
            ? [185, 16, 48]
            : chamber === 'rv'
            ? [162, 14, 44]
            : [140, 12, 38];

        faces.push({ v0: a, v1: b, v2: c, normal, center, chamber, baseColor });
      };

      pushTri(p00, p10, p11);
      pushTri(p00, p11, p01);
    }
  }

  // Helper to build a 3D tubular vessel along a 3D spine curve
  const addVesselTube = (
    spine: Vec3[],
    radii: number[],
    radialSegments: number,
    chamber: HeartFace['chamber'],
    baseColor: [number, number, number]
  ) => {
    const rings: Vec3[][] = [];
    for (let i = 0; i < spine.length; i++) {
      const curr = spine[i];
      const prev = spine[Math.max(0, i - 1)];
      const next = spine[Math.min(spine.length - 1, i + 1)];
      const tangent = normalize3({
        x: next.x - prev.x,
        y: next.y - prev.y,
        z: next.z - prev.z,
      });

      const up = Math.abs(tangent.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const binormal = normalize3({
        x: tangent.y * up.z - tangent.z * up.y,
        y: tangent.z * up.x - tangent.x * up.z,
        z: tangent.x * up.y - tangent.y * up.x,
      });
      const normal = normalize3({
        x: binormal.y * tangent.z - binormal.z * tangent.y,
        y: binormal.z * tangent.x - binormal.x * tangent.z,
        z: binormal.x * tangent.y - binormal.y * tangent.x,
      });

      const r = radii[i];
      const ring: Vec3[] = [];
      for (let s = 0; s <= radialSegments; s++) {
        const theta = (s / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        ring.push({
          x: curr.x + r * (cosT * binormal.x + sinT * normal.x),
          y: curr.y + r * (cosT * binormal.y + sinT * normal.y),
          z: curr.z + r * (cosT * binormal.z + sinT * normal.z),
        });
      }
      rings.push(ring);
    }

    for (let i = 0; i < rings.length - 1; i++) {
      for (let s = 0; s < radialSegments; s++) {
        const a = rings[i][s];
        const b = rings[i + 1][s];
        const c = rings[i + 1][s + 1];
        const d = rings[i][s + 1];

        const pushTri = (p0: Vec3, p1: Vec3, p2: Vec3) => {
          const center = {
            x: (p0.x + p1.x + p2.x) / 3,
            y: (p0.y + p1.y + p2.y) / 3,
            z: (p0.z + p1.z + p2.z) / 3,
          };
          const normal = computeFaceNormal(p0, p1, p2);
          faces.push({ v0: p0, v1: p1, v2: p2, normal, center, chamber, baseColor });
        };

        pushTri(a, b, c);
        pushTri(a, c, d);
      }
    }
  };

  // 2) Ascending Aorta & Aortic Arch (Bright Arterial Crimson)
  addVesselTube(
    [
      { x: 0.04, y: 0.68, z: 0.05 },
      { x: 0.1, y: 1.02, z: 0.08 },
      { x: 0.08, y: 1.32, z: 0.04 },
      { x: -0.05, y: 1.5, z: -0.06 },
      { x: -0.26, y: 1.44, z: -0.22 },
      { x: -0.38, y: 1.15, z: -0.34 },
    ],
    [0.22, 0.23, 0.22, 0.2, 0.18, 0.17],
    16,
    'aorta',
    [215, 24, 58]
  );

  // 3 Supra-aortic arterial branches (Brachiocephalic, Left Common Carotid, Left Subclavian)
  addVesselTube(
    [
      { x: 0.08, y: 1.38, z: 0.02 },
      { x: 0.14, y: 1.65, z: 0.03 },
      { x: 0.18, y: 1.85, z: 0.04 },
    ],
    [0.075, 0.068, 0.06],
    10,
    'aorta',
    [220, 30, 64]
  );
  addVesselTube(
    [
      { x: -0.04, y: 1.46, z: -0.05 },
      { x: -0.03, y: 1.72, z: -0.05 },
      { x: -0.02, y: 1.9, z: -0.05 },
    ],
    [0.065, 0.058, 0.052],
    10,
    'aorta',
    [220, 30, 64]
  );
  addVesselTube(
    [
      { x: -0.18, y: 1.44, z: -0.15 },
      { x: -0.22, y: 1.68, z: -0.18 },
      { x: -0.25, y: 1.85, z: -0.2 },
    ],
    [0.062, 0.055, 0.05],
    10,
    'aorta',
    [220, 30, 64]
  );

  // 3) Pulmonary Artery Trunk & Left/Right Bifurcation (Deep Cyan-Violet Venous/Pulmonary tone)
  addVesselTube(
    [
      { x: -0.24, y: 0.56, z: 0.34 },
      { x: -0.12, y: 0.88, z: 0.28 },
      { x: 0.08, y: 1.1, z: 0.16 },
      { x: 0.36, y: 1.15, z: 0.02 },
      { x: 0.58, y: 1.12, z: -0.08 },
    ],
    [0.18, 0.175, 0.165, 0.145, 0.13],
    14,
    'pulmonary',
    [38, 105, 175]
  );

  // 4) Superior Vena Cava & Right Auricle
  addVesselTube(
    [
      { x: -0.52, y: 0.62, z: -0.08 },
      { x: -0.58, y: 0.98, z: -0.1 },
      { x: -0.58, y: 1.34, z: -0.12 },
      { x: -0.56, y: 1.66, z: -0.12 },
    ],
    [0.16, 0.15, 0.14, 0.135],
    14,
    'svc',
    [28, 130, 195]
  );

  // 5) 3D Epicardial Coronary Artery Tree (LAD, Circumflex, RCA & Diagonal Branches)
  const buildCoronaryOnSurface = (uvCoords: Array<[number, number]>): Vec3[] =>
    uvCoords.map(([u, v]) => {
      const pt = sculptMyocardiumPoint(u, v);
      return { x: pt.x * 1.025, y: pt.y * 1.025, z: pt.z * 1.025 };
    });

  const coronaries: CoronaryPath3D[] = [
    // Left Anterior Descending (LAD) Artery running down the interventricular groove to the apex
    {
      points: buildCoronaryOnSurface([
        [0.95, 1.38],
        [1.18, 1.44],
        [1.45, 1.48],
        [1.75, 1.52],
        [2.05, 1.54],
        [2.35, 1.55],
        [2.65, 1.52],
      ]),
      color: '#00f0ff',
      width: 3.0,
      isMain: true,
    },
    // First Diagonal Branch (D1) across the Left Ventricle
    {
      points: buildCoronaryOnSurface([
        [1.35, 1.46],
        [1.55, 1.15],
        [1.78, 0.85],
        [2.02, 0.62],
      ]),
      color: '#00f0ff',
      width: 2.0,
      isMain: false,
    },
    // Second Diagonal Branch (D2)
    {
      points: buildCoronaryOnSurface([
        [1.75, 1.52],
        [1.95, 1.22],
        [2.18, 0.96],
      ]),
      color: '#38bdf8',
      width: 1.6,
      isMain: false,
    },
    // Left Circumflex Artery (LCx) wrapping left-posteriorly
    {
      points: buildCoronaryOnSurface([
        [0.98, 1.35],
        [1.08, 0.92],
        [1.22, 0.45],
        [1.42, 0.05],
        [1.68, -0.25],
      ]),
      color: '#ff2e54',
      width: 2.4,
      isMain: true,
    },
    // Right Coronary Artery (RCA) & Acute Marginal Branch
    {
      points: buildCoronaryOnSurface([
        [1.02, 1.75],
        [1.18, 2.15],
        [1.38, 2.52],
        [1.65, 2.78],
        [1.98, 2.92],
      ]),
      color: '#ff2e54',
      width: 2.4,
      isMain: true,
    },
    {
      points: buildCoronaryOnSurface([
        [1.38, 2.52],
        [1.68, 2.25],
        [1.98, 2.05],
      ]),
      color: '#00e5a3',
      width: 1.7,
      isMain: false,
    },
  ];

  return { faces, coronaries };
}

export const BiomedicalHeartCommandCenter: React.FC<BiomedicalHeartCommandCenterProps> = ({
  metrics,
  deviceStatus,
  dataMode,
  ppgWave,
  reducedMotion,
  isLightMode,
  onSelectMetricModal,
  onSwitchDataMode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [showWireframeScan, setShowWireframeScan] = useState(true);
  const [cardiacPhaseLabel, setCardiacPhaseLabel] = useState('VENTRICULAR SYSTOLE • LUB (S1)');
  const [displayedSmoothedBpm, setDisplayedSmoothedBpm] = useState<number>(74);

  // Extract metrics
  const heartMetric = useMemo(
    () => metrics.find((m) => m.key === 'heartRate'),
    [metrics]
  );
  const spo2Metric = useMemo(() => metrics.find((m) => m.key === 'spo2'), [metrics]);
  const hrvMetric = useMemo(() => metrics.find((m) => m.key === 'hrv'), [metrics]);
  const tempMetric = useMemo(
    () => metrics.find((m) => m.key === 'skinTemp'),
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
      sub: 'Chưa có dữ liệu thực — Nhịp chờ độc lập',
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
  const showWireframeRef = useRef<boolean>(showWireframeScan);
  const isLightModeRef = useRef<boolean>(isLightMode);
  const resetCameraTriggerRef = useRef<boolean>(false);

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
    showWireframeRef.current = showWireframeScan;
  }, [showWireframeScan]);

  useEffect(() => {
    isLightModeRef.current = isLightMode;
  }, [isLightMode]);

  // Build SVG path for mini PPG waveform in HUD
  const ppgPath = useMemo(() => {
    if (!ppgWave || ppgWave.length < 2) return '';
    const w = 220;
    const h = 44;
    const vals = ppgWave.map((p) => p.opticalIr);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1;
    return ppgWave
      .map((pt, idx) => {
        const x = (idx / (ppgWave.length - 1)) * w;
        const y = h - ((pt.opticalIr - min) / span) * (h - 10) - 5;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [ppgWave]);

  // Universal 3D Volumetric Software Engine (runs on 100% of browsers even when WebGL is disabled)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { faces, coronaries } = build3DAnatomicalHeartModel();

    // Generate 3D Orbital Particles
    const particles: OrbitalParticle3D[] = Array.from({ length: 95 }, (_, i) => ({
      angle: (i / 95) * Math.PI * 2,
      radius: 1.52 + (i % 7) * 0.11,
      speed: 0.25 + (i % 5) * 0.09,
      tiltX: ((i % 9) - 4) * 0.12,
      tiltZ: ((i % 6) - 2.5) * 0.1,
      size: 1.4 + (i % 3) * 0.7,
      isCyan: i % 3 !== 0,
    }));

    // Pointer / Drag interaction state
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let dragRotY = 0;
    let dragRotX = 0;
    let hoverNormX = 0;
    let hoverNormY = 0;
    let baseAutoAngleY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      hoverNormX = ((e.clientX - rect.left) / (rect.width || 1) - 0.5) * 2;
      hoverNormY = ((e.clientY - rect.top) / (rect.height || 1) - 0.5) * 2;

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        prevX = e.clientX;
        prevY = e.clientY;
        dragRotY += dx * 0.0085;
        dragRotX = Math.max(-0.65, Math.min(0.65, dragRotX + dy * 0.007));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      canvas.releasePointerCapture?.(e.pointerId);
    };

    const onPointerLeave = () => {
      isDragging = false;
      hoverNormX = 0;
      hoverNormY = 0;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);

    let cw = canvas.clientWidth || 520;
    let ch = canvas.clientHeight || 440;
    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = canvas.clientWidth || 520;
      ch = canvas.clientHeight || 440;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    updateSize();

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(canvas);

    let rafId = 0;
    let lastTime = performance.now();
    let cardiacPhase = 0;
    let uiCounter = 0;
    let rotY = 0;
    let rotX = 0;

    // 3D Transformation + Perspective Projection helper
    const transformAndProject = (
      pt: Vec3,
      vPulse: number,
      aPulse: number,
      chamber: HeartFace['chamber'],
      cosY: number,
      sinY: number,
      cosX: number,
      sinX: number,
      cosZ: number,
      sinZ: number,
      centerX: number,
      centerY: number,
      scaleFactor: number
    ) => {
      let x = pt.x;
      let y = pt.y;
      let z = pt.z;

      // Biological Lub-Dub Chamber Contraction (3.8% - 4.6% volume expansion)
      if (chamber === 'lv' || chamber === 'rv') {
        const radial = 1 + vPulse * 0.045;
        const twist = vPulse * 0.04 * (y + 0.5);
        const tx = x * Math.cos(twist) - z * Math.sin(twist);
        const tz = x * Math.sin(twist) + z * Math.cos(twist);
        x = tx * radial;
        z = tz * radial;
        y = y * (1 + vPulse * 0.025);
      } else if (chamber === 'la' || chamber === 'ra') {
        const atrialScale = 1 + aPulse * 0.042 + vPulse * 0.015;
        x *= atrialScale;
        z *= atrialScale;
      } else {
        // Great vessels pulse slightly after ventricular ejection
        const arterialScale = 1 + vPulse * 0.032;
        x *= arterialScale;
        z *= arterialScale;
      }

      // Rotate around Y
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      // Rotate around X
      const y2 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      // Rotate around Z
      const x3 = x1 * cosZ - y2 * sinZ;
      const y3 = x1 * sinZ + y2 * cosZ;

      const fov = 4.2;
      const depth = fov - z2;
      const persp = fov / Math.max(1.2, depth);

      return {
        sx: centerX + x3 * scaleFactor * persp,
        sy: centerY - (y3 - 0.18) * scaleFactor * persp,
        z: z2,
        x3,
        y3,
        persp,
      };
    };

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (document.hidden) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      if (resetCameraTriggerRef.current) {
        dragRotX = 0;
        dragRotY = 0;
        baseAutoAngleY = 0;
        resetCameraTriggerRef.current = false;
      }

      // Smoothly interpolate BPM
      const targetBpm = Math.max(40, Math.min(195, targetBpmRef.current));
      const bpmDelta = targetBpm - smoothedBpmRef.current;
      const maxChange = 6.0 * dt;
      smoothedBpmRef.current += Math.max(-maxChange, Math.min(maxChange, bpmDelta * dt * 2.4));

      const activeBpm = smoothedBpmRef.current;
      cardiacPhase = (cardiacPhase + dt * (activeBpm / 60)) % 1;
      const { ventricularPulse, atrialPulse, shockwavePhase, phaseLabel } =
        evaluateCardiacCycle(cardiacPhase);

      uiCounter++;
      if (uiCounter % 12 === 0) {
        setCardiacPhaseLabel(phaseLabel);
        setDisplayedSmoothedBpm(Math.round(activeBpm));
      }

      const motionMul = reducedMotionRef.current ? 0.35 : 1.0;
      const vPulse = ventricularPulse * motionMul;
      const aPulse = atrialPulse * motionMul;

      if (autoRotateRef.current && !isDragging && !reducedMotionRef.current) {
        baseAutoAngleY += dt * 0.25; // ~1 full revolution every 25 seconds
        dragRotX *= Math.pow(0.93, dt * 60);
      }

      const organicTiltX = reducedMotionRef.current ? 0 : Math.sin(now * 0.0009) * 0.06;
      const organicTiltZ = reducedMotionRef.current ? 0 : Math.cos(now * 0.0007) * 0.045;

      const targetY = baseAutoAngleY + dragRotY + hoverNormX * 0.22;
      const targetX = organicTiltX + dragRotX + hoverNormY * 0.16;

      rotY += (targetY - rotY) * 0.09;
      rotX += (targetX - rotX) * 0.09;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosZ = Math.cos(organicTiltZ);
      const sinZ = Math.sin(organicTiltZ);

      const cx = cw * 0.5;
      const cy = ch * 0.52;
      const baseScale = Math.min(cw, ch) * 0.285;

      ctx.clearRect(0, 0, cw, ch);

      // 1) Volumetric Bioluminescent Core Halo behind the 3D Heart
      const haloRadius = baseScale * (1.55 + vPulse * 0.18);
      const haloGrad = ctx.createRadialGradient(cx, cy, baseScale * 0.15, cx, cy, haloRadius);
      haloGrad.addColorStop(0, `rgba(255, 30, 72, ${0.26 + vPulse * 0.18})`);
      haloGrad.addColorStop(0.45, `rgba(0, 240, 255, ${0.1 + vPulse * 0.08})`);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2) Draw Back Half of 3D Orbital HUD Rings (z < 0)
      const drawOrbitalRing3D = (
        radius3D: number,
        tiltXRad: number,
        tiltZRad: number,
        spinOffset: number,
        color: string,
        lineWidth: number,
        frontHalf: boolean
      ) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        let started = false;
        const segments = 90;
        const cosTX = Math.cos(tiltXRad);
        const sinTX = Math.sin(tiltXRad);
        const ctz = Math.cos(tiltZRad);
        const stz = Math.sin(tiltZRad);

        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2 + spinOffset;
          const rx = Math.cos(a) * radius3D;
          const rz = Math.sin(a) * radius3D;

          // Apply tiltX & tiltZ
          const y1 = -rz * sinTX;
          const z1 = rz * cosTX;
          const x2 = rx * ctz - y1 * stz;
          const y2 = rx * stz + y1 * ctz;

          const isFront = z1 >= 0;
          if (isFront !== frontHalf) {
            started = false;
            continue;
          }

          const fov = 4.2;
          const persp = fov / Math.max(1.2, fov - z1);
          const sx = cx + x2 * baseScale * persp;
          const sy = cy - y2 * baseScale * persp;

          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        }
        ctx.stroke();
        ctx.restore();
      };

      const spin1 = now * 0.0003;
      const spin2 = -now * 0.00045;
      drawOrbitalRing3D(1.88, 1.12, 0.08, spin1, 'rgba(0, 240, 255, 0.25)', 1.3, false);
      drawOrbitalRing3D(1.56, 0.88, -0.36, spin2, 'rgba(0, 229, 163, 0.22)', 1.1, false);
      drawOrbitalRing3D(1.34, -0.95, 0.28, spin1 * 1.2, 'rgba(255, 46, 84, 0.2)', 1.0, false);

      // 3) Project & Depth-Sort 3D Heart Triangles (Painter's Z-buffer algorithm + Volumetric Phong Shading)
      const projectedFaces: Array<{
        p0: { sx: number; sy: number; z: number };
        p1: { sx: number; sy: number; z: number };
        p2: { sx: number; sy: number; z: number };
        depth: number;
        fillStyle: string;
        strokeStyle: string;
      }> = [];

      for (let i = 0; i < faces.length; i++) {
        const f = faces[i];

        // Rotate normal
        const nx1 = f.normal.x * cosY + f.normal.z * sinY;
        const nz1 = -f.normal.x * sinY + f.normal.z * cosY;
        const ny2 = f.normal.y * cosX - nz1 * sinX;
        const nz2 = f.normal.y * sinX + nz1 * cosX;

        // Back-face culling (keep slightly past horizon for smooth rim)
        if (nz2 < -0.15) continue;

        const p0 = transformAndProject(
          f.v0,
          vPulse,
          aPulse,
          f.chamber,
          cosY,
          sinY,
          cosX,
          sinX,
          cosZ,
          sinZ,
          cx,
          cy,
          baseScale
        );
        const p1 = transformAndProject(
          f.v1,
          vPulse,
          aPulse,
          f.chamber,
          cosY,
          sinY,
          cosX,
          sinX,
          cosZ,
          sinZ,
          cx,
          cy,
          baseScale
        );
        const p2 = transformAndProject(
          f.v2,
          vPulse,
          aPulse,
          f.chamber,
          cosY,
          sinY,
          cosX,
          sinX,
          cosZ,
          sinZ,
          cx,
          cy,
          baseScale
        );

        const depth = (p0.z + p1.z + p2.z) / 3;

        // Volumetric Three-Point Biomedical Lighting + Fresnel Rim Glow
        // Key light from top-right-front (0.55, 0.62, 0.56)
        const keyDot = Math.max(0, nx1 * 0.55 + ny2 * 0.62 + nz2 * 0.56);
        // Cyan Rim light from left-back (-0.75, 0.35, 0.25)
        const rimFactor = Math.pow(1 - Math.max(0, nz2), 2.4);
        const cyanRim = Math.max(0, -nx1 * 0.7 + ny2 * 0.3) * rimFactor;
        // Specular highlight (wet epicardial surface sheen)
        const spec = Math.pow(Math.max(0, nz2 * 0.75 + ny2 * 0.45 + nx1 * 0.3), 18) * (0.55 + vPulse * 0.45);
        // Systolic internal bioluminescence
        const pulseGlow = vPulse * 34;

        const [br, bg, bb] = f.baseColor;
        const ambient = 0.28;
        const diffuse = keyDot * 0.82;

        const r = Math.min(255, Math.round(br * (ambient + diffuse) + spec * 230 + pulseGlow + rimFactor * 45));
        const g = Math.min(255, Math.round(bg * (ambient + diffuse) + spec * 140 + cyanRim * 195 + rimFactor * 80));
        const b = Math.min(255, Math.round(bb * (ambient + diffuse) + spec * 175 + cyanRim * 245 + rimFactor * 135));

        const fillStyle = `rgb(${r}, ${g}, ${b})`;
        const strokeStyle = showWireframeRef.current
          ? `rgba(0, 240, 255, ${0.14 + rimFactor * 0.25 + vPulse * 0.12})`
          : fillStyle;

        projectedFaces.push({ p0, p1, p2, depth, fillStyle, strokeStyle });
      }

      // Sort back-to-front
      projectedFaces.sort((a, b) => a.depth - b.depth);

      // Render 3D Heart Triangles
      ctx.lineJoin = 'round';
      for (let i = 0; i < projectedFaces.length; i++) {
        const pf = projectedFaces[i];
        ctx.beginPath();
        ctx.moveTo(pf.p0.sx, pf.p0.sy);
        ctx.lineTo(pf.p1.sx, pf.p1.sy);
        ctx.lineTo(pf.p2.sx, pf.p2.sy);
        ctx.closePath();
        ctx.fillStyle = pf.fillStyle;
        ctx.fill();
        ctx.strokeStyle = pf.strokeStyle;
        ctx.lineWidth = showWireframeRef.current ? 0.65 : 0.45;
        ctx.stroke();
      }

      // 4) Render Glowing Bioluminescent 3D Coronary Arteries on visible front surface
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let c = 0; c < coronaries.length; c++) {
        const cor = coronaries[c];
        ctx.beginPath();
        let started = false;
        for (let j = 0; j < cor.points.length; j++) {
          const proj = transformAndProject(
            cor.points[j],
            vPulse,
            aPulse,
            'lv',
            cosY,
            sinY,
            cosX,
            sinX,
            cosZ,
            sinZ,
            cx,
            cy,
            baseScale
          );
          if (proj.z < -0.1) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(proj.sx, proj.sy);
            started = true;
          } else {
            ctx.lineTo(proj.sx, proj.sy);
          }
        }
        ctx.shadowColor = cor.color;
        ctx.shadowBlur = 8 + vPulse * 10;
        ctx.strokeStyle = cor.color;
        ctx.lineWidth = cor.width * (1 + vPulse * 0.25);
        ctx.globalAlpha = 0.78 + vPulse * 0.22;
        ctx.stroke();
      }
      ctx.restore();

      // 5) Draw Expanding 3D Systolic Shockwave Ring on each Lub-Dub Beat
      if (shockwavePhase > 0 && !reducedMotionRef.current) {
        const shockRadius = 1.15 + shockwavePhase * 1.15;
        const alpha = Math.sin(shockwavePhase * Math.PI) * 0.62;
        const shockColor =
          shockwavePhase < 0.35
            ? `rgba(255, 46, 84, ${alpha.toFixed(3)})`
            : `rgba(0, 240, 255, ${alpha.toFixed(3)})`;
        drawOrbitalRing3D(shockRadius, 1.12, 0.08, 0, shockColor, 2.4, true);
        drawOrbitalRing3D(shockRadius, 1.12, 0.08, 0, shockColor, 1.6, false);
      }

      // 6) Draw Front Half of 3D Orbital HUD Rings (z >= 0)
      drawOrbitalRing3D(1.88, 1.12, 0.08, spin1, 'rgba(0, 240, 255, 0.62)', 1.6, true);
      drawOrbitalRing3D(1.56, 0.88, -0.36, spin2, 'rgba(0, 229, 163, 0.55)', 1.4, true);
      drawOrbitalRing3D(1.34, -0.95, 0.28, spin1 * 1.2, 'rgba(255, 46, 84, 0.45)', 1.2, true);

      // 7) Render Orbiting 3D Telemetry Particles
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!reducedMotionRef.current) {
          p.angle += dt * p.speed * (1 + vPulse * 0.45);
        }
        const rx = Math.cos(p.angle) * p.radius;
        const rz = Math.sin(p.angle) * p.radius;
        const ry = Math.sin(p.angle * 1.5 + p.tiltX) * 0.55;

        const fov = 4.2;
        const persp = fov / Math.max(1.2, fov - rz);
        const sx = cx + rx * baseScale * persp;
        const sy = cy - ry * baseScale * persp;
        const rSize = p.size * persp * (1 + vPulse * 0.35);

        ctx.fillStyle = p.isCyan
          ? `rgba(0, 240, 255, ${0.45 + vPulse * 0.45})`
          : `rgba(255, 46, 84, ${0.5 + vPulse * 0.45})`;
        ctx.beginPath();
        ctx.arc(sx, sy, rSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 8) Subtle Horizontal Laser Bio-Scan Line
      if (showWireframeRef.current && !reducedMotionRef.current) {
        const scanY = cy + Math.sin(now * 0.0014) * (baseScale * 1.15);
        const scanGrad = ctx.createLinearGradient(cx - baseScale * 1.4, scanY, cx + baseScale * 1.4, scanY);
        scanGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        scanGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.38)');
        scanGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.strokeStyle = scanGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - baseScale * 1.4, scanY);
        ctx.lineTo(cx + baseScale * 1.4, scanY);
        ctx.stroke();
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <section
      aria-label="Trung tâm mô phỏng giải phẫu tim 3D thời gian thực"
      className="relative rounded-3xl nexus-glass overflow-hidden border border-cyan-500/25 shadow-2xl"
    >
      {/* Subtle Radial Bio-Scanner Backdrop inside Hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: isLightMode
            ? 'radial-gradient(circle at 50% 50%, rgba(225, 29, 72, 0.07), rgba(2, 132, 199, 0.05) 45%, transparent 75%)'
            : 'radial-gradient(circle at 50% 50%, rgba(255, 46, 84, 0.16), rgba(0, 240, 255, 0.08) 42%, rgba(5, 8, 17, 0.92) 78%)',
        }}
      />

      {/* Top Command Header Bar */}
      <div className="relative z-10 px-5 sm:px-7 pt-5 pb-3 border-b border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/40 flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-tech font-bold uppercase tracking-[0.2em] text-cyan-400">
                BIOMEDICAL 3D CARDIAC CORE • REAL-TIME TELEMETRY HUD
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-tech bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                <Sparkles className="w-3 h-3" />
                3D Multi-Chamber Digital Twin
              </span>
            </div>
            <h2 className="font-display font-bold text-lg sm:text-xl text-white">
              Mô Hình Trái Tim 3D Tương Tác & Đồng Bộ Nhịp Sinh Học (Lub-Dub)
            </h2>
          </div>
        </div>

        {/* Interactive 3D Viewport Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((r) => !r)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono-tech text-slate-200 transition-colors cursor-pointer"
          >
            {autoRotate ? (
              <Pause className="w-3.5 h-3.5 text-cyan-400" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{autoRotate ? 'Tạm dừng xoay' : 'Tiếp tục xoay'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowWireframeScan((w) => !w)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono-tech transition-colors cursor-pointer ${
              showWireframeScan
                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                : 'bg-slate-900/80 border-slate-700/80 text-slate-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Lưới Scan 3D</span>
          </button>

          <button
            type="button"
            onClick={() => {
              resetCameraTriggerRef.current = true;
            }}
            title="Đặt lại góc nhìn 3D mặc định"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono-tech text-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Góc chuẩn</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Command Center Grid: Left HUD | Center 3D Heart | Right HUD */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 p-5 sm:p-7 items-center">
        {/* LEFT HUD TELEMETRY COLUMN */}
        <div className="lg:col-span-3 space-y-3.5 order-2 lg:order-1">
          {/* Primary Heart Rate Synchronized Readout */}
          <div
            onClick={() => onSelectMetricModal('heartRate')}
            className="group relative rounded-2xl bg-slate-900/75 border border-rose-500/35 hover:border-rose-400 p-4 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-rose-400">
                <Heart className="w-3.5 h-3.5" />
                HEART RATE (NHỊP TIM)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-400/30">
                {dataMode === 'demo' ? 'DEMO SYNC' : isLiveValid ? 'LIVE SYNC' : 'STANDBY'}
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display font-bold text-4xl sm:text-5xl text-white tracking-tight">
                {dataMode === 'live' && !isLiveValid ? '--' : displayedSmoothedBpm}
              </span>
              <span className="text-xs font-mono-tech text-rose-400 font-semibold">
                BPM
              </span>
              <span className="ml-auto text-[11px] font-mono-tech text-slate-400">
                {Math.round(60000 / Math.max(40, displayedSmoothedBpm))} ms/chu kỳ
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono-tech">
              <span className="text-cyan-300 truncate">{cardiacPhaseLabel}</span>
              <span className="text-rose-300 group-hover:underline flex items-center gap-0.5 shrink-0">
                Sơ đồ <Maximize2 className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Optical PPG Live Waveform Trace */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Activity className="w-3.5 h-3.5" />
                PPG OPTICAL WAVEFORM
              </span>
              <span className="text-[10px] text-slate-400">MAX30102 IR</span>
            </div>

            <div className="h-12 w-full bg-slate-950/70 rounded-xl border border-slate-800/80 px-2 py-1 flex items-center">
              {ppgPath ? (
                <svg viewBox="0 0 220 44" className="w-full h-full overflow-visible">
                  <path
                    d={ppgPath}
                    fill="none"
                    stroke="#00f0ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span className="text-xs font-mono-tech text-slate-400">
                  Đang chờ tín hiệu quang học...
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] font-mono-tech text-slate-400">
              <span>Chu kỳ: Lub-Dub (S1/S2)</span>
              <span>Biên độ co: +4.2% thể tích</span>
            </div>
          </div>

          {/* Quick Secondary Vitals (SpO2 & HRV) */}
          <div className="grid grid-cols-2 gap-2.5">
            <div
              onClick={() => onSelectMetricModal('spo2')}
              className="rounded-xl bg-slate-900/75 border border-slate-800 hover:border-cyan-400/60 p-3 cursor-pointer transition-colors"
            >
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">
                BLOOD OXYGEN
              </div>
              <div className="mt-1 font-display font-bold text-xl text-cyan-400">
                {spo2Metric?.formattedValue ?? '--'}
                <span className="text-xs font-mono-tech ml-1 text-slate-400">%</span>
              </div>
              <div className="text-[10px] font-mono-tech text-slate-400 mt-0.5">
                Bấm xem sơ đồ ↗
              </div>
            </div>

            <div
              onClick={() => onSelectMetricModal('hrv')}
              className="rounded-xl bg-slate-900/75 border border-slate-800 hover:border-emerald-400/60 p-3 cursor-pointer transition-colors"
            >
              <div className="text-[10px] font-mono-tech text-slate-400 uppercase">
                HRV (RMSSD)
              </div>
              <div className="mt-1 font-display font-bold text-xl text-emerald-400">
                {hrvMetric?.formattedValue ?? '--'}
                <span className="text-xs font-mono-tech ml-1 text-slate-400">ms</span>
              </div>
              <div className="text-[10px] font-mono-tech text-slate-400 mt-0.5">
                Bấm xem sơ đồ ↗
              </div>
            </div>
          </div>
        </div>

        {/* CENTER 3D ANATOMICAL HEART STAGE */}
        <div className="lg:col-span-6 relative flex flex-col items-center justify-center order-1 lg:order-2">
          {/* Decorative HUD Corner Brackets & Radar Crosshairs */}
          <div className="pointer-events-none absolute inset-2 sm:inset-4 border border-cyan-500/15 rounded-3xl">
            <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
            <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
            <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />

            {/* Subtle HUD callout lines connecting center heart to side panels on desktop */}
            <svg
              className="hidden lg:block absolute inset-0 w-full h-full"
              viewBox="0 0 600 440"
              fill="none"
            >
              <path
                d="M 195 160 L 115 110 L 18 110"
                stroke="rgba(255, 46, 84, 0.45)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="195" cy="160" r="3.5" fill="#ff2e54" />
              <path
                d="M 210 270 L 130 270 L 18 270"
                stroke="rgba(0, 240, 255, 0.4)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="210" cy="270" r="3.5" fill="#00f0ff" />
              <path
                d="M 405 155 L 485 110 L 582 110"
                stroke="rgba(0, 229, 163, 0.45)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="405" cy="155" r="3.5" fill="#00e5a3" />
              <path
                d="M 395 275 L 475 275 L 582 275"
                stroke="rgba(0, 240, 255, 0.4)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="395" cy="275" r="3.5" fill="#00f0ff" />
            </svg>
          </div>

          {/* Universal 3D Volumetric Canvas (Works on 100% of browsers even with WebGL disabled) */}
          <canvas
            ref={canvasRef}
            title="Nhấn giữ và kéo chuột để xoay quan sát mô hình Trái Tim 3D từ mọi góc độ"
            className="w-full h-[360px] sm:h-[430px] lg:h-[460px] cursor-grab active:cursor-grabbing select-none touch-none"
          />

          {/* Bottom Center Interactive Instruction Pill */}
          <div className="relative z-10 -mt-2 mb-1 px-3.5 py-1 rounded-full bg-slate-900/85 border border-slate-700/80 text-[11px] font-mono-tech text-slate-300 flex items-center gap-2 shadow-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              Kéo chuột để xoay 360° • Chu kỳ đập thực tế:{' '}
              <strong className="text-cyan-300">
                {(60 / Math.max(40, displayedSmoothedBpm)).toFixed(2)}s
              </strong>{' '}
              ({displayedSmoothedBpm} BPM)
            </span>
          </div>
        </div>

        {/* RIGHT HUD TELEMETRY COLUMN */}
        <div className="lg:col-span-3 space-y-3.5 order-3">
          {/* Device Status HUD Box */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-cyan-400">
                <Radio className="w-3.5 h-3.5" />
                DEVICE STATUS
              </span>
              {deviceStatus.connectionState === 'connected' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono-tech font-bold border ${statusBadge.colorClass}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusBadge.dotClass} animate-pulse`} />
                {statusBadge.code}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-300">{statusBadge.sub}</p>

            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
              <span>LAST UPDATE:</span>
              <span className="text-slate-200 font-semibold">
                {deviceStatus.lastSync}
              </span>
            </div>
          </div>

          {/* Signal Quality & Sensor Diagnostics */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4">
            <div className="flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                <Cpu className="w-3.5 h-3.5" />
                SIGNAL QUALITY
              </span>
              <span className="text-xs font-mono-tech font-bold text-emerald-300">
                {signalQualityInfo.value}
              </span>
            </div>

            <div className="mt-2 w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                style={{
                  width:
                    signalQualityInfo.value === 'N/A'
                      ? '15%'
                      : signalQualityInfo.value,
                }}
              />
            </div>

            <div className="mt-2 text-[11px] font-mono-tech text-slate-300">
              {signalQualityInfo.detail}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono-tech text-slate-400">
              <span>Nhiệt độ da:</span>
              <button
                type="button"
                onClick={() => onSelectMetricModal('skinTemp')}
                className="text-amber-300 hover:underline cursor-pointer font-semibold"
              >
                {tempMetric?.formattedValue ?? '--'} °C ↗
              </button>
            </div>
          </div>

          {/* Scientific Honesty & Mode Switcher Box */}
          <div className="rounded-2xl bg-slate-900/75 border border-slate-800 p-4 space-y-2.5">
            <div className="flex items-start gap-2 text-[11px] text-slate-300 leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Mô hình 3D thủ tục đa buồng tim mô phỏng chu kỳ co bóp sinh học{' '}
                <strong>Lub-Dub</strong> dựa trên BPM ước tính, không thay thế hình ảnh siêu âm/CT lâm sàng.
              </span>
            </div>

            <button
              type="button"
              onClick={() => onSwitchDataMode(dataMode === 'demo' ? 'live' : 'demo')}
              className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-xs font-mono-tech font-semibold text-cyan-200 transition-colors cursor-pointer"
            >
              Chuyển sang {dataMode === 'demo' ? 'LIVE ESP32 MODE' : 'DEMO SIMULATION'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
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

/**
 * Evaluates a physiological "lub-dub" cardiac contraction curve for phase in [0, 1).
 * Returns:
 * - ventricularPulse: main systolic impulse (0..1) -> scaled to 3.5% - 4.8% volume change
 * - atrialPulse: pre-systolic atrial kick (0..1)
 * - shockwavePhase: progress of outward energy ring (0..1)
 * - phaseLabel: current physiological stage name
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

  // Combine with subtle baseline breathing tone
  const ventricularPulse = Math.min(1, primarySystole + secondaryDub);

  // Outward shockwave propagates from p = 0.18 to p = 0.92
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

/**
 * Deforms a sphere geometry into an organic, multi-lobed myocardial chamber with
 * interventricular grooves and subtle muscular surface ridges.
 */
function createSculptedMyocardiumGeometry(): THREE.BufferGeometry {
  const geom = new THREE.SphereGeometry(1.0, 64, 64);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const x = v.x;
    const y = v.y;
    const z = v.z;

    // Normalize y from [-1, 1] to [0, 1] (0 = apex bottom, 1 = base top)
    const yn = (y + 1) * 0.5;

    // Conical tapering toward the inferior-left apex
    const taper = 0.42 + 0.68 * Math.pow(yn, 0.62);
    let nx = x * taper;
    let nz = z * taper * 0.86;
    let ny = y * 1.18;

    // Characteristic anatomical leftward & anterior tilt of the cardiac apex
    nx += (1 - yn) * 0.24;
    nz += (1 - yn) * 0.12;

    // Superior cleft between left/right atrial bases
    if (y > 0.35) {
      const cleft = Math.exp(-Math.pow(x * 3.2, 2)) * Math.pow((y - 0.35) / 0.65, 1.4);
      ny -= cleft * 0.26;
    }

    // Anterior & posterior interventricular sulcus (groove separating LV and RV)
    const sulcusPlane = x + 0.12 * y - 0.08;
    const sulcusDepth = Math.exp(-Math.pow(sulcusPlane * 5.5, 2)) * (1 - Math.pow(yn - 0.45, 2));
    const radiusScale = 1 - sulcusDepth * 0.09;

    // Subtle organic myocardial fiber undulation
    const fiberRipple =
      0.018 * Math.sin(x * 9 + y * 7) * Math.cos(z * 8 - y * 5) +
      0.01 * Math.sin(x * 18 - z * 16);

    nx = nx * radiusScale + v.x * fiberRipple;
    ny = ny + v.y * fiberRipple;
    nz = nz * radiusScale + v.z * fiberRipple;

    pos.setXYZ(i, nx, ny, nz);
  }

  geom.computeVertexNormals();
  return geom;
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
  const mountRef = useRef<HTMLDivElement>(null);

  const [webglSupported, setWebglSupported] = useState(true);
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
      : 60; // Standby calm rhythm when Live is disconnected

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

  // Refs synced into the single rAF loop so we never recreate the WebGL context on prop updates
  const targetBpmRef = useRef<number>(rawTargetBpm);
  const smoothedBpmRef = useRef<number>(rawTargetBpm);
  const autoRotateRef = useRef<boolean>(autoRotate);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const showWireframeRef = useRef<boolean>(showWireframeScan);
  const isLiveStandbyRef = useRef<boolean>(dataMode === 'live' && !isLiveValid);
  const resetCameraTriggerRef = useRef<boolean>(false);

  useEffect(() => {
    targetBpmRef.current = rawTargetBpm;
    isLiveStandbyRef.current = dataMode === 'live' && !isLiveValid;
  }, [rawTargetBpm, dataMode, isLiveValid]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    showWireframeRef.current = showWireframeScan;
  }, [showWireframeScan]);

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

  // Initialize Three.js Scene & Single Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Verify WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || 520;
    const height = container.clientHeight || 460;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 5.4);

    // Master groups
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const heartAssembly = new THREE.Group();
    rootGroup.add(heartAssembly);

    // --- 1. LIGHTING RIG (Volumetric Biomedical Lab Style) ---
    const ambientLight = new THREE.AmbientLight(0x1e293b, 1.5);
    scene.add(ambientLight);

    const keyCrimsonLight = new THREE.DirectionalLight(0xff3b5c, 2.8);
    keyCrimsonLight.position.set(3.5, 4.0, 4.2);
    scene.add(keyCrimsonLight);

    const rimCyanLight = new THREE.DirectionalLight(0x00f0ff, 2.6);
    rimCyanLight.position.set(-4.2, 2.2, -3.0);
    scene.add(rimCyanLight);

    const fillTealLight = new THREE.DirectionalLight(0x00e5a3, 1.4);
    fillTealLight.position.set(0.5, -4.0, 2.5);
    scene.add(fillTealLight);

    // Dynamic internal/core pulse light
    const corePulseLight = new THREE.PointLight(0xff1e42, 2.2, 7.5, 1.6);
    corePulseLight.position.set(0.1, 0.0, 0.6);
    heartAssembly.add(corePulseLight);

    // --- 2. PROCEDURAL MULTI-CHAMBER 3D HEART GEOMETRY & MATERIALS ---
    const myocardiumMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x9e0b28),
      emissive: new THREE.Color(0x3a0310),
      emissiveIntensity: 0.55,
      roughness: 0.28,
      metalness: 0.08,
      clearcoat: 0.9,
      clearcoatRoughness: 0.16,
      sheen: 0.85,
      sheenColor: new THREE.Color(0xff5c7c),
      reflectivity: 0.75,
    });

    const vesselArterialMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xb81432),
      emissive: new THREE.Color(0x420512),
      emissiveIntensity: 0.45,
      roughness: 0.32,
      metalness: 0.1,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    });

    const vesselVenousMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x1e3a6e),
      emissive: new THREE.Color(0x061b3a),
      emissiveIntensity: 0.5,
      roughness: 0.32,
      metalness: 0.15,
      clearcoat: 0.75,
    });

    const coronaryGlowMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x00f0ff),
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 1.6,
      roughness: 0.2,
      transparent: true,
      opacity: 0.88,
    });

    const scanWireframeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x00f0ff),
      wireframe: true,
      transparent: true,
      opacity: 0.09,
    });

    // Ventricular Mass (Left + Right Ventricles sculpted)
    const ventriclesGroup = new THREE.Group();
    const mainMyocardiumGeom = createSculptedMyocardiumGeometry();
    const mainMyocardiumMesh = new THREE.Mesh(mainMyocardiumGeom, myocardiumMaterial);
    ventriclesGroup.add(mainMyocardiumMesh);

    // Holographic wireframe overlay on myocardium
    const wireframeOverlayMesh = new THREE.Mesh(mainMyocardiumGeom, scanWireframeMaterial);
    wireframeOverlayMesh.scale.setScalar(1.018);
    ventriclesGroup.add(wireframeOverlayMesh);

    // Right Ventricular Infundibulum / Conus Arteriosus bulge
    const rvBulgeGeom = new THREE.SphereGeometry(0.62, 36, 36);
    rvBulgeGeom.scale(0.85, 1.15, 0.78);
    const rvBulgeMesh = new THREE.Mesh(rvBulgeGeom, myocardiumMaterial);
    rvBulgeMesh.position.set(-0.34, 0.18, 0.32);
    rvBulgeMesh.rotation.set(0.15, 0.2, -0.28);
    ventriclesGroup.add(rvBulgeMesh);

    heartAssembly.add(ventriclesGroup);

    // Upper Chambers (Left & Right Atria) + Great Vessels Group
    const atriaAndVesselsGroup = new THREE.Group();

    // Right Atrium
    const rightAtriumGeom = new THREE.SphereGeometry(0.48, 32, 32);
    rightAtriumGeom.scale(0.92, 0.85, 0.88);
    const rightAtriumMesh = new THREE.Mesh(rightAtriumGeom, myocardiumMaterial);
    rightAtriumMesh.position.set(-0.56, 0.74, -0.05);
    atriaAndVesselsGroup.add(rightAtriumMesh);

    // Left Atrium
    const leftAtriumGeom = new THREE.SphereGeometry(0.46, 32, 32);
    leftAtriumGeom.scale(0.95, 0.82, 0.88);
    const leftAtriumMesh = new THREE.Mesh(leftAtriumGeom, myocardiumMaterial);
    leftAtriumMesh.position.set(0.45, 0.78, -0.22);
    atriaAndVesselsGroup.add(leftAtriumMesh);

    // Ascending Aorta & Aortic Arch (CatmullRomCurve3)
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, 0.55, 0.05),
      new THREE.Vector3(0.12, 1.18, 0.08),
      new THREE.Vector3(0.0, 1.56, -0.05),
      new THREE.Vector3(-0.32, 1.48, -0.28),
      new THREE.Vector3(-0.42, 0.95, -0.45),
    ]);
    const aortaGeom = new THREE.TubeGeometry(aortaCurve, 40, 0.21, 20, false);
    const aortaMesh = new THREE.Mesh(aortaGeom, vesselArterialMaterial);
    atriaAndVesselsGroup.add(aortaMesh);

    // 3 Supra-aortic arterial branches (Brachiocephalic, Left Carotid, Left Subclavian)
    const branchPositions = [
      [new THREE.Vector3(0.08, 1.48, 0.0), new THREE.Vector3(0.16, 1.88, 0.02)],
      [new THREE.Vector3(-0.06, 1.54, -0.08), new THREE.Vector3(-0.04, 1.94, -0.08)],
      [new THREE.Vector3(-0.2, 1.5, -0.18), new THREE.Vector3(-0.24, 1.88, -0.2)],
    ];
    branchPositions.forEach((pts) => {
      const bCurve = new THREE.CatmullRomCurve3(pts);
      const bGeom = new THREE.TubeGeometry(bCurve, 12, 0.065, 12, false);
      atriaAndVesselsGroup.add(new THREE.Mesh(bGeom, vesselArterialMaterial));
    });

    // Pulmonary Artery Trunk & Bifurcation
    const pulmonaryCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.28, 0.55, 0.35),
      new THREE.Vector3(-0.12, 1.05, 0.26),
      new THREE.Vector3(0.28, 1.22, 0.08),
      new THREE.Vector3(0.62, 1.18, -0.12),
    ]);
    const pulmonaryGeom = new THREE.TubeGeometry(pulmonaryCurve, 32, 0.17, 18, false);
    atriaAndVesselsGroup.add(new THREE.Mesh(pulmonaryGeom, vesselVenousMaterial));

    // Superior & Inferior Vena Cava
    const svcCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.62, 0.75, -0.12),
      new THREE.Vector3(-0.66, 1.38, -0.15),
      new THREE.Vector3(-0.64, 1.78, -0.14),
    ]);
    const svcGeom = new THREE.TubeGeometry(svcCurve, 20, 0.14, 16, false);
    atriaAndVesselsGroup.add(new THREE.Mesh(svcGeom, vesselVenousMaterial));

    // Glowing Bioluminescent Coronary Artery Branches hugging the myocardium
    const ladCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, 0.65, 0.68),
      new THREE.Vector3(-0.04, 0.25, 0.85),
      new THREE.Vector3(0.05, -0.22, 0.8),
      new THREE.Vector3(0.16, -0.68, 0.58),
      new THREE.Vector3(0.24, -0.98, 0.3),
    ]);
    const ladGeom = new THREE.TubeGeometry(ladCurve, 36, 0.024, 10, false);
    const ladMesh = new THREE.Mesh(ladGeom, coronaryGlowMaterial);
    ventriclesGroup.add(ladMesh);

    const diagCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.01, 0.15, 0.84),
      new THREE.Vector3(0.28, -0.05, 0.78),
      new THREE.Vector3(0.52, -0.35, 0.56),
    ]);
    const diagGeom = new THREE.TubeGeometry(diagCurve, 24, 0.016, 8, false);
    ventriclesGroup.add(new THREE.Mesh(diagGeom, coronaryGlowMaterial));

    const rcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.25, 0.55, 0.62),
      new THREE.Vector3(-0.62, 0.2, 0.56),
      new THREE.Vector3(-0.68, -0.25, 0.42),
      new THREE.Vector3(-0.42, -0.65, 0.32),
    ]);
    const rcaGeom = new THREE.TubeGeometry(rcaCurve, 28, 0.019, 8, false);
    ventriclesGroup.add(new THREE.Mesh(rcaGeom, coronaryGlowMaterial));

    heartAssembly.add(atriaAndVesselsGroup);
    // Center the whole heart assembly vertically
    heartAssembly.position.set(0, -0.22, 0);

    // --- 3. ORBITAL HUD RINGS, DATA NODES & PARTICLE STREAMS ---
    const orbitalsGroup = new THREE.Group();
    rootGroup.add(orbitalsGroup);

    // Ring 1: Outer Calibrated Equatorial Ring
    const outerRingGeom = new THREE.TorusGeometry(1.92, 0.012, 12, 120);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.42,
    });
    const outerRingMesh = new THREE.Mesh(outerRingGeom, outerRingMat);
    outerRingMesh.rotation.x = Math.PI / 2.25;
    orbitalsGroup.add(outerRingMesh);

    // Ring 2: Inclined Telemetry Orbit with Glowing Data Nodes
    const midRingGroup = new THREE.Group();
    midRingGroup.rotation.set(Math.PI / 3.1, 0.38, -0.24);
    const midRingGeom = new THREE.TorusGeometry(1.58, 0.01, 12, 100);
    const midRingMat = new THREE.MeshBasicMaterial({
      color: 0x00e5a3,
      transparent: true,
      opacity: 0.35,
    });
    midRingGroup.add(new THREE.Mesh(midRingGeom, midRingMat));

    const nodeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
    });
    const nodeGeom = new THREE.SphereGeometry(0.042, 12, 12);
    const orbitalNodes: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const nMesh = new THREE.Mesh(nodeGeom, nodeMat);
      nMesh.position.set(Math.cos(angle) * 1.58, Math.sin(angle) * 1.58, 0);
      midRingGroup.add(nMesh);
      orbitalNodes.push(nMesh);
    }
    orbitalsGroup.add(midRingGroup);

    // Ring 3: Polar Gyroscopic Scanner Ring
    const innerRingGeom = new THREE.TorusGeometry(1.36, 0.008, 10, 90);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0xff2e54,
      transparent: true,
      opacity: 0.28,
    });
    const innerRingMesh = new THREE.Mesh(innerRingGeom, innerRingMat);
    innerRingMesh.rotation.set(-Math.PI / 2.8, -0.45, 0.15);
    orbitalsGroup.add(innerRingMesh);

    // Expanding Systolic Shockwave Ring (pulses outward on every heartbeat)
    const shockwaveGeom = new THREE.RingGeometry(1.05, 1.16, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeom, shockwaveMat);
    shockwaveMesh.rotation.x = Math.PI / 2.25;
    rootGroup.add(shockwaveMesh);

    // Orbiting Biomedical Particle Stream
    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleAngles = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    const particleTilts = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particleAngles[i] = Math.random() * Math.PI * 2;
      particleRadii[i] = 1.35 + Math.random() * 0.85;
      particleSpeeds[i] = 0.25 + Math.random() * 0.55;
      particleTilts[i] = (Math.random() - 0.5) * 1.2;
    }

    const particlesGeom = new THREE.BufferGeometry();
    particlesGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.042,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particlesGeom, particlesMat);
    rootGroup.add(particleSystem);

    // --- 4. INTERACTIVE POINTER / DRAG ORBIT CONTROLS ---
    let isDragging = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let dragRotY = 0;
    let dragRotX = 0;
    let hoverNormX = 0;
    let hoverNormY = 0;
    let baseAutoAngleY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      container.setPointerCapture?.(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      hoverNormX = ((e.clientX - rect.left) / (rect.width || 1) - 0.5) * 2;
      hoverNormY = ((e.clientY - rect.top) / (rect.height || 1) - 0.5) * 2;

      if (isDragging) {
        const dx = e.clientX - prevPointerX;
        const dy = e.clientY - prevPointerY;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;
        dragRotY += dx * 0.0085;
        dragRotX = Math.max(-0.65, Math.min(0.65, dragRotX + dy * 0.007));
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      isDragging = false;
      container.releasePointerCapture?.(e.pointerId);
    };

    const handlePointerLeave = () => {
      isDragging = false;
      hoverNormX = 0;
      hoverNormY = 0;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);
    container.addEventListener('pointerleave', handlePointerLeave);

    // ResizeObserver for responsive container
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = entry.contentRect.width;
        const ch = entry.contentRect.height;
        if (cw > 0 && ch > 0) {
          camera.aspect = cw / ch;
          camera.updateProjectionMatrix();
          renderer.setSize(cw, ch);
        }
      }
    });
    resizeObserver.observe(container);

    // --- 5. SINGLE HIGH-EFFICIENCY REQUESTANIMATIONFRAME LOOP ---
    let rafId = 0;
    let lastTime = performance.now();
    let cardiacPhase = 0;
    let uiSyncCounter = 0;

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);

      // Pause heavy updates when browser tab is hidden
      if (document.hidden) {
        lastTime = now;
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Reset camera angle if requested
      if (resetCameraTriggerRef.current) {
        dragRotX = 0;
        dragRotY = 0;
        baseAutoAngleY = 0;
        resetCameraTriggerRef.current = false;
      }

      // Smoothly interpolate BPM (clamping max rate of change to avoid jitter in LIVE mode)
      const targetBpm = Math.max(40, Math.min(195, targetBpmRef.current));
      const bpmDelta = targetBpm - smoothedBpmRef.current;
      const maxChange = 6.0 * dt;
      smoothedBpmRef.current += Math.max(-maxChange, Math.min(maxChange, bpmDelta * dt * 2.4));

      const activeBpm = smoothedBpmRef.current;
      const beatsPerSecond = activeBpm / 60;

      // Advance biological cardiac phase
      cardiacPhase = (cardiacPhase + dt * beatsPerSecond) % 1;
      const { ventricularPulse, atrialPulse, shockwavePhase, phaseLabel } =
        evaluateCardiacCycle(cardiacPhase);

      // Update React HUD label throttled (~5 times per second)
      uiSyncCounter++;
      if (uiSyncCounter % 12 === 0) {
        setCardiacPhaseLabel(phaseLabel);
        setDisplayedSmoothedBpm(Math.round(activeBpm));
      }

      // 1) Biological Contraction Scale (3.5% - 4.6% volume change, never rubbery)
      const motionScale = reducedMotionRef.current ? 0.35 : 1.0;
      const vPulse = ventricularPulse * motionScale;
      const aPulse = atrialPulse * motionScale;

      // Ventricles expand radially (+4.2%) and twist slightly during systole
      const radialScale = 1 + vPulse * 0.044;
      const longitudinalScale = 1 + vPulse * 0.026 - aPulse * 0.01;
      ventriclesGroup.scale.set(radialScale, longitudinalScale, radialScale);
      ventriclesGroup.rotation.y = vPulse * 0.032;

      // Atria contract slightly ahead of ventricles
      const atrialScale = 1 + aPulse * 0.036 + vPulse * 0.015;
      atriaAndVesselsGroup.scale.set(atrialScale, 1 + vPulse * 0.022, atrialScale);

      // 2) Dynamic Bioluminescence & Core Light Synchronized with Heartbeat
      myocardiumMaterial.emissiveIntensity = 0.42 + vPulse * 0.65;
      coronaryGlowMaterial.emissiveIntensity = 1.1 + vPulse * 1.6;
      corePulseLight.intensity = 1.8 + vPulse * 2.6;
      wireframeOverlayMesh.visible = showWireframeRef.current;

      // 3) Outward Shockwave Ring Animation
      if (shockwavePhase > 0 && !reducedMotionRef.current) {
        const waveScale = 1.0 + shockwavePhase * 1.15;
        shockwaveMesh.scale.setScalar(waveScale);
        shockwaveMat.opacity = Math.sin(shockwavePhase * Math.PI) * 0.48;
        shockwaveMat.color.setHex(
          isLiveStandbyRef.current ? 0xf59e0b : shockwavePhase < 0.35 ? 0xff2e54 : 0x00f0ff
        );
      } else {
        shockwaveMat.opacity = 0;
      }

      // 4) Orbital Nodes Pulse & Rotation
      const nodeScale = 1 + vPulse * 0.45;
      for (let i = 0; i < orbitalNodes.length; i++) {
        orbitalNodes[i].scale.setScalar(nodeScale);
      }

      // 5) Slow Continuous Rotation (~1 revolution in 25s = 0.25 rad/s) + Mouse Parallax
      if (autoRotateRef.current && !isDragging && !reducedMotionRef.current) {
        baseAutoAngleY += dt * 0.25;
        // Gently decay manual vertical drag back toward neutral when released
        dragRotX *= Math.pow(0.92, dt * 60);
      }

      const organicTiltX = reducedMotionRef.current ? 0 : Math.sin(now * 0.0008) * 0.055;
      const organicTiltZ = reducedMotionRef.current ? 0 : Math.cos(now * 0.00065) * 0.04;

      const targetRotY = baseAutoAngleY + dragRotY + hoverNormX * 0.18;
      const targetRotX = organicTiltX + dragRotX + hoverNormY * 0.14;

      heartAssembly.rotation.y += (targetRotY - heartAssembly.rotation.y) * 0.08;
      heartAssembly.rotation.x += (targetRotX - heartAssembly.rotation.x) * 0.08;
      heartAssembly.rotation.z = organicTiltZ;

      // Orbitals counter-rotation
      if (!reducedMotionRef.current) {
        outerRingMesh.rotation.z += dt * 0.14;
        midRingGroup.rotation.z -= dt * 0.22;
        innerRingMesh.rotation.y += dt * 0.18;

        // Update orbiting telemetry particles
        const posAttr = particlesGeom.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          particleAngles[i] += dt * particleSpeeds[i] * (1 + vPulse * 0.4);
          const a = particleAngles[i];
          const r = particleRadii[i];
          const tilt = particleTilts[i];
          posAttr.setXYZ(
            i,
            Math.cos(a) * r,
            Math.sin(a * 1.3) * tilt * 0.75,
            Math.sin(a) * r
          );
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    // Cleanup WebGL resources & listeners on unmount
    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('pointerleave', handlePointerLeave);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
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
                Three.js Procedural 3D Model
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
            {autoRotate ? <Pause className="w-3.5 h-3.5 text-cyan-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
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
              {/* Left connector to Heart Rate */}
              <path
                d="M 195 160 L 115 110 L 18 110"
                stroke="rgba(255, 46, 84, 0.45)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="195" cy="160" r="3.5" fill="#ff2e54" />
              {/* Left bottom connector to PPG */}
              <path
                d="M 210 270 L 130 270 L 18 270"
                stroke="rgba(0, 240, 255, 0.4)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="210" cy="270" r="3.5" fill="#00f0ff" />
              {/* Right top connector to Device Status */}
              <path
                d="M 405 155 L 485 110 L 582 110"
                stroke="rgba(0, 229, 163, 0.45)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="405" cy="155" r="3.5" fill="#00e5a3" />
              {/* Right bottom connector to Signal Quality */}
              <path
                d="M 395 275 L 475 275 L 582 275"
                stroke="rgba(0, 240, 255, 0.4)"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <circle cx="395" cy="275" r="3.5" fill="#00f0ff" />
            </svg>
          </div>

          {/* 3D WebGL Canvas Mount */}
          {webglSupported ? (
            <div
              ref={mountRef}
              title="Nhấn giữ và kéo chuột để xoay quan sát mô hình Trái Tim 3D từ mọi góc độ"
              className="w-full h-[340px] sm:h-[420px] lg:h-[450px] cursor-grab active:cursor-grabbing select-none"
            />
          ) : (
            <div className="w-full h-[340px] flex flex-col items-center justify-center p-6 text-center">
              <Heart className="w-16 h-16 text-rose-500 animate-pulse mb-3" />
              <p className="font-display font-bold text-base">
                Trình duyệt đang tắt tăng tốc phần cứng WebGL
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                Hệ thống tự động chuyển sang chế độ hiển thị dự phòng. Nhịp tim hiện tại:{' '}
                <strong>{displayedSmoothedBpm} BPM</strong>.
              </p>
            </div>
          )}

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

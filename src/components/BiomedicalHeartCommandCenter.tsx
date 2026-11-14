import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  Activity,
  Minimize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  User,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  DataMode,
  DeviceStatusInfo,
  MetricCardData,
  MetricKey,
  PPGWavePoint,
  TelemetryTimeSeriesPoint,
} from '../types/health';
import { FloatingHeartChartsHUD } from './FloatingHeartChartsHUD';

interface BiomedicalHeartCommandCenterProps {
  metrics: MetricCardData[];
  series: TelemetryTimeSeriesPoint[];
  deviceStatus: DeviceStatusInfo;
  dataMode: DataMode;
  ppgWave: PPGWavePoint[];
  reducedMotion: boolean;
  isLightMode: boolean;
  onSelectMetricModal: (key: MetricKey) => void;
  onSwitchDataMode: (mode: DataMode) => void;
}

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

let cachedGlbBufferPromise: Promise<ArrayBuffer> | null = null;
async function getAnatomicalGlbBuffer(): Promise<ArrayBuffer> {
  if (!cachedGlbBufferPromise) {
    cachedGlbBufferPromise = (async () => {
      const candidates = [
        '/models/anatomical_body_heart.glb',
        './models/anatomical_body_heart.glb',
        'models/anatomical_body_heart.glb',
        'https://chichiaicompanion.com/models/anatomical_body_heart.glb',
      ];
      for (const url of candidates) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4500);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 500000) {
              return buf;
            }
          }
        } catch {}
      }
      throw new Error('Failed to load anatomical_body_heart.glb');
    })().catch((err) => {
      cachedGlbBufferPromise = null;
      throw err;
    });
  }
  return cachedGlbBufferPromise;
}

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  // Dual view mode: 'body' (translucent body overview) vs 'heart' (zoomed heart detail)
  const [viewMode, setViewMode] = useState<'body' | 'heart'>('body');
  const viewModeRef = useRef<'body' | 'heart'>('body');
  viewModeRef.current = viewMode;

  const [modelLoaded, setModelLoaded] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [cardiacPhaseLabel, setCardiacPhaseLabel] = useState('DIASTOLE (THƯ GIÃN)');
  const [displayedSmoothedBpm, setDisplayedSmoothedBpm] = useState(74);
  const [webGlSupported, setWebGlSupported] = useState(true);

  const resetCameraTriggerRef = useRef(false);
  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const isLightModeRef = useRef(isLightMode);
  isLightModeRef.current = isLightMode;

  // External refs for raycasting hit testing
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const heartGroupRef = useRef<THREE.Group | null>(null);
  const hotspotGroupRef = useRef<THREE.Group | null>(null);
  const targetRotYRef = useRef(-0.12);
  const targetRotXRef = useRef(0.04);

  // Heart rate source
  const targetBpm = useMemo(() => {
    if (dataMode === 'live') {
      const liveHr = metrics.find((m) => m.key === 'heartRate')?.value;
      if (liveHr && typeof liveHr === 'number' && liveHr >= 40 && liveHr <= 200) {
        return liveHr;
      }
      return 76;
    }
    const demoHr = metrics.find((m) => m.key === 'heartRate')?.value;
    return typeof demoHr === 'number' ? demoHr : 74;
  }, [dataMode, metrics]);

  const targetBpmRef = useRef(targetBpm);
  targetBpmRef.current = targetBpm;
  const smoothedBpmRef = useRef(targetBpm);

  const isLiveValid = dataMode === 'live' && deviceStatus.connected;
  const statusBadge = useMemo(() => {
    if (dataMode === 'live') {
      return isLiveValid
        ? { label: 'LIVE ESP32 HOẠT ĐỘNG', dotClass: 'bg-emerald-400 animate-pulse', code: 'ESP32 ONLINE' }
        : { label: 'ESP32 MẤT KẾT NỐI', dotClass: 'bg-rose-500', code: 'ESP32 OFFLINE' };
    }
    return { label: 'DEMO SIMULATION', dotClass: 'bg-amber-400 animate-pulse', code: 'DEMO MODE' };
  }, [dataMode, isLiveValid]);

  const signalQualityInfo = useMemo(() => {
    if (dataMode === 'live' && !isLiveValid) return { text: 'Mất tín hiệu', value: '0%' };
    return { text: 'Tín hiệu xuất sắc', value: '98.6%' };
  }, [dataMode, isLiveValid]);

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'body' ? 'heart' : 'body'));
  }, []);

  const handleCloseDetail = useCallback(() => {
    setViewMode('body');
  }, []);

  // Mini PPG waveform
  const ppgPath = useMemo(() => {
    if (!ppgWave || ppgWave.length < 2) return '';
    const clean = ppgWave.filter((p) => p && Number.isFinite(p.opticalIr));
    if (clean.length < 2) return '';
    const w = 120;
    const h = 24;
    const vals = clean.map((p) => Number(p.opticalIr));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max > min ? max - min : 1;
    return clean
      .map((pt, idx) => {
        const x = (idx / (clean.length - 1)) * w;
        const y = h - ((pt.opticalIr - min) / span) * (h - 6) - 3;
        return `${idx === 0 ? 'M' : 'L'} ${Number.isFinite(x) ? x.toFixed(1) : '0'} ${Number.isFinite(y) ? y.toFixed(1) : '0'}`;
      })
      .join(' ');
  }, [ppgWave]);

  // Main Three.js WebGL GPU Engine (60-120 FPS hardware accelerated)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isCancelled = false;
    let animId = 0;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          powerPreference: 'default',
        });
      } catch (err) {
        console.warn('WebGL initialization failed, using 2D fallback mode:', err);
        setWebGlSupported(false);
        return;
      }
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLightModeRef.current ? 1.05 : 1.18;

    const scene = new THREE.Scene();

    // Responsive camera setup
    const rect = canvas.getBoundingClientRect();
    let cachedWidth = Math.max(280, Math.floor(rect.width || 800));
    let cachedHeight = Math.max(380, Math.floor(rect.height || 600));
    let isSizeDirty = false;
    renderer.setSize(cachedWidth, cachedHeight, false);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.max(280, Math.floor(width));
        const h = Math.max(380, Math.floor(height));
        if (w !== cachedWidth || h !== cachedHeight) {
          cachedWidth = w;
          cachedHeight = h;
          isSizeDirty = true;
        }
      }
    });
    resizeObserver.observe(canvas);

    const isInitialMobile = cachedWidth < 640;
    const camera = new THREE.PerspectiveCamera(36, cachedWidth / cachedHeight, 0.1, 100);
    const initialCamPos = new THREE.Vector3(0, isInitialMobile ? -1.0 : -0.9, isInitialMobile ? 27.5 : 23.5);
    const initialLookAt = new THREE.Vector3(0, isInitialMobile ? -1.0 : -0.9, 0);
    camera.position.copy(initialCamPos);
    camera.lookAt(initialLookAt);
    cameraRef.current = camera;

    // Studio Lighting
    const isLight = isLightModeRef.current;
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 1.5 : 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, isLight ? 1.8 : 1.6);
    keyLight.position.set(4, 6, 8);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(isLight ? 0x0284c7 : 0x00f0ff, isLight ? 1.2 : 1.8);
    rimLight.position.set(-5, 3, -6);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xffedd5, isLight ? 0.9 : 0.6);
    fillLight.position.set(0, -4, 6);
    scene.add(fillLight);

    // Root model group
    const modelGroup = new THREE.Group();
    modelGroup.rotation.y = targetRotYRef.current;
    modelGroup.rotation.x = targetRotXRef.current;
    scene.add(modelGroup);

    // Subgroups
    const heartGroup = new THREE.Group();
    heartGroupRef.current = heartGroup;
    modelGroup.add(heartGroup);

    const organGroup = new THREE.Group();
    modelGroup.add(organGroup);

    let torsoMesh: THREE.Mesh | null = null;
    let vesselsMesh: THREE.Mesh | null = null;
    let brainMesh: THREE.Mesh | null = null;

    // Shared materials
    const coronaryMat = new THREE.MeshStandardMaterial({
      color: 0xe02235,
      roughness: 0.24,
      metalness: 0.1,
      emissive: 0xb30e20,
      emissiveIntensity: 0.55,
    });

    const vesselsMat = new THREE.MeshStandardMaterial({
      color: 0xd6182c,
      roughness: 0.22,
      metalness: 0.12,
      emissive: 0xaa1020,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.98,
    });

    const brainMat = new THREE.MeshStandardMaterial({
      color: isLight ? 0xdcaea0 : 0xd09a8c,
      roughness: 0.38,
      metalness: 0.05,
      emissive: 0x78251e,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.96,
    });

    const torsoMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSkinTone: { value: new THREE.Color(isLight ? 0xdfb29b : 0xd2a38b) },
        uSubsurface: { value: new THREE.Color(0xb54338) },
        uOrganAlpha: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uSkinTone;
        uniform vec3 uSubsurface;
        uniform float uOrganAlpha;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPosition);
          float NdotV = max(0.0, dot(N, V));
          float fresnel = pow(1.0 - NdotV, 2.1);
          vec3 col = mix(uSkinTone, uSubsurface, fresnel * 0.75);
          float alpha = (0.16 + fresnel * 0.62) * uOrganAlpha;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    // -------------------------------------------------------------
    // 0-MS INSTANT PROCEDURAL BIO-ANATOMY SETUP (Zero loading freeze!)
    // -------------------------------------------------------------
    const proceduralGroup = new THREE.Group();
    modelGroup.add(proceduralGroup);

    // Procedural Torso Silhoutte
    const torsoShape = new THREE.Shape();
    torsoShape.moveTo(-1.6, -6.5);
    torsoShape.lineTo(-1.8, -3.0);
    torsoShape.lineTo(-2.2, 0.0);
    torsoShape.lineTo(-2.6, 2.5);
    torsoShape.lineTo(-1.2, 3.2);
    torsoShape.lineTo(-0.7, 4.2);
    torsoShape.lineTo(0.7, 4.2);
    torsoShape.lineTo(1.2, 3.2);
    torsoShape.lineTo(2.6, 2.5);
    torsoShape.lineTo(2.2, 0.0);
    torsoShape.lineTo(1.8, -3.0);
    torsoShape.lineTo(1.6, -6.5);
    torsoShape.closePath();

    const extrudeSettings = { depth: 2.2, bevelEnabled: true, bevelSegments: 6, steps: 2, bevelSize: 0.4, bevelThickness: 0.4 };
    const pTorsoGeo = new THREE.ExtrudeGeometry(torsoShape, extrudeSettings);
    pTorsoGeo.center();
    pTorsoGeo.translate(0, -0.6, -0.4);
    const proceduralTorsoMesh = new THREE.Mesh(pTorsoGeo, torsoMaterial);
    proceduralGroup.add(proceduralTorsoMesh);

    // Procedural Anatomical Heart
    const pHeartGeo = new THREE.SphereGeometry(0.85, 24, 24);
    pHeartGeo.scale(0.88, 1.15, 0.92);
    const proceduralHeartMesh = new THREE.Mesh(
      pHeartGeo,
      new THREE.MeshStandardMaterial({
        color: 0x9e1a2b,
        roughness: 0.3,
        metalness: 0.12,
        emissive: 0x38050c,
        emissiveIntensity: 0.4,
      })
    );
    heartGroup.add(proceduralHeartMesh);

    // Procedural Aortic Arch
    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.4, 0),
      new THREE.Vector3(0.15, 1.1, -0.1),
      new THREE.Vector3(-0.35, 1.25, -0.25),
      new THREE.Vector3(-0.45, 0.5, -0.3),
    ]);
    const proceduralAortaMesh = new THREE.Mesh(
      new THREE.TubeGeometry(aortaCurve, 24, 0.14, 12, false),
      new THREE.MeshStandardMaterial({ color: 0xb8202e, roughness: 0.26, metalness: 0.08 })
    );
    heartGroup.add(proceduralAortaMesh);

    // Procedural Brain Cortex
    const pBrainGeo = new THREE.SphereGeometry(1.05, 24, 20);
    pBrainGeo.scale(0.92, 0.85, 1.15);
    const proceduralBrainMesh = new THREE.Mesh(pBrainGeo, brainMat);
    proceduralBrainMesh.position.set(-0.25, 4.8, -0.5);
    proceduralGroup.add(proceduralBrainMesh);
    brainMesh = proceduralBrainMesh;

    // Single Carotid Vessel (Heart to Brain)
    const carotidCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.05, 1.15, -0.12),
      new THREE.Vector3(-0.1, 2.4, -0.3),
      new THREE.Vector3(-0.18, 3.6, -0.45),
      new THREE.Vector3(-0.25, 4.4, -0.5),
    ]);
    const carotidTubeGeo = new THREE.TubeGeometry(carotidCurve, 32, 0.042, 10, false);
    const proceduralCarotidMesh = new THREE.Mesh(carotidTubeGeo, vesselsMat);
    proceduralGroup.add(proceduralCarotidMesh);
    vesselsMesh = proceduralCarotidMesh;

    // Systolic Blood Pulse Particle that rides along the carotid vessel to the brain
    const pulseBallGeo = new THREE.SphereGeometry(0.075, 12, 12);
    const pulseBallMat = new THREE.MeshBasicMaterial({ color: 0xff3b5c });
    const carotidPulseOrb = new THREE.Mesh(pulseBallGeo, pulseBallMat);
    proceduralGroup.add(carotidPulseOrb);

    // -------------------------------------------------------------
    // FUTURISTIC HOLOGRAPHIC BIO-SCANNER BEAM (Animated CT/MRI laser)
    // -------------------------------------------------------------
    const scanPlaneGeo = new THREE.PlaneGeometry(6.4, 4.0);
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: isLight ? 0x0284c7 : 0x00f0ff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const scanPlane = new THREE.Mesh(scanPlaneGeo, scanPlaneMat);
    scanPlane.rotation.x = Math.PI * 0.5;
    proceduralGroup.add(scanPlane);

    const scanLineGeo = new THREE.BufferGeometry();
    const scanLinePos = new Float32Array([-3.2, 0, 0, 3.2, 0, 0]);
    scanLineGeo.setAttribute('position', new THREE.BufferAttribute(scanLinePos, 3));
    const scanLineMat = new THREE.LineBasicMaterial({
      color: isLight ? 0x0284c7 : 0x00f0ff,
      linewidth: 2,
    });
    const scanLine = new THREE.Line(scanLineGeo, scanLineMat);
    scanPlane.add(scanLine);

    // 3D Chest Hotspot Target
    const hotspotGroup = new THREE.Group();
    hotspotGroup.position.set(0.0, -0.05, 1.05);
    hotspotGroupRef.current = hotspotGroup;

    const centerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xe11d48 })
    );
    hotspotGroup.add(centerDot);

    const innerWhiteDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    innerWhiteDot.position.z = 0.05;
    hotspotGroup.add(innerWhiteDot);

    const ringGeo = new THREE.RingGeometry(0.12, 0.15, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xe11d48,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    hotspotGroup.add(ringMesh);
    modelGroup.add(hotspotGroup);

    // Invisible chest hit target for instant taps
    const chestHitTarget = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    chestHitTarget.position.set(0, 0, 0.4);
    modelGroup.add(chestHitTarget);

    // Orbit Ring in Heart Mode
    const orbitGroup = new THREE.Group();
    const orbitRingGeo = new THREE.RingGeometry(1.68, 1.70, 64);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: isLight ? 0x0284c7 : 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const orbitRing = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRing.rotation.x = Math.PI * 0.42;
    orbitRing.rotation.y = -0.15;
    orbitGroup.add(orbitRing);

    const particleCount = 28;
    const particleGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      pPositions[i * 3] = Math.cos(angle) * 1.69;
      pPositions[i * 3 + 1] = Math.sin(angle) * 0.28;
      pPositions[i * 3 + 2] = Math.sin(angle) * 1.69;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: isLight ? 0x0284c7 : 0x00f0ff,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    orbitGroup.add(particles);
    heartGroup.add(orbitGroup);

    // -------------------------------------------------------------
    // BACKGROUND GLB HYDRATION: Seamlessly replace with high-poly GLB
    // -------------------------------------------------------------
    getAnatomicalGlbBuffer()
      .then((rawBuffer) => {
        if (isCancelled) return;
        const loader = new GLTFLoader();
        loader.parse(
          rawBuffer.slice(0),
          '',
          (gltf) => {
            if (isCancelled) return;
            // Remove placeholder procedural torso & heart
            proceduralGroup.remove(proceduralTorsoMesh);
            heartGroup.remove(proceduralHeartMesh);
            heartGroup.remove(proceduralAortaMesh);
            proceduralGroup.remove(proceduralBrainMesh);
            proceduralGroup.remove(proceduralCarotidMesh);

            const allMeshes: THREE.Mesh[] = [];
            gltf.scene.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                allMeshes.push(child as THREE.Mesh);
              }
            });

            allMeshes.forEach((mesh) => {
              if (mesh.name === 'BodyTorso') {
                mesh.material = torsoMaterial;
                torsoMesh = mesh;
                modelGroup.add(mesh);
              } else if (mesh.name === 'Brain') {
                mesh.material = brainMat;
                brainMesh = mesh;
                organGroup.add(mesh);
              } else if (mesh.name === 'RibCage') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0xebe3d5,
                  roughness: 0.42,
                  metalness: 0.05,
                  transparent: true,
                  opacity: 0.86,
                });
                organGroup.add(mesh);
              } else if (mesh.name === 'Trachea') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0xe0d6cb,
                  roughness: 0.32,
                  metalness: 0.05,
                  transparent: true,
                  opacity: 0.92,
                });
                organGroup.add(mesh);
              } else if (mesh.name === 'Lungs') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0xc67c7c,
                  roughness: 0.42,
                  metalness: 0.04,
                  transparent: true,
                  opacity: 0.88,
                });
                organGroup.add(mesh);
              } else if (mesh.name === 'Liver') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0x70241e,
                  roughness: 0.35,
                  metalness: 0.06,
                  transparent: true,
                  opacity: 0.92,
                });
                organGroup.add(mesh);
              } else if (mesh.name === 'Stomach') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0xa04c54,
                  roughness: 0.36,
                  metalness: 0.05,
                  transparent: true,
                  opacity: 0.88,
                });
                organGroup.add(mesh);
              } else if (mesh.name === 'Intestines') {
                mesh.material = new THREE.MeshStandardMaterial({
                  color: 0xb05a50,
                  roughness: 0.36,
                  metalness: 0.05,
                  transparent: true,
                  opacity: 0.90,
                });
                organGroup.add(mesh);
              } else if (mesh.name === 'BloodVessels') {
                // Single carotid vessel
                mesh.material = vesselsMat;
                vesselsMesh = mesh;
                organGroup.add(mesh);
              } else {
                if (mesh.name === 'Myocardium') {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x9e1a2b,
                    roughness: 0.3,
                    metalness: 0.12,
                    emissive: 0x38050c,
                    emissiveIntensity: 0.4,
                  });
                } else if (mesh.name === 'Aorta') {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0xb8202e,
                    roughness: 0.26,
                    metalness: 0.08,
                  });
                } else if (mesh.name === 'PulmonaryArtery') {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x344f6e,
                    roughness: 0.3,
                    metalness: 0.08,
                  });
                } else if (mesh.name === 'VenaCava') {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x293e56,
                    roughness: 0.32,
                    metalness: 0.08,
                  });
                } else if (mesh.name === 'PulmonaryVeins') {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x981e2b,
                    roughness: 0.3,
                    metalness: 0.08,
                  });
                } else if (mesh.name === 'CoronaryArteries') {
                  mesh.material = coronaryMat;
                } else if (mesh.name === 'CardiacVeins') {
                  mesh.material = new THREE.MeshStandardMaterial({
                    color: 0x2382b3,
                    roughness: 0.22,
                    emissive: 0x0e5d87,
                    emissiveIntensity: 0.5,
                  });
                }
                heartGroup.add(mesh);
              }
            });
          },
          (err) => {
            console.warn('GLB parsing skipped; procedural anatomy active:', err);
          }
        );
      })
      .catch((err) => {
        console.warn('GLB fetch skipped; procedural anatomy active:', err);
      });

    // Camera animation state
    const currentCamPos = initialCamPos.clone();
    const currentLookAt = initialLookAt.clone();
    let currentOrganAlpha = 1.0;
    let rotY = targetRotYRef.current;
    let rotX = targetRotXRef.current;
    let beatPhase = 0;
    let lastTime = performance.now();
    let lastUiSync = 0;

    // Pointer Drag vs Click State
    let isPointerDown = false;
    let startX = 0, startY = 0;
    let prevX = 0, prevY = 0;
    let startTime = 0;
    let hasDragged = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isPointerDown = true;
      hasDragged = false;
      startX = prevX = e.clientX;
      startY = prevY = e.clientY;
      startTime = performance.now();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerDown) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;

      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 12) {
        hasDragged = true;
      }

      targetRotYRef.current += dx * 0.0075;
      targetRotXRef.current = Math.max(-0.55, Math.min(0.55, targetRotXRef.current + dy * 0.0065));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}

      const totalDist = Math.hypot(e.clientX - startX, e.clientY - startY);
      const elapsed = performance.now() - startTime;

      if (hasDragged || totalDist > 12 || elapsed > 500) {
        return;
      }

      if (viewModeRef.current === 'body' && cameraRef.current) {
        const cRect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - cRect.left) / cRect.width) * 2 - 1,
          -(((e.clientY - cRect.top) / cRect.height) * 2 - 1)
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const targets: THREE.Object3D[] = [];
        if (heartGroupRef.current) targets.push(...heartGroupRef.current.children);
        if (hotspotGroupRef.current) targets.push(hotspotGroupRef.current);
        if (chestHitTarget) targets.push(chestHitTarget);
        const hits = raycaster.intersectObjects(targets, true);

        if (hits.length > 0) {
          handleToggleViewMode();
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('dblclick', handleToggleViewMode);

    // Main 60-120 FPS Hardware Render Loop
    const renderFrame = (now: number) => {
      if (isCancelled) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (isSizeDirty) {
        isSizeDirty = false;
        renderer.setSize(cachedWidth, cachedHeight, false);
        camera.aspect = cachedWidth / cachedHeight;
        camera.updateProjectionMatrix();
      }

      const isMobile = cachedWidth < 640;
      const isBodyView = viewModeRef.current === 'body';

      if (resetCameraTriggerRef.current) {
        resetCameraTriggerRef.current = false;
        targetRotYRef.current = -0.12;
        targetRotXRef.current = 0.04;
      }

      if (!isPointerDown && autoRotateRef.current && !reducedMotionRef.current) {
        targetRotYRef.current += dt * ((Math.PI * 2) / 28.0);
      }

      rotY += (targetRotYRef.current - rotY) * Math.min(1, dt * 9.0);
      rotX += (targetRotXRef.current - rotX) * Math.min(1, dt * 9.0);
      modelGroup.rotation.y = rotY;
      modelGroup.rotation.x = rotX;

      const targetCamPos = isBodyView
        ? new THREE.Vector3(0, isMobile ? -1.0 : -0.9, isMobile ? 27.5 : 23.5)
        : new THREE.Vector3(0, 0.0, isMobile ? 5.2 : 4.0);
      const targetLookAt = isBodyView
        ? new THREE.Vector3(0, isMobile ? -1.0 : -0.9, 0)
        : new THREE.Vector3(0, 0.0, 0);
      const targetAlpha = isBodyView ? 1.0 : 0.0;

      currentCamPos.lerp(targetCamPos, Math.min(1, dt * 5.5));
      currentLookAt.lerp(targetLookAt, Math.min(1, dt * 5.5));
      camera.position.copy(currentCamPos);
      camera.lookAt(currentLookAt);

      if (Math.abs(targetAlpha - currentOrganAlpha) > 0.001) {
        currentOrganAlpha += (targetAlpha - currentOrganAlpha) * Math.min(1, dt * 6.0);
        torsoMaterial.uniforms.uOrganAlpha.value = currentOrganAlpha;
        if (torsoMesh) torsoMesh.visible = currentOrganAlpha > 0.01;
        proceduralTorsoMesh.visible = currentOrganAlpha > 0.01;

        organGroup.children.forEach((child) => {
          const m = child as THREE.Mesh;
          if (m.material) {
            (m.material as THREE.MeshStandardMaterial).opacity = 0.88 * currentOrganAlpha;
            m.visible = currentOrganAlpha > 0.01;
          }
        });
      }

      // Hotspot target in body view
      hotspotGroup.visible = currentOrganAlpha > 0.4;
      const pRing = (now * 0.0018) % 1;
      ringMesh.scale.setScalar(1 + pRing * 2.2);
      ringMat.opacity = (1 - pRing) * 0.85;

      // Orbit ring & particles in heart view
      orbitGroup.visible = currentOrganAlpha < 0.6;
      orbitRingMat.opacity = (1 - currentOrganAlpha) * 0.55;
      particles.rotation.y += dt * 0.8;

      // Animate Bio-Scanner Plane (Vertical Laser Sweep)
      if (isBodyView && !reducedMotionRef.current) {
        const scanY = Math.sin(now * 0.0014) * 5.6 - 0.5;
        scanPlane.position.y = scanY;
        scanPlaneMat.opacity = 0.2 + Math.abs(Math.sin(now * 0.003)) * 0.15;
      } else {
        scanPlane.position.y = -999;
      }

      // Cardiac rhythm animation
      const targetBpmVal = Math.max(42, Math.min(195, targetBpmRef.current));
      smoothedBpmRef.current += (targetBpmVal - smoothedBpmRef.current) * Math.min(1, dt * 4.0);
      const currentBpm = smoothedBpmRef.current;
      const beatsPerSec = currentBpm / 60;
      beatPhase = (beatPhase + dt * beatsPerSec) % 1;

      const { ventricularPulse, phaseLabel } = evaluateCardiacCycle(beatPhase);

      // Heartbeat organic scale pulse & twist
      const vScale = 1 - ventricularPulse * 0.058;
      heartGroup.scale.set(vScale, 1 - ventricularPulse * 0.026, vScale);
      heartGroup.rotation.z = ventricularPulse * 0.038;

      // Animate Systolic Blood Pulse along Carotid to Brain
      const carotidT = (beatPhase * 1.3) % 1;
      const pulsePt = carotidCurve.getPoint(carotidT);
      carotidPulseOrb.position.copy(pulsePt);
      carotidPulseOrb.scale.setScalar(0.7 + ventricularPulse * 0.6);

      // Coronary & systemic vessels bioluminescent pulse + neural brain glow
      coronaryMat.emissiveIntensity = 0.5 + ventricularPulse * 0.65;
      vesselsMat.emissiveIntensity = 0.45 + ventricularPulse * 0.45;
      brainMat.emissiveIntensity = 0.45 + (1 + Math.sin(now * 0.003)) * 0.16;

      if (now - lastUiSync > 240) {
        lastUiSync = now;
        setCardiacPhaseLabel(phaseLabel);
        setDisplayedSmoothedBpm(Math.round(currentBpm));
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('dblclick', handleToggleViewMode);
      renderer.dispose();
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
        className="relative w-full min-h-[520px] sm:min-h-[580px] md:min-h-[640px] flex flex-col items-center justify-center select-none overflow-hidden"
      >
        {webGlSupported ? (
          <div className="relative z-10 w-full h-[520px] sm:h-[580px] md:h-[640px] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="w-full h-full max-w-[840px] cursor-grab active:cursor-grabbing touch-none"
            />

            {/* Prompt in Body Mode: Clickable Hero Button to Zoom into Heart */}
            {viewMode === 'body' && (
              <button
                type="button"
                onClick={handleToggleViewMode}
                className="pointer-events-auto absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-rose-500/90 via-pink-600/90 to-rose-600/90 hover:from-rose-600 hover:to-pink-700 text-white border border-rose-300/40 text-xs font-semibold shadow-lg shadow-rose-500/30 backdrop-blur-md cursor-pointer transition-all active:scale-95"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                <span>Chạm phóng to Trái Tim &amp; 4 biểu đồ</span>
                <Sparkles className="w-3.5 h-3.5 text-rose-200" />
              </button>
            )}
          </div>
        ) : (
          /* High-Tech 2D Holographic SVG Fallback if WebGL is disabled */
          <div className="relative z-10 w-full h-[520px] sm:h-[580px] md:h-[640px] flex flex-col items-center justify-center p-6 text-center">
            <div className="w-24 h-24 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.4)] animate-pulse">
              <Activity className="w-12 h-12 text-rose-400" />
            </div>
            <h3 className="text-xl font-bold font-display text-slate-900 dark:text-white mt-4">
              MÔ PHỎNG SINH HỌC 2D TĂNG TỐC
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
              Trình duyệt của bạn đang tắt WebGL hoặc tăng tốc phần cứng. Hệ thống tự động chuyển sang luồng hiển thị 2D mượt mà.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono-tech text-cyan-600 dark:text-cyan-300">
                BPM: {displayedSmoothedBpm}
              </span>
              <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-400/40 text-xs font-mono-tech text-rose-600 dark:text-rose-300">
                {cardiacPhaseLabel}
              </span>
            </div>
          </div>
        )}

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

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

let cachedGltfPromise: Promise<THREE.Group> | null = null;
function getAnatomicalModel(): Promise<THREE.Group> {
  if (!cachedGltfPromise) {
    cachedGltfPromise = new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        './models/anatomical_body_heart.glb',
        (gltf) => {
          resolve(gltf.scene);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }
  return cachedGltfPromise;
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

  const [modelLoaded, setModelLoaded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [cardiacPhaseLabel, setCardiacPhaseLabel] = useState('DIASTOLE (THƯ GIÃN)');
  const [displayedSmoothedBpm, setDisplayedSmoothedBpm] = useState(74);

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

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isLightModeRef.current ? 1.05 : 1.18;

    const scene = new THREE.Scene();

    // Responsive camera setup
    const rect = canvas.getBoundingClientRect();
    const cw = Math.max(280, Math.floor(rect.width));
    const ch = Math.max(380, Math.floor(rect.height));
    renderer.setSize(cw, ch, false);

    const isInitialMobile = cw < 640;
    const camera = new THREE.PerspectiveCamera(36, cw / ch, 0.1, 100);
    const initialCamPos = new THREE.Vector3(0, -0.4, isInitialMobile ? 18.0 : 15.0);
    const initialLookAt = new THREE.Vector3(0, -0.4, 0);
    camera.position.copy(initialCamPos);
    camera.lookAt(initialLookAt);
    cameraRef.current = camera;

    // Studio Lighting
    const isLight = isLightModeRef.current;
    const ambientLight = new THREE.AmbientLight(0xffffff, isLight ? 1.5 : 0.7);
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

    // Root model group (handles rotation)
    const modelGroup = new THREE.Group();
    modelGroup.rotation.y = targetRotYRef.current;
    modelGroup.rotation.x = targetRotXRef.current;
    scene.add(modelGroup);

    // Subgroups for clean isolation and animation
    const heartGroup = new THREE.Group();
    heartGroupRef.current = heartGroup;
    modelGroup.add(heartGroup);

    const organGroup = new THREE.Group();
    modelGroup.add(organGroup);

    let torsoMesh: THREE.Mesh | null = null;
    let coronaryMesh: THREE.Mesh | null = null;
    const coronaryMat = new THREE.MeshStandardMaterial({
      color: 0xff3b52,
      roughness: 0.2,
      emissive: 0xff1e38,
      emissiveIntensity: 0.6,
    });

    // Torso Glass Shader
    const torsoMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uRimColor: { value: new THREE.Color(isLight ? 0x0284c7 : 0x00f0ff) },
        uBaseColor: { value: new THREE.Color(isLight ? 0xf0f9ff : 0x020b18) },
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
        uniform vec3 uRimColor;
        uniform vec3 uBaseColor;
        uniform float uOrganAlpha;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.2);
          vec3 col = mix(uBaseColor, uRimColor, fresnel * 0.92);
          float alpha = (0.04 + fresnel * 0.65) * uOrganAlpha;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

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

    // Holographic Orbit Rings & Particles in Heart Mode
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

    // Load master anatomical GLB
    getAnatomicalModel()
      .then((loadedScene) => {
        if (isCancelled) return;
        const cloned = loadedScene.clone(true);
        const allMeshes: THREE.Mesh[] = [];
        cloned.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            allMeshes.push(child as THREE.Mesh);
          }
        });

        allMeshes.forEach((mesh) => {
          if (mesh.name === 'BodyTorso') {
            mesh.material = torsoMaterial;
            torsoMesh = mesh;
            modelGroup.add(mesh);
          } else if (mesh.name === 'Lungs') {
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0x38bdf8,
              roughness: 0.35,
              metalness: 0.05,
              transparent: true,
              opacity: 0.88,
            });
            organGroup.add(mesh);
          } else if (mesh.name === 'Liver') {
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0xbc4134,
              roughness: 0.4,
              metalness: 0.1,
              transparent: true,
              opacity: 0.88,
            });
            organGroup.add(mesh);
          } else if (mesh.name === 'Stomach') {
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0xda6072,
              roughness: 0.4,
              metalness: 0.1,
              transparent: true,
              opacity: 0.88,
            });
            organGroup.add(mesh);
          } else {
            // Heart structures: vivid crimson biological shading
            if (mesh.name === 'Myocardium') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xe11d48,
                roughness: 0.28,
                metalness: 0.15,
                emissive: 0x4a000d,
                emissiveIntensity: 0.45,
              });
            } else if (mesh.name === 'Aorta') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xd71c2c,
                roughness: 0.25,
                metalness: 0.1,
              });
            } else if (mesh.name === 'PulmonaryArtery' || mesh.name === 'VenaCava') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x762052,
                roughness: 0.3,
                metalness: 0.1,
              });
            } else if (mesh.name === 'PulmonaryVeins') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xb41830,
                roughness: 0.3,
                metalness: 0.1,
              });
            } else if (mesh.name === 'CoronaryArteries') {
              mesh.material = coronaryMat;
              coronaryMesh = mesh;
            } else if (mesh.name === 'CardiacVeins') {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0x18b9f5,
                roughness: 0.2,
                emissive: 0x00c8ff,
                emissiveIntensity: 0.7,
              });
            }
            heartGroup.add(mesh);
          }
        });

        setModelLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load master anatomical model:', err);
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

    // Pointer Drag vs Click State (Rock-solid fix for drag zooming!)
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

      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
        hasDragged = true;
      }

      // Smooth 60-120 FPS rotation directly updating target rotations
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

      // IF USER DRAGGED TO ROTATE, NEVER ZOOM!
      if (hasDragged || totalDist > 5 || elapsed > 350) {
        return;
      }

      // Clean tap/click: ONLY zoom if clicking directly on the HEART or Hotspot!
      if (viewModeRef.current === 'body' && cameraRef.current && heartGroupRef.current) {
        const cRect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((e.clientX - cRect.left) / cRect.width) * 2 - 1,
          -(((e.clientY - cRect.top) / cRect.height) * 2 - 1)
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const targets: THREE.Object3D[] = [...heartGroupRef.current.children];
        if (hotspotGroupRef.current) targets.push(hotspotGroupRef.current);
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

    // Main 60-120 FPS Hardware Render Loop
    const renderFrame = (now: number) => {
      if (isCancelled) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // Handle resize
      const cRect = canvas.getBoundingClientRect();
      const currentWidth = Math.max(280, Math.floor(cRect.width));
      const currentHeight = Math.max(380, Math.floor(cRect.height));
      if (canvas.width !== currentWidth * renderer.getPixelRatio() || canvas.height !== currentHeight * renderer.getPixelRatio()) {
        renderer.setSize(currentWidth, currentHeight, false);
        camera.aspect = currentWidth / currentHeight;
        camera.updateProjectionMatrix();
      }

      const isMobile = currentWidth < 640;
      const isBodyView = viewModeRef.current === 'body';

      // Reset camera trigger
      if (resetCameraTriggerRef.current) {
        resetCameraTriggerRef.current = false;
        targetRotYRef.current = -0.12;
        targetRotXRef.current = 0.04;
      }

      // Smooth auto-rotation
      if (!isPointerDown && autoRotateRef.current && !reducedMotionRef.current) {
        targetRotYRef.current += dt * ((Math.PI * 2) / 28.0);
      }

      // Smooth rotation dampening
      rotY += (targetRotYRef.current - rotY) * Math.min(1, dt * 9.0);
      rotX += (targetRotXRef.current - rotX) * Math.min(1, dt * 9.0);
      modelGroup.rotation.y = rotY;
      modelGroup.rotation.x = rotX;

      // Smooth camera interpolation
      const targetCamPos = isBodyView
        ? new THREE.Vector3(0, -0.4, isMobile ? 18.0 : 15.0)
        : new THREE.Vector3(0, 0.05, isMobile ? 6.2 : 4.8);
      const targetLookAt = isBodyView
        ? new THREE.Vector3(0, -0.4, 0)
        : new THREE.Vector3(0, 0.05, 0);
      const targetAlpha = isBodyView ? 1.0 : 0.0;

      currentCamPos.lerp(targetCamPos, Math.min(1, dt * 5.5));
      currentLookAt.lerp(targetLookAt, Math.min(1, dt * 5.5));
      camera.position.copy(currentCamPos);
      camera.lookAt(currentLookAt);

      // Smooth organ alpha dissolve
      currentOrganAlpha += (targetAlpha - currentOrganAlpha) * Math.min(1, dt * 6.0);
      torsoMaterial.uniforms.uOrganAlpha.value = currentOrganAlpha;
      if (torsoMesh) torsoMesh.visible = currentOrganAlpha > 0.01;

      organGroup.children.forEach((child) => {
        const m = child as THREE.Mesh;
        if (m.material) {
          (m.material as THREE.MeshStandardMaterial).opacity = 0.88 * currentOrganAlpha;
          m.visible = currentOrganAlpha > 0.01;
        }
      });

      // Hotspot target in body view
      hotspotGroup.visible = currentOrganAlpha > 0.4;
      const pRing = (now * 0.0018) % 1;
      ringMesh.scale.setScalar(1 + pRing * 2.2);
      ringMat.opacity = (1 - pRing) * 0.85;

      // Orbit ring & particles in heart view
      orbitGroup.visible = currentOrganAlpha < 0.6;
      orbitRingMat.opacity = (1 - currentOrganAlpha) * 0.55;
      particles.rotation.y += dt * 0.8;

      // Cardiac rhythm animation
      const targetBpmVal = Math.max(42, Math.min(195, targetBpmRef.current));
      smoothedBpmRef.current += (targetBpmVal - smoothedBpmRef.current) * Math.min(1, dt * 4.0);
      const currentBpm = smoothedBpmRef.current;
      const beatsPerSec = currentBpm / 60;
      beatPhase = (beatPhase + dt * beatsPerSec) % 1;

      const { ventricularPulse, arterialWave, phaseLabel } = evaluateCardiacCycle(beatPhase);

      // Heartbeat organic scale pulse & twist
      const vScale = 1 - ventricularPulse * 0.058;
      heartGroup.scale.set(vScale, 1 - ventricularPulse * 0.026, vScale);
      heartGroup.rotation.z = ventricularPulse * 0.038;

      // Coronary bioluminescent pulse
      coronaryMat.emissiveIntensity = 0.5 + ventricularPulse * 0.65;

      if (now - lastUiSync > 240) {
        lastUiSync = now;
        setCardiacPhaseLabel(phaseLabel);
        setDisplayedSmoothedBpm(Math.round(currentBpm));
      }

      // Hardware render
      renderer.render(scene, camera);
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
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
        className="relative w-full min-h-[460px] sm:min-h-[520px] md:min-h-[580px] flex flex-col items-center justify-center select-none overflow-hidden"
      >
        {/* 3D WebGL Canvas */}
        <div className="relative z-10 w-full h-[460px] sm:h-[520px] md:h-[580px] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full max-w-[780px] cursor-grab active:cursor-grabbing touch-none"
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

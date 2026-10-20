import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  Heart,
  Layers,
  Maximize2,
  MousePointerClick,
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

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

type TissueType =
  | 'lv'
  | 'rv'
  | 'la'
  | 'ra'
  | 'sulcus'
  | 'coronary_artery'
  | 'coronary_vein'
  | 'aorta'
  | 'pulmonary'
  | 'vena_cava';

interface SmoothVertex {
  pos: Vec3;
  normal: Vec3;
  ao: number; // Ambient occlusion (0.35..1.0)
  sulcusWeight: number; // 0..1 epicardial fat / groove blend
  coronaryWeight: number; // 0..1 raised coronary vessel ridge
  isVenousVessel: boolean;
  chamber: TissueType;
  baseRGB: [number, number, number];
}

interface SmoothTriangle {
  i0: number;
  i1: number;
  i2: number;
}

interface OrbitalParticle3D {
  angle: number;
  radius: number;
  speed: number;
  tiltX: number;
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

/**
 * Builds a high-resolution, smooth vertex-normal interpolated 3D Anatomical Human Heart mesh.
 * Every vertex receives a smooth averaged surface normal, ambient occlusion factor,
 * epicardial sulcus groove weight, and raised 3D coronary artery displacement so that
 * per-pixel Phong + Subsurface Scattering rasterization produces a 100% smooth organic organ
 * with zero visible polygon edges.
 */
function buildSmoothAnatomicalHeartMesh(): {
  vertices: SmoothVertex[];
  triangles: SmoothTriangle[];
} {
  const vertices: SmoothVertex[] = [];
  const triangles: SmoothTriangle[] = [];

  // Helper to append a grid mesh with smooth welded vertex normals
  const appendParametricSurface = (
    uSteps: number,
    vSteps: number,
    wrapV: boolean,
    evalPoint: (u: number, v: number) => {
      pos: Vec3;
      ao: number;
      sulcusWeight: number;
      coronaryWeight: number;
      isVenousVessel: boolean;
      chamber: TissueType;
      baseRGB: [number, number, number];
    }
  ) => {
    const baseIdx = vertices.length;
    const cols = vSteps + 1;

    for (let iu = 0; iu <= uSteps; iu++) {
      const u = iu / uSteps;
      for (let iv = 0; iv <= vSteps; iv++) {
        const v = iv / vSteps;
        const data = evalPoint(u, v);
        vertices.push({
          pos: data.pos,
          normal: { x: 0, y: 1, z: 0 },
          ao: data.ao,
          sulcusWeight: data.sulcusWeight,
          coronaryWeight: data.coronaryWeight,
          isVenousVessel: data.isVenousVessel,
          chamber: data.chamber,
          baseRGB: data.baseRGB,
        });
      }
    }

    for (let iu = 0; iu < uSteps; iu++) {
      for (let iv = 0; iv < vSteps; iv++) {
        const i00 = baseIdx + iu * cols + iv;
        const i10 = baseIdx + (iu + 1) * cols + iv;
        const i11 = baseIdx + (iu + 1) * cols + (iv + 1);
        const i01 = baseIdx + iu * cols + (iv + 1);
        triangles.push({ i0: i00, i1: i10, i2: i11 });
        triangles.push({ i0: i00, i1: i11, i2: i01 });
      }
    }

    // Compute smooth averaged vertex normals for this surface patch
    const endIdx = vertices.length;
    const accum: Vec3[] = Array.from({ length: endIdx - baseIdx }, () => ({
      x: 0,
      y: 0,
      z: 0,
    }));

    for (let t = triangles.length - uSteps * vSteps * 2; t < triangles.length; t++) {
      const tri = triangles[t];
      const p0 = vertices[tri.i0].pos;
      const p1 = vertices[tri.i1].pos;
      const p2 = vertices[tri.i2].pos;
      const ux = p1.x - p0.x;
      const uy = p1.y - p0.y;
      const uz = p1.z - p0.z;
      const vx = p2.x - p0.x;
      const vy = p2.y - p0.y;
      const vz = p2.z - p0.z;
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;

      accum[tri.i0 - baseIdx].x += nx;
      accum[tri.i0 - baseIdx].y += ny;
      accum[tri.i0 - baseIdx].z += nz;
      accum[tri.i1 - baseIdx].x += nx;
      accum[tri.i1 - baseIdx].y += ny;
      accum[tri.i1 - baseIdx].z += nz;
      accum[tri.i2 - baseIdx].x += nx;
      accum[tri.i2 - baseIdx].y += ny;
      accum[tri.i2 - baseIdx].z += nz;
    }

    // Weld seam normals when wrapV is true
    if (wrapV) {
      for (let iu = 0; iu <= uSteps; iu++) {
        const left = iu * cols;
        const right = iu * cols + vSteps;
        const sx = accum[left].x + accum[right].x;
        const sy = accum[left].y + accum[right].y;
        const sz = accum[left].z + accum[right].z;
        accum[left] = { x: sx, y: sy, z: sz };
        accum[right] = { x: sx, y: sy, z: sz };
      }
    }

    for (let i = baseIdx; i < endIdx; i++) {
      vertices[i].normal = normalize3(accum[i - baseIdx]);
    }
  };

  // --- 1. MAIN MYOCARDIUM: LEFT & RIGHT VENTRICLES + LEFT & RIGHT ATRIA + AURICLES + EPICARDIAL CORONARY VESSELS ---
  appendParametricSurface(68, 88, true, (uNorm, vNorm) => {
    const u = Math.min(0.996, Math.max(0.004, uNorm)) * Math.PI;
    const v = vNorm * Math.PI * 2;
    const sinU = Math.sin(u);
    const cosU = Math.cos(u);
    const sinV = Math.sin(v);
    const cosV = Math.cos(v);

    // yn: 1 at superior base, 0 at inferior apex
    const yn = (cosU + 1) * 0.5;

    // Asymmetric organic heart cross-section: thicker muscular LV on anatomical left (+x), broader RV on front-right
    const baseRadius = 0.28 + 0.82 * Math.pow(sinU, 0.72) * (0.64 + 0.42 * Math.pow(yn, 0.8));
    let x = baseRadius * cosV;
    let z = baseRadius * sinV * 0.84;
    let y = cosU * 1.18 - 0.14;

    // Anatomical leftward-anterior-inferior tilt of the cardiac apex
    const apexCurve = Math.pow(1 - yn, 1.42);
    x += apexCurve * 0.36;
    z += apexCurve * 0.18;

    // Right Ventricular anterior muscular bulge & infundibulum (conus arteriosus) leading to pulmonary trunk
    const rvBulge =
      Math.exp(-Math.pow((x + 0.38) * 2.1, 2)) *
      Math.exp(-Math.pow((y - 0.08) * 1.65, 2)) *
      Math.max(0, sinV + 0.2);
    x -= rvBulge * 0.19;
    z += rvBulge * 0.21;
    y += rvBulge * 0.08;

    // Left Ventricular thick rounded lateral-posterior wall
    const lvBulge =
      Math.exp(-Math.pow((x - 0.48) * 2.0, 2)) *
      Math.exp(-Math.pow((y + 0.05) * 1.5, 2));
    x += lvBulge * 0.14;
    z += lvBulge * 0.08 * Math.sign(z || 1);

    // Right Atrium & scalloped Right Auricular Appendage (superior right-anterior)
    const raBulge =
      Math.exp(-Math.pow((x + 0.48) * 2.3, 2)) *
      Math.exp(-Math.pow((y - 0.62) * 2.6, 2));
    x -= raBulge * 0.24;
    z += raBulge * 0.12;

    // Left Atrium & Left Auricular Appendage (superior left-posterior)
    const laBulge =
      Math.exp(-Math.pow((x - 0.44) * 2.4, 2)) *
      Math.exp(-Math.pow((y - 0.64) * 2.7, 2));
    x += laBulge * 0.2;
    z -= laBulge * 0.14;

    // ANATOMICAL GROOVES (SULCI):
    // 1) Coronary Sulcus (Atrioventricular groove separating atria and ventricles around y = 0.38)
    const avSulcusDist = y - (0.38 - 0.08 * cosV);
    const avSulcus = Math.exp(-Math.pow(avSulcusDist * 7.8, 2));

    // 2) Anterior & Posterior Interventricular Sulcus (groove separating LV and RV)
    const ivPlane = x + 0.16 * y - 0.05;
    const ivSulcus =
      Math.exp(-Math.pow(ivPlane * 6.5, 2)) *
      Math.sin(u) *
      (1 - 0.4 * Math.max(0, y - 0.35));

    const sulcusWeight = Math.min(1, avSulcus * 0.75 + ivSulcus * 0.85);
    const grooveIndent = 1 - (avSulcus * 0.085 + ivSulcus * 0.095);
    x *= grooveIndent;
    z *= grooveIndent;

    // 3D RAISED EPICARDIAL CORONARY ARTERIES & VEINS sculpted directly into the surface:
    // LAD artery running down the anterior interventricular sulcus + diagonal branches
    let coronaryWeight = 0;
    let isVenousVessel = false;
    if (z > 0 && y < 0.48) {
      // LAD main trunk
      const ladDist = x + 0.16 * y - 0.04 + 0.025 * Math.sin(y * 9);
      const ladProfile = Math.exp(-Math.pow(ladDist * 36, 2)) * Math.exp(-Math.pow(Math.max(0, y - 0.42) * 8, 2));
      // First Diagonal Branch (D1) branching across LV
      const d1Dist = (x - 0.04) - (0.18 - y) * 0.72 + 0.02 * Math.sin(y * 12);
      const d1Mask = y < 0.22 && y > -0.55 && x > -0.02 ? 1 : 0;
      const d1Profile = d1Mask * Math.exp(-Math.pow(d1Dist * 42, 2));
      // Second Diagonal Branch (D2)
      const d2Dist = (x - 0.08) - (-0.15 - y) * 0.65;
      const d2Mask = y < -0.12 && y > -0.72 && x > 0.02 ? 1 : 0;
      const d2Profile = d2Mask * Math.exp(-Math.pow(d2Dist * 45, 2));
      // Right Coronary Artery (RCA) & Acute Marginal branch on RV
      const rcaDist = avSulcusDist + 0.02 * Math.cos(v * 4);
      const rcaMask = x < -0.05 ? 1 : 0;
      const rcaProfile = rcaMask * Math.exp(-Math.pow(rcaDist * 38, 2));

      // Great Cardiac Vein running parallel to LAD
      const veinDist = x + 0.16 * y - 0.095 + 0.02 * Math.cos(y * 8);
      const veinProfile = Math.exp(-Math.pow(veinDist * 42, 2)) * (y < 0.38 ? 1 : 0);

      coronaryWeight = Math.min(
        1,
        Math.max(ladProfile, d1Profile * 0.85, d2Profile * 0.75, rcaProfile * 0.9, veinProfile * 0.82)
      );
      if (veinProfile * 0.82 > Math.max(ladProfile, d1Profile * 0.85, rcaProfile * 0.9)) {
        isVenousVessel = true;
      }
    } else if (z <= 0 && y < 0.45) {
      // Posterior Descending Artery (PDA) & Middle Cardiac Vein on posterior sulcus
      const pdaDist = x + 0.14 * y - 0.04 + 0.02 * Math.sin(y * 8);
      const pdaProfile = Math.exp(-Math.pow(pdaDist * 36, 2));
      coronaryWeight = Math.min(1, pdaProfile * 0.88);
    }

    // Displace coronary vessels outward so they have true 3D cylindrical relief
    const vesselLift = coronaryWeight * 0.034;
    const radLen = Math.hypot(x, z) || 1;
    x += (x / radLen) * vesselLift;
    z += (z / radLen) * vesselLift;

    // Subtle organic myocardial muscle contour (smooth, never jagged)
    const organicWave =
      0.011 * Math.sin(u * 5 + v * 3) * Math.cos(u * 3 - v * 2) +
      0.006 * Math.sin(u * 9 + v * 6);
    x += cosV * sinU * organicWave;
    z += sinV * sinU * organicWave;

    // Ambient Occlusion in deep sulci and inferior base
    const ao = Math.max(
      0.38,
      Math.min(1.0, 0.96 - avSulcus * 0.34 - ivSulcus * 0.28 - (1 - yn) * 0.08)
    );

    // Realistic Biological Tissue Base Colors (Deep oxygenated crimson myocardium, warm epicardial fat in sulci)
    const isAtrium = y > 0.38;
    const isLeft = x >= -0.04;
    let chamber: TissueType = isAtrium ? (isLeft ? 'la' : 'ra') : isLeft ? 'lv' : 'rv';

    // Rich anatomical myocardium palette (dark crimson-red to maroon-rose)
    let r = isAtrium ? 128 : isLeft ? 148 : 138;
    let g = isAtrium ? 22 : isLeft ? 20 : 22;
    let b = isAtrium ? 38 : isLeft ? 34 : 36;

    // Blend warm pinkish-ochre epicardial adipose tissue along the coronary/interventricular sulci
    if (sulcusWeight > 0.01) {
      const fatMix = sulcusWeight * 0.58;
      r = Math.round(r * (1 - fatMix) + 198 * fatMix);
      g = Math.round(g * (1 - fatMix) + 88 * fatMix);
      b = Math.round(b * (1 - fatMix) + 74 * fatMix);
    }

    // Blend raised coronary arteries (deep arterial scarlet) or cardiac veins (dark venous burgundy)
    if (coronaryWeight > 0.05) {
      chamber = isVenousVessel ? 'coronary_vein' : 'coronary_artery';
      const cMix = Math.min(1, coronaryWeight * 1.15);
      if (isVenousVessel) {
        r = Math.round(r * (1 - cMix) + 86 * cMix);
        g = Math.round(g * (1 - cMix) + 22 * cMix);
        b = Math.round(b * (1 - cMix) + 54 * cMix);
      } else {
        r = Math.round(r * (1 - cMix) + 195 * cMix);
        g = Math.round(g * (1 - cMix) + 26 * cMix);
        b = Math.round(b * (1 - cMix) + 42 * cMix);
      }
    }

    return {
      pos: { x, y, z },
      ao,
      sulcusWeight,
      coronaryWeight,
      isVenousVessel,
      chamber,
      baseRGB: [r, g, b],
    };
  });

  // Helper to add a smooth anatomical tubular great vessel along a 3D spline
  const appendSmoothVesselTube = (
    controlPoints: Vec3[],
    radii: number[],
    uSteps: number,
    vSteps: number,
    chamber: TissueType,
    baseRGB: [number, number, number]
  ) => {
    // Catmull-Rom spline evaluation
    const sampleSpline = (tNorm: number): { pos: Vec3; radius: number } => {
      const n = controlPoints.length - 1;
      const scaled = Math.min(n - 0.0001, Math.max(0, tNorm * n));
      const idx = Math.floor(scaled);
      const frac = scaled - idx;

      const p0 = controlPoints[Math.max(0, idx - 1)];
      const p1 = controlPoints[idx];
      const p2 = controlPoints[Math.min(n, idx + 1)];
      const p3 = controlPoints[Math.min(n, idx + 2)];

      const t2 = frac * frac;
      const t3 = t2 * frac;

      const interp = (a: number, b: number, c: number, d: number) =>
        0.5 *
        (2 * b +
          (-a + c) * frac +
          (2 * a - 5 * b + 4 * c - d) * t2 +
          (-a + 3 * b - 3 * c + d) * t3);

      const r0 = radii[Math.max(0, idx - 1)];
      const r1 = radii[idx];
      const r2 = radii[Math.min(n, idx + 1)];
      const r3 = radii[Math.min(n, idx + 2)];

      return {
        pos: {
          x: interp(p0.x, p1.x, p2.x, p3.x),
          y: interp(p0.y, p1.y, p2.y, p3.y),
          z: interp(p0.z, p1.z, p2.z, p3.z),
        },
        radius: interp(r0, r1, r2, r3),
      };
    };

    appendParametricSurface(uSteps, vSteps, true, (u, v) => {
      const curr = sampleSpline(u);
      const prev = sampleSpline(Math.max(0, u - 0.02));
      const next = sampleSpline(Math.min(1, u + 0.02));

      const tangent = normalize3({
        x: next.pos.x - prev.pos.x,
        y: next.pos.y - prev.pos.y,
        z: next.pos.z - prev.pos.z,
      });

      const refUp =
        Math.abs(tangent.y) < 0.88 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
      const binormal = normalize3({
        x: tangent.y * refUp.z - tangent.z * refUp.y,
        y: tangent.z * refUp.x - tangent.x * refUp.z,
        z: tangent.x * refUp.y - tangent.y * refUp.x,
      });
      const normal = normalize3({
        x: binormal.y * tangent.z - binormal.z * tangent.y,
        y: binormal.z * tangent.x - binormal.x * tangent.z,
        z: binormal.x * tangent.y - binormal.y * tangent.x,
      });

      const theta = v * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Slight organic arterial ring undulation
      const r = curr.radius * (1 + 0.015 * Math.sin(u * Math.PI * 6));
      const pos = {
        x: curr.pos.x + r * (cosT * binormal.x + sinT * normal.x),
        y: curr.pos.y + r * (cosT * binormal.y + sinT * normal.y),
        z: curr.pos.z + r * (cosT * binormal.z + sinT * normal.z),
      };

      // Darken slightly near root junction and open lumen rim for realistic depth
      const rootAO = u < 0.15 ? 0.65 + (u / 0.15) * 0.35 : u > 0.92 ? 0.78 : 0.96;

      return {
        pos,
        ao: rootAO,
        sulcusWeight: 0,
        coronaryWeight: 0,
        isVenousVessel: chamber === 'vena_cava' || chamber === 'pulmonary',
        chamber,
        baseRGB,
      };
    });
  };

  // --- 2. ASCENDING AORTA, AORTIC ARCH & DESCENDING THORACIC AORTA ---
  appendSmoothVesselTube(
    [
      { x: 0.02, y: 0.56, z: 0.02 },
      { x: 0.09, y: 0.96, z: 0.06 },
      { x: 0.06, y: 1.32, z: 0.02 },
      { x: -0.08, y: 1.52, z: -0.08 },
      { x: -0.28, y: 1.44, z: -0.24 },
      { x: -0.36, y: 1.12, z: -0.36 },
      { x: -0.34, y: 0.65, z: -0.42 },
    ],
    [0.22, 0.24, 0.23, 0.21, 0.19, 0.18, 0.17],
    34,
    26,
    'aorta',
    [172, 28, 46]
  );

  // 3 Supra-Aortic Arterial Branches (Brachiocephalic Trunk, Left Common Carotid, Left Subclavian)
  appendSmoothVesselTube(
    [
      { x: 0.06, y: 1.36, z: 0.01 },
      { x: 0.12, y: 1.62, z: 0.02 },
      { x: 0.16, y: 1.86, z: 0.03 },
    ],
    [0.082, 0.072, 0.064],
    14,
    16,
    'aorta',
    [168, 26, 44]
  );
  appendSmoothVesselTube(
    [
      { x: -0.05, y: 1.46, z: -0.06 },
      { x: -0.04, y: 1.72, z: -0.06 },
      { x: -0.03, y: 1.92, z: -0.06 },
    ],
    [0.068, 0.06, 0.054],
    14,
    16,
    'aorta',
    [168, 26, 44]
  );
  appendSmoothVesselTube(
    [
      { x: -0.18, y: 1.44, z: -0.16 },
      { x: -0.22, y: 1.68, z: -0.19 },
      { x: -0.25, y: 1.86, z: -0.21 },
    ],
    [0.064, 0.056, 0.05],
    14,
    16,
    'aorta',
    [168, 26, 44]
  );

  // --- 3. PULMONARY TRUNK & LEFT/RIGHT PULMONARY ARTERY BIFURCATION ---
  appendSmoothVesselTube(
    [
      { x: -0.22, y: 0.48, z: 0.34 },
      { x: -0.12, y: 0.84, z: 0.28 },
      { x: 0.06, y: 1.08, z: 0.16 },
      { x: 0.34, y: 1.14, z: 0.02 },
      { x: 0.58, y: 1.1, z: -0.08 },
    ],
    [0.19, 0.185, 0.175, 0.15, 0.135],
    26,
    22,
    'pulmonary',
    [126, 26, 52]
  );

  // Right Pulmonary Artery Branch passing behind ascending aorta
  appendSmoothVesselTube(
    [
      { x: 0.02, y: 1.04, z: 0.14 },
      { x: -0.22, y: 1.06, z: -0.04 },
      { x: -0.48, y: 1.02, z: -0.14 },
    ],
    [0.14, 0.13, 0.12],
    16,
    16,
    'pulmonary',
    [122, 24, 50]
  );

  // --- 4. SUPERIOR & INFERIOR VENA CAVA ---
  appendSmoothVesselTube(
    [
      { x: -0.48, y: 0.54, z: -0.06 },
      { x: -0.54, y: 0.92, z: -0.09 },
      { x: -0.55, y: 1.32, z: -0.11 },
      { x: -0.53, y: 1.68, z: -0.11 },
    ],
    [0.165, 0.155, 0.145, 0.14],
    22,
    20,
    'vena_cava',
    [104, 20, 44]
  );

  appendSmoothVesselTube(
    [
      { x: -0.42, y: -0.35, z: -0.28 },
      { x: -0.46, y: -0.68, z: -0.32 },
      { x: -0.48, y: -0.96, z: -0.34 },
    ],
    [0.16, 0.155, 0.15],
    14,
    18,
    'vena_cava',
    [100, 18, 42]
  );

  return { vertices, triangles };
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
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [autoRotate, setAutoRotate] = useState(true);
  const [floatingChartsOpen, setFloatingChartsOpen] = useState(false);
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

  // Close floating charts when clicking outside the heart stage container
  useEffect(() => {
    if (!floatingChartsOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        stageContainerRef.current &&
        !stageContainerRef.current.contains(e.target as Node)
      ) {
        setFloatingChartsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [floatingChartsOpen]);

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

  // Per-Pixel Smooth Phong + Subsurface Scattering 3D Anatomical Heart Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { vertices, triangles } = buildSmoothAnatomicalHeartMesh();
    const numVerts = vertices.length;

    // Pre-allocate transformed vertex arrays to avoid GC allocations per frame
    const txArr = new Float32Array(numVerts);
    const tyArr = new Float32Array(numVerts);
    const tzArr = new Float32Array(numVerts);
    const nxArr = new Float32Array(numVerts);
    const nyArr = new Float32Array(numVerts);
    const nzArr = new Float32Array(numVerts);
    const sxArr = new Float32Array(numVerts);
    const syArr = new Float32Array(numVerts);

    // Offscreen per-pixel Z-buffer and RGBA pixel buffer (360 x 360 smooth shading resolution)
    const BUF_W = 360;
    const BUF_H = 360;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = BUF_W;
    offCanvas.height = BUF_H;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    const imgData = offCtx.createImageData(BUF_W, BUF_H);
    const pixels32 = new Uint32Array(imgData.data.buffer);
    const zBuffer = new Float32Array(BUF_W * BUF_H);

    // Subtle orbiting particles
    const particles: OrbitalParticle3D[] = Array.from({ length: 64 }, (_, i) => ({
      angle: (i / 64) * Math.PI * 2,
      radius: 1.56 + (i % 6) * 0.11,
      speed: 0.22 + (i % 5) * 0.07,
      tiltX: ((i % 7) - 3) * 0.11,
      size: 1.3 + (i % 3) * 0.55,
      isCyan: i % 3 !== 0,
    }));

    // Left-click drag rotation state
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let dragRotY = 0;
    let dragRotX = 0;
    let hoverNormX = 0;
    let hoverNormY = 0;
    let baseAutoAngleY = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Only left mouse button or touch drags the 3D model; right click is reserved for 4 HUD charts
      if (e.button !== 0 && e.pointerType === 'mouse') return;
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
        dragRotY += dx * 0.008;
        dragRotX = Math.max(-0.6, Math.min(0.6, dragRotX + dy * 0.0065));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        canvas.releasePointerCapture?.(e.pointerId);
      }
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

    let cw = canvas.clientWidth || 540;
    let ch = canvas.clientHeight || 460;
    const updateSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = canvas.clientWidth || 540;
      ch = canvas.clientHeight || 460;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
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

    // Normalized lighting vectors
    // Key light: warm biological lab light from top-left-front
    const keyLx = -0.38;
    const keyLy = 0.56;
    const keyLz = 0.73;
    // Half-vector for Blinn-Phong wet specular (keyLight + view(0,0,1))
    const halfLen = Math.hypot(keyLx, keyLy, keyLz + 1);
    const halfX = keyLx / halfLen;
    const halfY = keyLy / halfLen;
    const halfZ = (keyLz + 1) / halfLen;

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

      // Advance right-click cyan activation ring if active
      if (rightClickWavePhaseRef.current > 0) {
        rightClickWavePhaseRef.current += dt * 1.45;
        if (rightClickWavePhaseRef.current > 1) {
          rightClickWavePhaseRef.current = 0;
        }
      }

      // Slow continuous rotation (~25s per revolution = 0.25 rad/s)
      if (autoRotateRef.current && !isDragging && !reducedMotionRef.current) {
        baseAutoAngleY += dt * 0.24;
        dragRotX *= Math.pow(0.93, dt * 60);
      }

      const organicTiltX = reducedMotionRef.current ? 0 : Math.sin(now * 0.00085) * 0.05;
      const organicTiltZ = reducedMotionRef.current ? 0 : Math.cos(now * 0.00065) * 0.035;

      const targetY = baseAutoAngleY + dragRotY + hoverNormX * 0.16;
      const targetX = organicTiltX + dragRotX + hoverNormY * 0.12;

      rotY += (targetY - rotY) * 0.085;
      rotX += (targetX - rotX) * 0.085;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosZ = Math.cos(organicTiltZ);
      const sinZ = Math.sin(organicTiltZ);

      // Clear Z-buffer & offscreen pixel buffer
      pixels32.fill(0);
      zBuffer.fill(-1e9);

      const fov = 4.4;
      const bufScale = BUF_W * 0.275;
      const bufCx = BUF_W * 0.5;
      const bufCy = BUF_H * 0.54;

      // 1) Transform all vertices & smooth normals
      for (let i = 0; i < numVerts; i++) {
        const v = vertices[i];
        let x = v.pos.x;
        let y = v.pos.y;
        let z = v.pos.z;

        // Realistic biological Lub-Dub contraction per chamber
        if (
          v.chamber === 'lv' ||
          v.chamber === 'rv' ||
          v.chamber === 'coronary_artery' ||
          v.chamber === 'coronary_vein'
        ) {
          const radial = 1 + vPulse * 0.044;
          const twist = vPulse * 0.036 * (y + 0.45);
          const cTw = Math.cos(twist);
          const sTw = Math.sin(twist);
          const rx = x * cTw - z * sTw;
          const rz = x * sTw + z * cTw;
          x = rx * radial;
          z = rz * radial;
          y = y * (1 + vPulse * 0.022);
        } else if (v.chamber === 'la' || v.chamber === 'ra') {
          const aScale = 1 + aPulse * 0.04 + vPulse * 0.014;
          x *= aScale;
          z *= aScale;
        } else {
          // Great vessels expand slightly as systolic blood wave ejects into aorta/pulmonary trunk
          const vScale = 1 + vPulse * 0.03;
          x *= vScale;
          z *= vScale;
        }

        // Rotate position Y -> X -> Z
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const x3 = x1 * cosZ - y2 * sinZ;
        const y3 = x1 * sinZ + y2 * cosZ;

        // Rotate smooth vertex normal Y -> X -> Z
        const nx1 = v.normal.x * cosY + v.normal.z * sinY;
        const nz1 = -v.normal.x * sinY + v.normal.z * cosY;
        const ny2 = v.normal.y * cosX - nz1 * sinX;
        const nz2 = v.normal.y * sinX + nz1 * cosX;
        const nx3 = nx1 * cosZ - ny2 * sinZ;
        const ny3 = nx1 * sinZ + ny2 * cosZ;

        const persp = fov / Math.max(1.2, fov - z2);
        txArr[i] = x3;
        tyArr[i] = y3;
        tzArr[i] = z2;
        nxArr[i] = nx3;
        nyArr[i] = ny3;
        nzArr[i] = nz2;
        sxArr[i] = bufCx + x3 * bufScale * persp;
        syArr[i] = bufCy - (y3 - 0.18) * bufScale * persp;
      }

      // 2) Per-Pixel Smooth Barycentric Phong + Subsurface Scattering Rasterizer
      const pulseGlowBoost = vPulse * 18;

      for (let t = 0; t < triangles.length; t++) {
        const tri = triangles[t];
        const i0 = tri.i0;
        const i1 = tri.i1;
        const i2 = tri.i2;

        // Quick backface check in screen space
        const x0 = sxArr[i0];
        const y0 = syArr[i0];
        const x1 = sxArr[i1];
        const y1 = syArr[i1];
        const x2 = sxArr[i2];
        const y2 = syArr[i2];

        const area2 = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        // Skip degenerate or back-facing triangles
        if (area2 >= 0 && nzArr[i0] < -0.15 && nzArr[i1] < -0.15 && nzArr[i2] < -0.15) {
          continue;
        }
        const absArea = Math.abs(area2);
        if (absArea < 0.05) continue;

        const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
        const maxX = Math.min(BUF_W - 1, Math.ceil(Math.max(x0, x1, x2)));
        const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
        const maxY = Math.min(BUF_H - 1, Math.ceil(Math.max(y0, y1, y2)));

        if (minX > maxX || minY > maxY) continue;

        const invArea = 1 / area2;
        const v0 = vertices[i0];
        const v1 = vertices[i1];
        const v2 = vertices[i2];

        const z0 = tzArr[i0];
        const z1 = tzArr[i1];
        const z2 = tzArr[i2];

        const n0x = nxArr[i0],
          n0y = nyArr[i0],
          n0z = nzArr[i0];
        const n1x = nxArr[i1],
          n1y = nyArr[i1],
          n1z = nzArr[i1];
        const n2x = nxArr[i2],
          n2y = nyArr[i2],
          n2z = nzArr[i2];

        const [r0, g0, b0] = v0.baseRGB;
        const [r1, g1, b1] = v1.baseRGB;
        const [r2, g2, b2] = v2.baseRGB;

        const ao0 = v0.ao,
          ao1 = v1.ao,
          ao2 = v2.ao;

        for (let py = minY; py <= maxY; py++) {
          const cy = py + 0.5;
          const rowOffset = py * BUF_W;
          for (let px = minX; px <= maxX; px++) {
            const cx = px + 0.5;

            const w0 = ((x1 - cx) * (y2 - cy) - (x2 - cx) * (y1 - cy)) * invArea;
            const w1 = ((x2 - cx) * (y0 - cy) - (x0 - cx) * (y2 - cy)) * invArea;
            const w2 = 1 - w0 - w1;

            if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;

            const z = w0 * z0 + w1 * z1 + w2 * z2;
            const idx = rowOffset + px;
            if (z <= zBuffer[idx]) continue;
            zBuffer[idx] = z;

            // Smoothly interpolated normal at this pixel
            let nx = w0 * n0x + w1 * n1x + w2 * n2x;
            let ny = w0 * n0y + w1 * n1y + w2 * n2y;
            let nz = w0 * n0z + w1 * n1z + w2 * n2z;
            const nLen = Math.hypot(nx, ny, nz) || 1;
            nx /= nLen;
            ny /= nLen;
            nz /= nLen;

            // Ensure outward-facing normal
            if (nz < 0) {
              nx = -nx * 0.35;
              ny = -ny * 0.35;
              nz = 0.05;
            }

            // Interpolated base color & Ambient Occlusion
            const br = w0 * r0 + w1 * r1 + w2 * r2;
            const bg = w0 * g0 + w1 * g1 + w2 * g2;
            const bb = w0 * b0 + w1 * b1 + w2 * b2;
            const ao = w0 * ao0 + w1 * ao1 + w2 * ao2;

            // 1) Key diffuse lighting + Subsurface Scattering wrap
            const nDotL = nx * keyLx + ny * keyLy + nz * keyLz;
            const diffuse = Math.max(0, nDotL) * 0.78;
            // Subsurface scattering (warm crimson light wrapping into shadow terminator)
            const wrap = Math.max(0, (nDotL + 0.48) / 1.48);
            const sss = wrap * wrap * 0.36;

            // 2) Warm lower-right bounce fill light
            const fillDot = Math.max(0, nx * 0.55 - ny * 0.45 + nz * 0.4) * 0.24;

            // 3) Dual-lobe wet biological specular (soft sheen + sharp wet gloss)
            const nDotH = Math.max(0, nx * halfX + ny * halfY + nz * halfZ);
            const nDotH2 = nDotH * nDotH;
            const nDotH4 = nDotH2 * nDotH2;
            const nDotH16 = nDotH4 * nDotH4 * nDotH4 * nDotH4;
            const nDotH64 = nDotH16 * nDotH16 * nDotH16 * nDotH16;
            const wetSheen = nDotH16 * 0.28 + nDotH64 * 0.52;

            // 4) Subtle Cyan Rim Reflection ONLY at the grazing silhouette edge
            const oneMinusNz = 1 - Math.min(1, Math.max(0, nz));
            const fresnelRim = oneMinusNz * oneMinusNz * oneMinusNz * oneMinusNz;
            const cyanEdge = fresnelRim * 0.58;

            const lightFactor = (0.24 + diffuse + fillDot) * ao;

            const finalR = Math.min(
              255,
              Math.max(
                0,
                (br * lightFactor + sss * 185 + wetSheen * 245 + pulseGlowBoost * ao + cyanEdge * 18) | 0
              )
            );
            const finalG = Math.min(
              255,
              Math.max(
                0,
                (bg * lightFactor + sss * 26 + wetSheen * 185 + cyanEdge * 215) | 0
              )
            );
            const finalB = Math.min(
              255,
              Math.max(
                0,
                (bb * lightFactor + sss * 38 + wetSheen * 195 + cyanEdge * 245) | 0
              )
            );

            // Little-endian ABGR packing for Uint32Array ImageData
            pixels32[idx] = (255 << 24) | (finalB << 16) | (finalG << 8) | finalR;
          }
        }
      }

      offCtx.putImageData(imgData, 0, 0);

      // --- COMPOSITE ONTO MAIN HIGH-DPI CANVAS ---
      ctx.clearRect(0, 0, cw, ch);
      const cx = cw * 0.5;
      const cy = ch * 0.5;
      const stageRadius = Math.min(cw, ch) * 0.44;

      // 1) Volumetric Ambient Lab Halo behind the 3D Heart
      const haloR = stageRadius * (1.15 + vPulse * 0.08);
      const haloGrad = ctx.createRadialGradient(cx, cy, stageRadius * 0.08, cx, cy, haloR);
      haloGrad.addColorStop(0, `rgba(190, 24, 52, ${0.24 + vPulse * 0.12})`);
      haloGrad.addColorStop(0.52, `rgba(0, 210, 255, ${0.07 + vPulse * 0.05})`);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Helper to draw thin, delicate 3D Orbital HUD Rings
      const baseScale = Math.min(cw, ch) * 0.275;
      const drawDelicateOrbitRing = (
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
        const segments = 96;
        const cosTX = Math.cos(tiltXRad);
        const sinTX = Math.sin(tiltXRad);
        const ctz = Math.cos(tiltZRad);
        const stz = Math.sin(tiltZRad);

        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2 + spinOffset;
          const rx = Math.cos(a) * radius3D;
          const rz = Math.sin(a) * radius3D;

          const y1 = -rz * sinTX;
          const z1 = rz * cosTX;
          const x2 = rx * ctz - y1 * stz;
          const y2 = rx * stz + y1 * ctz;

          const isFront = z1 >= 0;
          if (isFront !== frontHalf) {
            started = false;
            continue;
          }

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

      const spin1 = now * 0.00025;
      const spin2 = -now * 0.00035;

      // 2) Back half of delicate orbital rings
      drawDelicateOrbitRing(1.78, 1.14, 0.08, spin1, 'rgba(0, 240, 255, 0.16)', 1.0, false);
      drawDelicateOrbitRing(1.5, 0.92, -0.32, spin2, 'rgba(0, 229, 163, 0.14)', 0.9, false);

      // 3) Draw the Smooth Per-Pixel Shaded 3D Anatomical Heart
      const drawSize = Math.min(cw, ch) * 0.94;
      ctx.save();
      ctx.shadowColor = `rgba(225, 29, 72, ${0.28 + vPulse * 0.2})`;
      ctx.shadowBlur = 24;
      ctx.drawImage(
        offCanvas,
        cx - drawSize * 0.5,
        cy - drawSize * 0.5,
        drawSize,
        drawSize
      );
      ctx.restore();

      // 4) Soft Systolic Pulse Wave Ring on each heartbeat
      if (shockwavePhase > 0 && !reducedMotionRef.current) {
        const waveRadius = 1.08 + shockwavePhase * 0.95;
        const alpha = Math.sin(shockwavePhase * Math.PI) * 0.36;
        drawDelicateOrbitRing(
          waveRadius,
          1.14,
          0.08,
          0,
          `rgba(0, 240, 255, ${alpha.toFixed(3)})`,
          1.5,
          true
        );
        drawDelicateOrbitRing(
          waveRadius,
          1.14,
          0.08,
          0,
          `rgba(0, 240, 255, ${(alpha * 0.6).toFixed(3)})`,
          1.1,
          false
        );
      }

      // 5) Right-Click Cyan Activation Wave Ring (when opening/closing the 4 floating charts)
      if (rightClickWavePhaseRef.current > 0) {
        const rcP = rightClickWavePhaseRef.current;
        const rcR = stageRadius * (0.25 + rcP * 1.15);
        const rcAlpha = Math.max(0, (1 - rcP) * 0.75);
        ctx.save();
        ctx.strokeStyle = `rgba(0, 240, 255, ${rcAlpha.toFixed(3)})`;
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(cx, cy, rcR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 6) Front half of delicate orbital rings
      drawDelicateOrbitRing(1.78, 1.14, 0.08, spin1, 'rgba(0, 240, 255, 0.38)', 1.15, true);
      drawDelicateOrbitRing(1.5, 0.92, -0.32, spin2, 'rgba(0, 229, 163, 0.3)', 1.0, true);

      // 7) Subtle Orbiting Telemetry Particles
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!reducedMotionRef.current) {
          p.angle += dt * p.speed * (1 + vPulse * 0.35);
        }
        const rx = Math.cos(p.angle) * p.radius;
        const rz = Math.sin(p.angle) * p.radius;
        const ry = Math.sin(p.angle * 1.4 + p.tiltX) * 0.48;

        const persp = fov / Math.max(1.2, fov - rz);
        const sx = cx + rx * baseScale * persp;
        const sy = cy - ry * baseScale * persp;
        const rSize = p.size * persp;

        ctx.fillStyle = p.isCyan
          ? `rgba(0, 240, 255, ${0.38 + vPulse * 0.35})`
          : `rgba(255, 77, 109, ${0.42 + vPulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(sx, sy, rSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
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
      aria-label="Trung tâm giải phẫu tim 3D chân thực và 4 biểu đồ HUD"
      className="relative rounded-3xl nexus-glass overflow-hidden border border-cyan-500/25 shadow-2xl"
    >
      {/* Subtle Radial Bio-Lab Backdrop inside Hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: isLightMode
            ? 'radial-gradient(circle at 50% 50%, rgba(190, 24, 52, 0.06), rgba(2, 132, 199, 0.04) 45%, transparent 75%)'
            : 'radial-gradient(circle at 50% 50%, rgba(190, 24, 52, 0.14), rgba(0, 240, 255, 0.06) 42%, rgba(5, 8, 17, 0.94) 78%)',
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
                BIOMEDICAL 3D ANATOMICAL HEART • TELEMETRY COMMAND
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-tech bg-cyan-500/10 border border-cyan-400/30 text-cyan-300">
                <Sparkles className="w-3 h-3" />
                Smooth Subsurface 3D Anatomy
              </span>
            </div>
            <h2 className="font-display font-bold text-lg sm:text-xl text-white">
              Mô Hình Giải Phẫu Trái Tim Người 3D & Bốn Biểu Đồ Kính Tương Tác
            </h2>
          </div>
        </div>

        {/* Interactive 3D Viewport Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mobile / Touch fallback & quick toggle button for the 4 Glass Charts */}
          <button
            type="button"
            onClick={handleToggleFloatingCharts}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono-tech font-semibold transition-all cursor-pointer ${
              floatingChartsOpen
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 border-cyan-500/35 text-cyan-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {floatingChartsOpen ? 'Ẩn 4 Biểu Đồ HUD' : 'Mở 4 Biểu Đồ HUD (Chuột phải / Chạm)'}
            </span>
          </button>

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

      {/* Main 3-Column Command Center Grid: Left HUD | Center 3D Heart + 4 Floating Glass Charts | Right HUD */}
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

        {/* CENTER 3D ANATOMICAL HEART STAGE + 4 FLOATING GLASS CHARTS */}
        <div
          ref={stageContainerRef}
          onContextMenu={(e) => {
            // Only intercept right-click inside the 3D Heart stage to toggle the 4 floating glass charts
            e.preventDefault();
            e.stopPropagation();
            handleToggleFloatingCharts();
          }}
          className="lg:col-span-6 relative flex flex-col items-center justify-center order-1 lg:order-2 min-h-[390px] sm:min-h-[450px] lg:min-h-[490px]"
        >
          {/* Subtle HUD Corner Brackets */}
          <div className="pointer-events-none absolute inset-1 sm:inset-2 border border-cyan-500/15 rounded-3xl">
            <div className="absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-lg" />
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 border-cyan-400/70 rounded-tr-lg" />
            <div className="absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 border-cyan-400/70 rounded-bl-lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 border-cyan-400/70 rounded-br-lg" />
          </div>

          {/* Smooth Per-Pixel 3D Anatomical Heart Canvas */}
          <canvas
            ref={canvasRef}
            title="Kéo chuột trái để xoay 360° • Nhấp chuột phải vào vùng trái tim để mở/đóng 4 biểu đồ kính trong suốt"
            className="w-full h-[360px] sm:h-[430px] lg:h-[470px] cursor-grab active:cursor-grabbing select-none touch-none"
          />

          {/* 4 Floating Glassmorphism Charts (Triggered by Right-Click on the Heart Stage or Touch Button) */}
          <FloatingHeartChartsHUD
            visible={floatingChartsOpen}
            onClose={() => setFloatingChartsOpen(false)}
            metrics={metrics}
            series={series}
            dataMode={dataMode}
            isLiveConnected={isLiveValid}
            reducedMotion={reducedMotion}
          />

          {/* Bottom Center Interactive Instruction Pill */}
          <div className="relative z-20 -mt-2 mb-1 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-cyan-500/30 text-[11px] font-mono-tech text-slate-200 flex flex-wrap items-center justify-center gap-2 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            <span>Kéo chuột trái: Xoay 3D</span>
            <span className="text-slate-500">•</span>
            <span className="inline-flex items-center gap-1 text-cyan-300 font-semibold">
              <MousePointerClick className="w-3.5 h-3.5" />
              Nhấp chuột phải vào tim: {floatingChartsOpen ? 'Đóng 4 biểu đồ' : 'Mở 4 biểu đồ kính'}
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
                Mô hình giải phẫu 3D bề mặt mịn (Tâm thất, Tâm nhĩ, Quai động mạch chủ, Động mạch phổi, Tĩnh mạch chủ & Mạch vành) đồng bộ nhịp{' '}
                <strong>Lub-Dub</strong> theo BPM.
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

"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BrandTMarkProps {
  scale?: number;
  reducedMotion?: boolean;
  lite?: boolean;
}

/** Ease-out cubic for draw-on reveal */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Logo T stroke: bottom hook → stem → sweeping crossbar → ring connection */
function buildTControlPoints(): THREE.Vector3[] {
  return [
    new THREE.Vector3(-0.48, -0.9, 0.02),
    new THREE.Vector3(-0.42, -0.55, 0.05),
    new THREE.Vector3(-0.3, -0.08, 0.09),
    new THREE.Vector3(-0.22, 0.32, 0.12),
    new THREE.Vector3(-0.78, 0.48, 0.14),
    new THREE.Vector3(-0.42, 0.7, 0.16),
    new THREE.Vector3(0.08, 0.86, 0.15),
    new THREE.Vector3(0.55, 0.82, 0.12),
    new THREE.Vector3(0.82, 0.55, 0.08),
    new THREE.Vector3(0.5, 0.18, 0.06),
    new THREE.Vector3(0.0, -0.22, 0.04),
    new THREE.Vector3(-0.36, -0.62, 0.02),
  ];
}

function applyVertexGradient(geometry: THREE.TubeGeometry): void {
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const top = new THREE.Color("#eaf2ff");
  const mid = new THREE.Color("#3b82f6");
  const bottom = new THREE.Color("#4f46e5");
  const temp = new THREE.Color();

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const span = Math.max(maxY - minY, 0.001);

  for (let i = 0; i < positions.count; i += 1) {
    const y = positions.getY(i);
    const t = (y - minY) / span;
    if (t < 0.45) {
      temp.copy(bottom).lerp(mid, t / 0.45);
    } else {
      temp.copy(mid).lerp(top, (t - 0.45) / 0.55);
    }
    colors[i * 3] = temp.r;
    colors[i * 3 + 1] = temp.g;
    colors[i * 3 + 2] = temp.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function createTGeometry(lite: boolean): {
  geometry: THREE.TubeGeometry;
  curve: THREE.CatmullRomCurve3;
  indexCount: number;
} {
  const curve = new THREE.CatmullRomCurve3(buildTControlPoints(), false, "catmullrom", 0.62);
  const tubularSegments = lite ? 120 : 240;
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, 0.075, lite ? 16 : 24, false);
  applyVertexGradient(geometry);
  const indexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count;
  return { geometry, curve, indexCount };
}

export default function BrandTMark({
  scale = 1,
  reducedMotion = false,
  lite = false,
}: BrandTMarkProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const capStartMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const capEndMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const drawProgressRef = useRef(reducedMotion || lite ? 1 : 0);
  const indexCountRef = useRef(0);

  const { geometry, curve, indexCount } = useMemo(
    () => createTGeometry(lite),
    [lite],
  );

  useLayoutEffect(() => {
    indexCountRef.current = indexCount;
    if (reducedMotion || lite) {
      geometry.setDrawRange(0, indexCount);
      drawProgressRef.current = 1;
    } else {
      geometry.setDrawRange(0, 0);
      drawProgressRef.current = 0;
    }
  }, [geometry, indexCount, reducedMotion, lite]);

  const capStart = useMemo(() => curve.getPoint(0), [curve]);
  const capEnd = useMemo(() => curve.getPoint(1), [curve]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    const material = materialRef.current;
    const elapsed = state.clock.getElapsedTime();

    if (!reducedMotion && !lite && drawProgressRef.current < 1) {
      drawProgressRef.current = Math.min(1, drawProgressRef.current + delta / 1.6);
      const eased = easeOutCubic(drawProgressRef.current);
      geometry.setDrawRange(0, Math.floor(indexCountRef.current * eased));
    }

    if (material && !reducedMotion) {
      material.emissiveIntensity = 0.52 + Math.sin(elapsed * 1.4) * 0.12;
    }

    const capOpacity = Math.max(0, (drawProgressRef.current - 0.82) / 0.18);
    if (capStartMatRef.current) capStartMatRef.current.opacity = capOpacity;
    if (capEndMatRef.current) capEndMatRef.current.opacity = capOpacity;

    if (mesh && !reducedMotion) {
      mesh.rotation.z = Math.sin(elapsed * 0.35) * 0.04;
      mesh.position.y = Math.sin(elapsed * 0.5) * 0.03;
    }
  });

  return (
    <group scale={scale} rotation={[0, 0, 0]}>
      <mesh ref={meshRef} geometry={geometry} renderOrder={2}>
        <meshStandardMaterial
          ref={materialRef}
          vertexColors
          emissive="#3b82f6"
          emissiveIntensity={reducedMotion ? 0.55 : 0.6}
          roughness={0.2}
          metalness={0.55}
        />
      </mesh>

      <mesh position={capStart} renderOrder={3}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial
          ref={capStartMatRef}
          color="#eaf2ff"
          emissive="#60a5fa"
          emissiveIntensity={0.7}
          roughness={0.15}
          metalness={0.5}
          transparent
          opacity={reducedMotion || lite ? 1 : 0}
        />
      </mesh>
      <mesh position={capEnd} renderOrder={3}>
        <sphereGeometry args={[0.085, 16, 16]} />
        <meshStandardMaterial
          ref={capEndMatRef}
          color="#6366f1"
          emissive="#4f46e5"
          emissiveIntensity={0.65}
          roughness={0.15}
          metalness={0.5}
          transparent
          opacity={reducedMotion || lite ? 1 : 0}
        />
      </mesh>

      {/* Soft inner glow behind the stroke */}
      <mesh position={[0, 0, -0.08]} renderOrder={0}>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial
          color="#312e81"
          transparent
          opacity={lite ? 0.12 : 0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

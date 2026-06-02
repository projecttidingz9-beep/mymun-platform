"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import BrandTMark from "./BrandTMark";

interface BrandOrbitProps {
  position?: [number, number, number];
  scale?: number;
  reducedMotion?: boolean;
  lite?: boolean;
}

const PARTICLE_COUNT = 120;

export default function BrandOrbit({
  position = [0, 0, 0],
  scale = 1,
  reducedMotion = false,
  lite = false,
}: BrandOrbitProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particleGeometry = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 1.55 + (i % 7) * 0.04;
      const y = (Math.sin(angle * 3) * 0.12 + (i % 5) * 0.02) - 0.05;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const group = groupRef.current;
    const ring = ringRef.current;
    const particles = particlesRef.current;

    if (group && !reducedMotion) {
      group.rotation.y = t * 0.12;
      const breathe = 1 + Math.sin(t * 0.55) * 0.03;
      group.scale.setScalar(scale * breathe);
    }

    if (ring && !reducedMotion) {
      ring.rotation.x = Math.PI * 0.42 + Math.sin(t * 0.2) * 0.04;
      ring.rotation.z = Math.sin(t * 0.15) * 0.06;
    }

    if (particles && !reducedMotion) {
      particles.rotation.y = -t * 0.18;
      particles.rotation.x = Math.sin(t * 0.25) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <mesh ref={ringRef} rotation={[Math.PI * 0.42, 0, 0]}>
        <torusGeometry args={[1.42, 0.055, 32, 128]} />
        <meshStandardMaterial
          color="#60a5fa"
          emissive="#3b82f6"
          emissiveIntensity={0.85}
          roughness={0.15}
          metalness={0.65}
          transparent
          opacity={0.92}
        />
      </mesh>

      <mesh rotation={[Math.PI * 0.42, 0, 0]}>
        <torusGeometry args={[1.42, 0.12, 32, 128]} />
        <meshBasicMaterial
          color="#6366f1"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <points ref={particlesRef} geometry={particleGeometry}>
        <pointsMaterial
          color="#a78bfa"
          size={0.045}
          transparent
          opacity={0.75}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <BrandTMark scale={1} reducedMotion={reducedMotion} lite={lite} />
    </group>
  );
}

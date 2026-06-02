"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface FlowRibbonProps {
  color?: string;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}

export default function FlowRibbon({
  color = "#60a5fa",
  opacity = 0.55,
  position = [0, 0, -2],
  rotation = [0, 0, 0],
  scale = 1,
}: FlowRibbonProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = (t - 0.5) * 9;
      const y = Math.sin(t * Math.PI * 2.2) * 1.1;
      const z = Math.cos(t * Math.PI * 1.6) * 0.9;
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    return new THREE.TubeGeometry(curve, 220, 0.11, 24, false);
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.getElapsedTime();
    mesh.rotation.z = rotation[2] + Math.sin(t * 0.15) * 0.08;
    mesh.position.y = position[1] + Math.sin(t * 0.25) * 0.08;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        roughness={0.25}
        metalness={0.6}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

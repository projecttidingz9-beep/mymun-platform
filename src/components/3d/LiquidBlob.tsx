"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

interface LiquidBlobProps {
  position?: [number, number, number];
  scale?: number;
  speed?: number;
  distort?: number;
  color?: string;
  emissive?: string;
}

export default function LiquidBlob({
  position = [0, 0, 0],
  scale = 1.6,
  speed = 0.6,
  distort = 0.38,
  color = "#4f46e5",
  emissive = "#1e1b4b",
}: LiquidBlobProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.getElapsedTime();
    mesh.rotation.x = Math.sin(t * 0.12) * 0.18;
    mesh.rotation.y = t * 0.08;
    mesh.position.y = position[1] + Math.sin(t * 0.4) * 0.05;
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <icosahedronGeometry args={[1, 64]} />
      <MeshDistortMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={0.35}
        roughness={0.18}
        metalness={0.42}
        distort={distort}
        speed={speed}
        envMapIntensity={1.15}
      />
    </mesh>
  );
}

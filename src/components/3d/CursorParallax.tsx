"use client";

import { ReactNode, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CursorParallaxProps {
  children: ReactNode;
  strength?: number;
  damping?: number;
}

export default function CursorParallax({
  children,
  strength = 0.35,
  damping = 0.04,
}: CursorParallaxProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const targetX = state.pointer.x * strength;
    const targetY = state.pointer.y * strength * 0.6;
    group.rotation.y += (targetX - group.rotation.y) * damping;
    group.rotation.x += (-targetY - group.rotation.x) * damping;
  });

  return <group ref={groupRef}>{children}</group>;
}

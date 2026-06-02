"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const LOGO_SRC = "/brand/logo-icon-dark.png";
const PARTICLE_COUNT_FULL = 120;
const PARTICLE_COUNT_LITE = 60;

interface BrandLogoMarkProps {
  scale?: number;
  reducedMotion?: boolean;
  lite?: boolean;
}

function knockOutDarkBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  threshold = 32,
  ramp = 40,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const luminance =
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (luminance < threshold) {
      data[i + 3] = 0;
    } else if (luminance < threshold + ramp) {
      const t = (luminance - threshold) / ramp;
      data[i + 3] = Math.round(data[i + 3] * t);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function createHaloTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.08,
      size / 2,
      size / 2,
      size * 0.5,
    );
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.55)");
    gradient.addColorStop(0.45, "rgba(99, 102, 241, 0.22)");
    gradient.addColorStop(1, "rgba(49, 46, 129, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildParticleGeometry(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 1.35 + (i % 7) * 0.035;
    const y = Math.sin(angle * 3) * 0.1 + (i % 5) * 0.015;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius * 0.35;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geo;
}

export default function BrandLogoMark({
  scale = 1,
  reducedMotion = false,
  lite = false,
}: BrandLogoMarkProps) {
  const [logoTexture, setLogoTexture] = useState<THREE.CanvasTexture | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const logoMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const entranceRef = useRef(reducedMotion || lite ? 1 : 0);
  const logoTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const planeSize = lite ? 2.2 : 2.8;
  const haloSize = lite ? 3.4 : 4.2;
  const particleCount = lite ? PARTICLE_COUNT_LITE : PARTICLE_COUNT_FULL;
  const animate = !reducedMotion && !lite;

  const haloTexture = useMemo(() => createHaloTexture(), []);
  const particleGeometry = useMemo(
    () => buildParticleGeometry(particleCount),
    [particleCount],
  );

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      knockOutDarkBackground(ctx, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      logoTextureRef.current?.dispose();
      logoTextureRef.current = texture;
      setLogoTexture(texture);
    };
    img.onerror = () => {
      if (!cancelled) setLogoTexture(null);
    };
    img.src = LOGO_SRC;

    return () => {
      cancelled = true;
      logoTextureRef.current?.dispose();
      logoTextureRef.current = null;
    };
  }, []);

  useEffect(
    () => () => {
      haloTexture.dispose();
      particleGeometry.dispose();
    },
    [haloTexture, particleGeometry],
  );

  useLayoutEffect(() => {
    if (!logoTexture) return;
    const group = groupRef.current;
    if (group) {
      group.scale.setScalar(scale);
    }
    if (logoMatRef.current) {
      logoMatRef.current.opacity = 1;
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity = 0.42;
    }
  }, [logoTexture, scale]);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const group = groupRef.current;
    const logoMat = logoMatRef.current;
    const haloMat = haloMatRef.current;
    const particles = particlesRef.current;

    if (animate && entranceRef.current < 1) {
      entranceRef.current = Math.min(1, entranceRef.current + delta / 0.9);
    }

    const entrance = reducedMotion || lite ? 1 : Math.max(0, easeOutBack(Math.min(1, entranceRef.current)));
    const entranceOpacity = reducedMotion || lite ? 1 : Math.min(1, entranceRef.current * 1.15);

    if (group) {
      const baseScale = scale * (0.85 + entrance * 0.15);
      group.scale.setScalar(baseScale);
      if (animate) {
        group.position.y = Math.sin(elapsed * 0.55) * 0.06;
        group.rotation.z = Math.sin(elapsed * 0.35) * 0.025;
      }
    }

    if (logoMat) {
      logoMat.opacity = entranceOpacity;
    }

    if (haloMat) {
      const pulse = animate ? 0.38 + Math.sin(elapsed * 1.1) * 0.12 : 0.42;
      haloMat.opacity = pulse * entranceOpacity;
    }

    if (particles && animate) {
      particles.rotation.y = elapsed * 0.14;
      particles.rotation.x = Math.sin(elapsed * 0.22) * 0.06;
    }
  });

  if (!logoTexture) return null;

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, -0.12]} renderOrder={0}>
        <planeGeometry args={[haloSize, haloSize]} />
        <meshBasicMaterial
          ref={haloMatRef}
          map={haloTexture}
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <points ref={particlesRef} geometry={particleGeometry} renderOrder={1}>
        <pointsMaterial
          color="#a78bfa"
          size={lite ? 0.038 : 0.045}
          transparent
          opacity={lite ? 0.55 : 0.72}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <mesh position={[0, 0, 0.05]} renderOrder={2}>
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial
          ref={logoMatRef}
          map={logoTexture}
          transparent
          opacity={reducedMotion || lite ? 1 : 0}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

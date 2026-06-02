"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const LOGO_SRC = "/brand/logo-icon-dark.png";
const PARTICLE_COUNT_FULL = 180;
const PARTICLE_COUNT_LITE = 70;
const PULSE_RING_COUNT = 3;

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

function createHaloTexture(bright = false): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * (bright ? 0.04 : 0.08),
      size / 2,
      size / 2,
      size * 0.5,
    );
    if (bright) {
      gradient.addColorStop(0, "rgba(147, 197, 253, 0.85)");
      gradient.addColorStop(0.35, "rgba(99, 102, 241, 0.45)");
      gradient.addColorStop(1, "rgba(49, 46, 129, 0)");
    } else {
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.65)");
      gradient.addColorStop(0.45, "rgba(99, 102, 241, 0.28)");
      gradient.addColorStop(1, "rgba(49, 46, 129, 0)");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createGodRayTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const cx = size / 2;
    const cy = size / 2;
    const rayCount = 14;
    for (let i = 0; i < rayCount; i += 1) {
      const start = (i / rayCount) * Math.PI * 2;
      const end = start + (Math.PI * 2) / rayCount * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, size * 0.48, start, end);
      ctx.closePath();
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.48);
      gradient.addColorStop(0, "rgba(96, 165, 250, 0.42)");
      gradient.addColorStop(0.55, "rgba(99, 102, 241, 0.12)");
      gradient.addColorStop(1, "rgba(167, 139, 250, 0)");
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildParticleLayers(count: number): {
  inner: THREE.BufferGeometry;
  outer: THREE.BufferGeometry;
} {
  const innerCount = Math.floor(count * 0.55);
  const outerCount = count - innerCount;

  const buildLayer = (n: number, minR: number, maxR: number, zSpread: number) => {
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const angle = (i / n) * Math.PI * 2 + (i % 11) * 0.08;
      const radius = minR + ((i * 17) % 100) / 100 * (maxR - minR);
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle * 2.1) * 0.12 + ((i % 9) - 4) * 0.02;
      positions[i * 3 + 2] = Math.sin(angle) * radius * zSpread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  };

  return {
    inner: buildLayer(innerCount, 1.05, 1.45, 0.28),
    outer: buildLayer(outerCount, 1.55, 2.05, 0.42),
  };
}

export default function BrandLogoMark({
  scale = 1,
  reducedMotion = false,
  lite = false,
}: BrandLogoMarkProps) {
  const [logoTexture, setLogoTexture] = useState<THREE.CanvasTexture | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const raysRef = useRef<THREE.Mesh>(null);
  const logoMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const shimmerMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const innerHaloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesInnerRef = useRef<THREE.Points>(null);
  const particlesOuterRef = useRef<THREE.Points>(null);
  const pulseRingRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const pulseMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const entranceRef = useRef(reducedMotion || lite ? 1 : 0);
  const logoTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const haloBlue = useMemo(() => new THREE.Color("#3b82f6"), []);
  const haloIndigo = useMemo(() => new THREE.Color("#6366f1"), []);

  const planeSize = lite ? 2.2 : 2.8;
  const haloSize = lite ? 3.8 : 5.2;
  const innerHaloSize = lite ? 2.8 : 3.6;
  const raysSize = lite ? 4.2 : 5.8;
  const particleCount = lite ? PARTICLE_COUNT_LITE : PARTICLE_COUNT_FULL;
  const animate = !reducedMotion && !lite;

  const haloTexture = useMemo(() => createHaloTexture(false), []);
  const innerHaloTexture = useMemo(() => createHaloTexture(true), []);
  const godRayTexture = useMemo(() => createGodRayTexture(), []);
  const particleLayers = useMemo(
    () => buildParticleLayers(particleCount),
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
      innerHaloTexture.dispose();
      godRayTexture.dispose();
      particleLayers.inner.dispose();
      particleLayers.outer.dispose();
    },
    [haloTexture, innerHaloTexture, godRayTexture, particleLayers],
  );

  useLayoutEffect(() => {
    if (!logoTexture) return;
    const group = groupRef.current;
    if (group) {
      group.scale.setScalar(scale);
    }
    if (logoMatRef.current) logoMatRef.current.opacity = 1;
    if (shimmerMatRef.current) shimmerMatRef.current.opacity = animate ? 0 : 0.12;
    if (haloMatRef.current) haloMatRef.current.opacity = lite ? 0.35 : 0.55;
    if (innerHaloMatRef.current) innerHaloMatRef.current.opacity = lite ? 0.4 : 0.65;
  }, [logoTexture, scale, animate, lite]);

  useFrame((state, delta) => {
    const elapsed = state.clock.getElapsedTime();
    const group = groupRef.current;
    const rays = raysRef.current;

    if (animate && entranceRef.current < 1) {
      entranceRef.current = Math.min(1, entranceRef.current + delta / 1.1);
    }

    const rawEntrance = reducedMotion || lite ? 1 : entranceRef.current;
    const entrance = reducedMotion || lite ? 1 : Math.max(0, easeOutBack(Math.min(1, rawEntrance)));
    const entranceOpacity = reducedMotion || lite ? 1 : Math.min(1, rawEntrance * 1.2);

    const flashBoost =
      animate && rawEntrance < 0.35 ? (1 - rawEntrance / 0.35) * 0.55 : 0;
    const settleTilt =
      animate && rawEntrance < 1 ? (1 - rawEntrance) * 0.12 : 0;

    if (group) {
      const baseScale = scale * (0.6 + entrance * 0.4);
      group.scale.setScalar(baseScale);

      if (animate) {
        group.position.y = Math.sin(elapsed * 0.45) * 0.08;
        group.rotation.y = Math.sin(elapsed * 0.25) * 0.22;
        group.rotation.x = Math.sin(elapsed * 0.18) * 0.08 + settleTilt;
      }
    }

    if (rays && animate) {
      rays.rotation.z += delta * 0.12;
    }

    const colorShift = 0.5 + Math.sin(elapsed * 0.85) * 0.5;
    const haloPulse = (lite ? 0.35 : 0.52) + Math.sin(elapsed * 1.15) * (lite ? 0.06 : 0.14);
    const innerPulse = (lite ? 0.4 : 0.62) + Math.sin(elapsed * 1.45 + 0.5) * (lite ? 0.08 : 0.16);

    if (haloMatRef.current) {
      haloMatRef.current.opacity =
        (haloPulse + flashBoost * colorShift) * entranceOpacity;
      haloMatRef.current.color.copy(haloBlue).lerp(haloIndigo, colorShift);
    }

    if (innerHaloMatRef.current) {
      innerHaloMatRef.current.opacity =
        (innerPulse + flashBoost * 0.8) * entranceOpacity;
    }

    if (logoMatRef.current) {
      logoMatRef.current.opacity = entranceOpacity;
    }

    if (shimmerMatRef.current && animate) {
      shimmerMatRef.current.opacity =
        (0.12 + Math.sin(elapsed * 2.2) * 0.08) * entranceOpacity;
    }

    pulseRingRefs.current.forEach((mat, index) => {
      if (!mat) return;
      const ringMesh = pulseMeshRefs.current[index];
      if (!animate) {
        mat.opacity = lite ? 0.08 : 0.12;
        if (ringMesh) ringMesh.scale.setScalar(1);
        return;
      }
      const phase = (elapsed * 0.38 + index * 0.33) % 1;
      mat.opacity = (1 - phase) * 0.5 * entranceOpacity;
      if (ringMesh) {
        const s = 0.88 + phase * 1.35;
        ringMesh.scale.setScalar(s);
      }
    });

    if (particlesInnerRef.current && animate) {
      particlesInnerRef.current.rotation.y = elapsed * 0.1;
      const mat = particlesInnerRef.current.material as THREE.PointsMaterial;
      mat.opacity = (0.55 + Math.sin(elapsed * 2.8) * 0.2) * entranceOpacity;
    }

    if (particlesOuterRef.current && animate) {
      particlesOuterRef.current.rotation.y = -elapsed * 0.07;
      particlesOuterRef.current.rotation.x = Math.sin(elapsed * 0.2) * 0.05;
      const mat = particlesOuterRef.current.material as THREE.PointsMaterial;
      mat.opacity = (0.45 + Math.sin(elapsed * 2.1 + 1.2) * 0.25) * entranceOpacity;
    }
  });

  if (!logoTexture) return null;

  return (
    <group ref={groupRef}>
      {animate && (
        <mesh ref={raysRef} position={[0, 0, -0.2]} renderOrder={0}>
          <planeGeometry args={[raysSize, raysSize]} />
          <meshBasicMaterial
            map={godRayTexture}
            transparent
            opacity={0.55}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      <mesh position={[0, 0, -0.15]} renderOrder={1}>
        <planeGeometry args={[haloSize, haloSize]} />
        <meshBasicMaterial
          ref={haloMatRef}
          map={haloTexture}
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, 0, -0.1]} renderOrder={2}>
        <planeGeometry args={[innerHaloSize, innerHaloSize]} />
        <meshBasicMaterial
          ref={innerHaloMatRef}
          map={innerHaloTexture}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {Array.from({ length: PULSE_RING_COUNT }, (_, index) => (
        <mesh
          key={`pulse-${index}`}
          ref={(el) => {
            pulseMeshRefs.current[index] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <ringGeometry args={[0.95, 1.05, 64]} />
          <meshBasicMaterial
            ref={(el) => {
              pulseRingRefs.current[index] = el;
            }}
            color="#60a5fa"
            transparent
            opacity={animate ? 0 : 0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <points ref={particlesOuterRef} geometry={particleLayers.outer} renderOrder={4}>
        <pointsMaterial
          color="#c4b5fd"
          size={lite ? 0.042 : 0.052}
          transparent
          opacity={lite ? 0.4 : 0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <points ref={particlesInnerRef} geometry={particleLayers.inner} renderOrder={5}>
        <pointsMaterial
          color="#93c5fd"
          size={lite ? 0.035 : 0.044}
          transparent
          opacity={lite ? 0.5 : 0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <mesh position={[0, 0, 0.05]} renderOrder={6}>
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

      {!lite && (
        <mesh position={[0, 0, 0.06]} renderOrder={7}>
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            ref={shimmerMatRef}
            map={logoTexture}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

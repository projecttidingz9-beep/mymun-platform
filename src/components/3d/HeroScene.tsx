"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { Group } from "three";
import BrandLogoMark from "./BrandLogoMark";
import CursorParallax from "./CursorParallax";

type Tier = "full" | "lite";

interface HeroSceneProps {
  /** Mutable ref whose `current` is scroll progress 0..1 across the whole document. */
  scrollProgressRef?: MutableRefObject<number>;
  /** Fires the first time the GPU completes a frame and the scene is visible. */
  onFirstFrame?: () => void;
}

/**
 * Very cheap heuristic to decide whether a device should receive the full
 * scene or a stripped-down "lite" variant. We prefer false negatives: if we
 * cannot prove the device is capable, we fall back to `lite`.
 */
function detectTier(): Tier {
  if (typeof window === "undefined") return "lite";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "lite";

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const smallViewport = window.matchMedia("(max-width: 768px)").matches;
  const tabletViewport = window.matchMedia("(max-width: 1024px)").matches;
  const lowCpu = (nav.hardwareConcurrency ?? 8) <= 4;
  const lowMem = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
  const saveData = nav.connection?.saveData === true;
  const slowNet =
    nav.connection?.effectiveType === "slow-2g" ||
    nav.connection?.effectiveType === "2g" ||
    nav.connection?.effectiveType === "3g";
  const lowDpr = window.devicePixelRatio < 1.25;

  if (saveData || slowNet) return "lite";
  if (smallViewport) return "lite";
  if (tabletViewport && (lowCpu || lowMem)) return "lite";
  if (lowCpu && lowMem) return "lite";
  if (lowCpu || lowMem || lowDpr) return "lite";
  return "full";
}

/**
 * Runs inside the Canvas. Subscribes to the shared scroll-progress ref and
 * gently modulates the camera + root group so the scene evolves as the user
 * travels through the page — providing "section to section" continuity.
 */
function SceneController({
  scrollProgressRef,
  onFirstFrame,
  tier,
}: {
  scrollProgressRef?: MutableRefObject<number>;
  onFirstFrame?: () => void;
  tier: Tier;
}) {
  const { camera } = useThree();
  const groupRef = useRef<Group>(null);
  const firedRef = useRef(false);
  const smoothedRef = useRef(0);

  useFrame((_, delta) => {
    if (!firedRef.current) {
      firedRef.current = true;
      onFirstFrame?.();
    }

    const target = scrollProgressRef?.current ?? 0;
    // Smooth towards target so scrolling never produces hard jumps.
    const lerpFactor = Math.min(1, delta * 3.5);
    smoothedRef.current += (target - smoothedRef.current) * lerpFactor;
    const p = smoothedRef.current;

    // Camera gently pulls back and tilts as you descend the page.
    // Three.js scene-graph mutation is the canonical r3f pattern; the
    // generic "don't mutate hook return" lint does not apply here.
    const baseZ = tier === "lite" ? 5.8 : 5.4;
    // eslint-disable-next-line react-hooks/immutability
    camera.position.z = baseZ + p * 2.6;
    camera.position.y = -p * 0.65;
    camera.rotation.x = -p * 0.12;

    const group = groupRef.current;
    if (group) {
      group.rotation.y = p * 0.55;
      group.position.x = -p * 0.4;
      group.scale.setScalar(1 - p * 0.12);
    }
  });

  return <group ref={groupRef} />;
}

/** God-ray plane sizes from BrandLogoMark, plus bloom pad for overflow checks. */
const RAYS_SIZE_FULL = 5.8;
const RAYS_SIZE_LITE = 4.2;
const BLOOM_PAD = 1.25;
const EDGE_MARGIN = 0.35;

/** Desktop hero focal — larger, right-column placement; shrink only on overflow. */
const MARK_X_FULL = 5.2;
const MARK_Y_FULL = -0.12;
const MARK_SCALE_FULL = 1.62;
const MARK_X_LITE = 0;
const MARK_Y_LITE = -0.8;
const MARK_SCALE_LITE = 0.85;

function glowRadius(raysSize: number, scale: number): number {
  return (raysSize * scale * BLOOM_PAD) / 2;
}

/**
 * Start from the original fixed layout; clamp scale/position only when the
 * padded glow would clip the viewport edges.
 */
function clampMarkLayout(
  width: number,
  height: number,
  lite: boolean,
): { scale: number; x: number; y: number } {
  const raysSize = lite ? RAYS_SIZE_LITE : RAYS_SIZE_FULL;
  const baseY = lite ? MARK_Y_LITE : MARK_Y_FULL;
  let scale = lite ? MARK_SCALE_LITE : MARK_SCALE_FULL;
  const desiredX = lite ? MARK_X_LITE : Math.min(MARK_X_FULL, width * 0.36);
  let x = desiredX;

  if (width <= 0 || height <= 0) {
    return { scale, x, y: baseY };
  }

  const halfW = width / 2;
  const halfH = height / 2;
  const minX = -halfW + EDGE_MARGIN;
  const maxX = halfW - EDGE_MARGIN;
  const minY = -halfH + EDGE_MARGIN;
  const maxY = halfH - EDGE_MARGIN;

  const fitsHeight = (s: number) => {
    const r = glowRadius(raysSize, s);
    return baseY - r >= minY && baseY + r <= maxY;
  };

  const fitsWidth = (s: number, posX: number) => {
    const r = glowRadius(raysSize, s);
    return posX - r >= minX && posX + r <= maxX;
  };

  while (scale > 0.2 && !fitsHeight(scale)) {
    scale *= 0.96;
  }

  if (lite) {
    while (scale > 0.2 && !fitsWidth(scale, x)) {
      scale *= 0.96;
    }
    return { scale, x, y: baseY };
  }

  let r = glowRadius(raysSize, scale);
  if (x + r > maxX) {
    x = maxX - r;
  }
  if (x - r < minX) {
    const maxScaleForWidth =
      (2 * Math.min(x - minX, maxX - x)) / (raysSize * BLOOM_PAD);
    scale = Math.min(scale, maxScaleForWidth);
    r = glowRadius(raysSize, scale);
    x = Math.min(desiredX, maxX - r);
    if (x - r < minX) {
      scale = Math.min(scale, (2 * (maxX - minX)) / (raysSize * BLOOM_PAD));
      r = glowRadius(raysSize, scale);
      x = (minX + maxX) / 2;
    }
  }

  return { scale, x, y: baseY };
}

/**
 * Positions the brand mark from viewport size (updates on resize only).
 * Scale lives on BrandLogoMark so entrance animation is not double-applied.
 */
function ResponsiveBrandMark({
  tier,
  reducedMotion,
}: {
  tier: Tier;
  reducedMotion: boolean;
}) {
  const lite = tier === "lite";
  const vw = useThree((state) => state.viewport.width);
  const vh = useThree((state) => state.viewport.height);
  const layout = useMemo(
    () => clampMarkLayout(vw, vh, lite),
    [vw, vh, lite],
  );

  return (
    <group position={[layout.x, layout.y, 0]}>
      <BrandLogoMark
        scale={layout.scale}
        reducedMotion={reducedMotion}
        lite={lite}
      />
    </group>
  );
}

function SceneContents({
  tier,
  reducedMotion,
}: {
  tier: Tier;
  reducedMotion: boolean;
}) {
  const lite = tier === "lite";

  return (
    <>
      <ambientLight intensity={lite ? 0.42 : 0.32} />
      <directionalLight
        position={[4, 6, 5]}
        intensity={lite ? 0.95 : 1.15}
        color="#93c5fd"
      />
      {!lite && (
        <directionalLight
          position={[-5, -2, -3]}
          intensity={0.55}
          color="#6b88b8"
        />
      )}
      <pointLight position={[0, 0, 3]} intensity={0.35} color="#a5b4fc" />

      <Suspense fallback={null}>
        {!lite && <Environment preset="sunset" background={false} />}

        <CursorParallax strength={reducedMotion || lite ? 0 : 0.32}>
          <Float
            speed={reducedMotion ? 0 : lite ? 0.8 : 1.1}
            floatIntensity={reducedMotion ? 0 : lite ? 0.35 : 0.6}
            rotationIntensity={reducedMotion ? 0 : lite ? 0.2 : 0.35}
          >
            <ResponsiveBrandMark tier={tier} reducedMotion={reducedMotion} />
          </Float>
        </CursorParallax>

        {!lite && (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom
              intensity={1.1}
              luminanceThreshold={0.3}
              luminanceSmoothing={0.22}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Suspense>
    </>
  );
}

export default function HeroScene({
  scrollProgressRef,
  onFirstFrame,
}: HeroSceneProps) {
  // This component is rendered only on the client (dynamic(ssr:false)), so
  // we can safely resolve tier + motion preference during initial state.
  const [tier] = useState<Tier>(() =>
    typeof window === "undefined" ? "full" : detectTier(),
  );
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // setState here is driven by an external subscription (media query
    // change), which is the permitted pattern for `react-hooks/set-state-in-effect`.
    const syncMotion = () => setReducedMotion(motionMq.matches);
    motionMq.addEventListener("change", syncMotion);
    return () => {
      motionMq.removeEventListener("change", syncMotion);
    };
  }, []);

  const isLite = tier === "lite";

  return (
    <Canvas
      aria-hidden
      dpr={[1, isLite ? 1.2 : 1.75]}
      camera={{ position: [0, 0, isLite ? 5.8 : 5.4], fov: 42 }}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{
        antialias: !isLite,
        alpha: true,
        powerPreference: isLite ? "default" : "high-performance",
      }}
      style={{ background: "transparent" }}
    >
      <color attach="background" args={["#0b0d12"]} />
      <fog attach="fog" args={["#0b0d12", 6, 14]} />

      <SceneController
        scrollProgressRef={scrollProgressRef}
        onFirstFrame={onFirstFrame}
        tier={tier}
      />

      <SceneContents tier={tier} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

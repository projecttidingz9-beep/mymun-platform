"use client";

import { Suspense, useEffect, useRef, useState } from "react";
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

/** God-ray plane sizes from BrandLogoMark, plus bloom pad. */
const RAYS_SIZE_FULL = 5.8;
const RAYS_SIZE_LITE = 4.2;
const BLOOM_PAD = 1.25;
const EDGE_MARGIN = 0.35;

function computeMarkLayout(
  width: number,
  height: number,
  lite: boolean,
): { scale: number; x: number; y: number } {
  const fitSize = (lite ? RAYS_SIZE_LITE : RAYS_SIZE_FULL) * BLOOM_PAD;
  const maxScale = lite ? 0.9 : 1.05;
  const widthFactor = lite ? 0.7 : 0.42;
  const scale = Math.min(
    maxScale,
    (width * widthFactor) / fitSize,
    (height * 0.55) / fitSize,
  );
  const radius = (fitSize * scale) / 2;
  const x = lite
    ? 0
    : Math.min(width * 0.22, width / 2 - radius - EDGE_MARGIN);
  const y = lite ? -0.8 : 0.05;
  return { scale, x, y };
}

/**
 * Positions and scales the brand mark from the live R3F viewport every frame
 * so the full glow stays on-screen (React viewport subscriptions can go stale).
 * World scale is applied on the outer group; BrandLogoMark keeps scale={1} so
 * its entrance animation still runs on the local group.
 */
function ResponsiveBrandMark({
  tier,
  reducedMotion,
}: {
  tier: Tier;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const lite = tier === "lite";

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const { width, height } = state.viewport;
    if (width <= 0 || height <= 0) return;

    const layout = computeMarkLayout(width, height, lite);
    group.position.set(layout.x, layout.y, 0);
    group.scale.setScalar(layout.scale);
  });

  return (
    <group ref={groupRef}>
      <BrandLogoMark scale={1} reducedMotion={reducedMotion} lite={lite} />
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
              intensity={0.85}
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

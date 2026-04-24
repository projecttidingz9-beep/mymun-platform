"use client";

import { ReactNode, useEffect } from "react";
import Lenis from "@studio-freight/lenis";

interface ScrollShellProps {
  children: ReactNode;
}

export default function ScrollShell({ children }: ScrollShellProps) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const hardwareThreads = navigator.hardwareConcurrency ?? 8;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const constrainedConnection = connection?.saveData || connection?.effectiveType === "2g";
    const lowEndDevice = hardwareThreads <= 4 || deviceMemory <= 4 || Boolean(constrainedConnection);

    if (prefersReducedMotion || lowEndDevice) {
      return;
    }

    const lenis = new Lenis({
      duration: 0.58,
      easing: (t) => 1 - Math.pow(1 - t, 2.35),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.02,
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}

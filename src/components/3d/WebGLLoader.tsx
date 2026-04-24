"use client";

import { AnimatePresence, motion } from "framer-motion";

interface WebGLLoaderProps {
  visible: boolean;
}

export default function WebGLLoader({ visible }: WebGLLoaderProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="webgl-loader"
          aria-hidden
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
          className="fixed inset-0 z-[60] pointer-events-none flex items-end justify-between px-8 pb-10"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 50%, rgba(216,172,114,0.12), transparent 70%), #0b0d12",
          }}
        >
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-[10px] tracking-[0.38em] uppercase"
            style={{ color: "rgba(243,237,224,0.55)" }}
          >
            Tidingz · Loading atelier
          </motion.span>

          <div className="flex items-center gap-3">
            <motion.span
              className="block h-[1px] w-16 md:w-24"
              style={{
                background:
                  "linear-gradient(90deg, rgba(243,237,224,0.08), rgba(216,172,114,0.8), rgba(243,237,224,0.08))",
                backgroundSize: "200% 100%",
              }}
              animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
              transition={{
                duration: 1.8,
                ease: "linear",
                repeat: Infinity,
              }}
            />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="text-[10px] tracking-[0.38em] uppercase"
              style={{ color: "var(--accent-warm, #c79a62)" }}
            >
              Rendering
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

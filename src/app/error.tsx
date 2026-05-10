"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <Image
        src="/tidingz-logo.jpg"
        alt="Tidingz"
        width={72}
        height={72}
        className="rounded-2xl object-contain mb-6"
      />
      <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: "var(--fg-muted)" }}>
        Something went wrong
      </p>
      <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--fg)" }}>
        We couldn&apos;t load this page
      </h1>
      <p className="text-sm max-w-md mb-8" style={{ color: "var(--fg-muted)" }}>
        {error.message || "Please try again or return home."}
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <button type="button" onClick={() => reset()} className="lux-button-primary px-6 py-3 rounded-xl">
          Try again
        </button>
        <Link href="/" className="btn btn-secondary px-6 py-3 rounded-xl">
          Home
        </Link>
      </div>
    </div>
  );
}

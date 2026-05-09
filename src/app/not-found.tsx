import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-[0.25em] uppercase mb-2" style={{ color: "var(--fg-muted)" }}>
        404
      </p>
      <h1 className="text-3xl font-bold mb-3" style={{ color: "var(--fg)" }}>
        Page not found
      </h1>
      <p className="text-sm max-w-md mb-8" style={{ color: "var(--fg-muted)" }}>
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <Link href="/" className="lux-button-primary px-8 py-3.5 rounded-xl inline-flex">
        Back to Tidingz
      </Link>
    </div>
  );
}

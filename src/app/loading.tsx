import Image from "next/image";

export default function RootLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-6">
      <Image
        src="/tidingz-logo.jpg"
        alt="Tidingz"
        width={88}
        height={88}
        className="rounded-2xl object-contain drop-shadow-md"
        priority
      />
      <div className="skeleton h-10 w-48 rounded-lg" />
      <div className="skeleton h-4 w-72 rounded-md" />
      <div className="skeleton h-32 w-full max-w-md rounded-2xl mt-4" />
      <p className="text-xs mt-4" style={{ color: "var(--fg-muted)" }}>
        Loading Tidingz…
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { Conference } from "@/lib/types";
import { resolveConferenceBannerImage } from "@/lib/conference-media";

interface ConferenceCardProps {
  conference: Conference;
}

const LEVEL_BADGE: Record<string, { class: string; emoji: string }> = {
  "High School": { class: "badge-green", emoji: "🎓" },
  "University": { class: "badge-blue", emoji: "🎓" },
  "Elite": { class: "badge-gold", emoji: "⭐" },
  "Open": { class: "badge-gray", emoji: "🌐" },
  "Hybrid": { class: "badge-purple", emoji: "💻" },
};

function SeatsBar({ registered, capacity }: { registered: number; capacity: number }) {
  const pct = Math.round((registered / capacity) * 100);
  const color = pct > 85 ? "var(--danger)" : pct > 65 ? "var(--warning)" : "var(--success)";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: "var(--fg-muted)" }}>
        <span>{capacity - registered} seats left</span>
        <span>{pct}% full</span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})` }}
        />
      </div>
    </div>
  );
}

export default function ConferenceCard({ conference: c }: ConferenceCardProps) {
  const badge = LEVEL_BADGE[c.level] || LEVEL_BADGE["Open"];
  const bannerImageUrl = resolveConferenceBannerImage({ conference: c });
  const hasBanner = Boolean(bannerImageUrl);
  const hasLogo = Boolean(c.logoImageUrl);
  const logoFallback = c.title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "MUN";
  const statusBadgeTone =
    c.statusBadgeLabel === "Event Ended"
      ? "badge-gray"
      : c.statusBadgeLabel === "Register Now"
        ? "badge-green"
        : c.statusBadgeLabel === "Currently Registrations Closed"
          ? "badge-gold"
          : "badge-blue";

  return (
    <Link href={`/conference/${c.id}`} className="block group card rounded-[1.5rem] overflow-hidden cursor-pointer">
      {/* Card Header / Color Banner */}
      <div className={`relative h-36 ${hasBanner ? "" : `bg-gradient-to-br ${c.color}`} flex items-end p-5 overflow-hidden`}>
        {hasBanner && bannerImageUrl && (
          <Image
            src={bannerImageUrl}
            alt={`${c.title} banner`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 420px"
          />
        )}
        {hasBanner && (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.14), rgba(0,0,0,0.56))" }}
          />
        )}
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Center logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[2]">
          <div
            className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-sm font-black"
            style={{
              background: hasLogo ? "rgba(11,13,18,0.8)" : "rgba(11,13,18,0.92)",
              border: "2px solid rgba(243,237,224,0.7)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.42)",
              color: "rgba(243,237,224,0.95)",
            }}
            aria-label={`${c.title} logo`}
          >
            {hasLogo && c.logoImageUrl ? (
              <Image
                src={c.logoImageUrl}
                alt={`${c.title} logo`}
                className="w-full h-full object-cover rounded-full"
                width={64}
                height={64}
              />
            ) : (
              <span style={{ letterSpacing: "0.08em" }}>{logoFallback}</span>
            )}
          </div>
        </div>
        {/* Badges top row */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-[3]">
          <span className={`badge ${badge.class}`} style={{ background: "rgba(10,12,18,0.52)", color: "rgba(255,255,255,0.96)" }}>
            {badge.emoji} {c.level}
          </span>
          <div className="flex items-center gap-1.5">
            {c.featured && (
              <span className="badge" style={{ background: "rgba(10,12,18,0.52)", color: "rgba(255,255,255,0.96)" }}>
                ⭐ Featured
              </span>
            )}
          </div>
        </div>

        {/* Price bottom */}
        <div className="relative z-[3]">
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">From</p>
          <p className="text-white text-2xl font-black">
            {c.currency === "USD" ? "$" : c.currency === "EUR" ? "€" : c.currency === "GBP" ? "£" : "$"}{c.price}
          </p>
        </div>

        {/* region label */}
        <div className="absolute bottom-4 right-4 text-white/50 text-xs font-medium z-[3]">{c.region}</div>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3
              className="font-bold text-base leading-snug transition-colors group-hover:text-blue-600 line-clamp-2"
              style={{ color: "var(--fg)" }}
            >
              {c.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
              {c.featured && (
                <span className="badge badge-gold text-[10px] px-2 py-0.5">Featured</span>
              )}
              {c.statusBadgeLabel && (
                <span className={`badge ${statusBadgeTone} text-[10px] px-2 py-0.5`}>
                  {c.statusBadgeLabel}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
            <span className="flex items-center gap-1">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" strokeLinecap="round" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {c.city}, {c.country}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
              </svg>
              {c.startDate.split(",")[0]}
            </span>
          </div>
        </div>

        {/* Committees */}
        <div className="flex flex-wrap gap-1">
          {c.committees.slice(0, 3).map((cm) => (
            <span key={cm.id} className="badge badge-blue text-[10px] px-2 py-0.5">
              {cm.abbreviation}
            </span>
          ))}
          {c.committees.length > 3 && (
            <span className="badge badge-gray text-[10px] px-2 py-0.5">
              +{c.committees.length - 3}
            </span>
          )}
        </div>

        {/* Seats */}
        <SeatsBar registered={c.registered} capacity={c.capacity} />
      </div>
    </Link>
  );
}

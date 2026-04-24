"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConferenceCard from "@/components/ConferenceCard";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/lib/auth-context";
import { getMarketplaceConferences } from "@/lib/marketplace-conferences";

const LEVELS = ["All", "High School", "University", "Elite", "Open", "Hybrid"];
const REGIONS = ["All", "Asia", "Europe", "Americas", "Africa", "Oceania"];
const SORT_OPTIONS = [
  { value: "date", label: "Earliest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "seats", label: "Seats Remaining" },
  { value: "popularity", label: "Most Popular" },
];

function parseDate(d: string): number {
  const parsed = new Date(d).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseDayValue(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).setHours(0, 0, 0, 0);
  return Number.isNaN(parsed) ? null : parsed;
}

export default function MarketplacePage() {
  const { user, organizerConferences } = useAuth();
  const isOrganizerUser = user?.role === "organizer";
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All");
  const [region, setRegion] = useState("All");
  const [maxPrice, setMaxPrice] = useState(250);
  const [seatsMin, setSeatsMin] = useState(0);
  const [seatsMax, setSeatsMax] = useState(3000);
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [deadlineFrom, setDeadlineFrom] = useState("");
  const [deadlineTo, setDeadlineTo] = useState("");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState("date");
  const [authOpen, setAuthOpen] = useState(false);
  const [filtersOpenFor, setFiltersOpenFor] = useState<"desktop" | "mobile" | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const desktopFilterWrapRef = useRef<HTMLDivElement>(null);
  const mobileFilterWrapRef = useRef<HTMLDivElement>(null);

  const allConferences = useMemo(
    () => getMarketplaceConferences(organizerConferences),
    [organizerConferences]
  );

  const filtered = useMemo(() => {
    const normalizedSeatsMin = Math.min(seatsMin, seatsMax);
    const normalizedSeatsMax = Math.max(seatsMin, seatsMax);
    const startFromValue = parseDayValue(startDateFrom);
    const startToValue = parseDayValue(startDateTo);
    const deadlineFromValue = parseDayValue(deadlineFrom);
    const deadlineToValue = parseDayValue(deadlineTo);

    let result = allConferences.filter((c) => {
      const matchSearch =
        !search ||
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.city.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase()) ||
        c.committees.some((cm) => cm.name.toLowerCase().includes(search.toLowerCase()));
      const matchLevel = level === "All" || c.level === level;
      const matchRegion = region === "All" || c.region === region;
      const matchPrice = c.price <= maxPrice;
      const seatsRemaining = Math.max(0, c.capacity - c.registered);
      const matchSeats = seatsRemaining >= normalizedSeatsMin && seatsRemaining <= normalizedSeatsMax;

      const startValue = parseDayValue(c.startDate);
      const matchStartFrom = startFromValue === null || (startValue !== null && startValue >= startFromValue);
      const matchStartTo = startToValue === null || (startValue !== null && startValue <= startToValue);

      const deadlineValue = parseDayValue(c.registrationDeadline);
      const matchDeadlineFrom =
        deadlineFromValue === null || (deadlineValue !== null && deadlineValue >= deadlineFromValue);
      const matchDeadlineTo =
        deadlineToValue === null || (deadlineValue !== null && deadlineValue <= deadlineToValue);

      const matchFeatured = !featuredOnly || c.featured;

      return (
        matchSearch &&
        matchLevel &&
        matchRegion &&
        matchPrice &&
        matchSeats &&
        matchStartFrom &&
        matchStartTo &&
        matchDeadlineFrom &&
        matchDeadlineTo &&
        matchFeatured
      );
    });

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "date": return parseDate(a.startDate) - parseDate(b.startDate);
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "seats": return (a.capacity - a.registered) - (b.capacity - b.registered);
        case "popularity": return b.registered - a.registered;
        default: return 0;
      }
    });

    return result;
  }, [
    allConferences,
    search,
    level,
    region,
    maxPrice,
    seatsMin,
    seatsMax,
    startDateFrom,
    startDateTo,
    deadlineFrom,
    deadlineTo,
    featuredOnly,
    sort,
  ]);

  const activeFilters: string[] = [];
  if (level !== "All") activeFilters.push(level);
  if (region !== "All") activeFilters.push(region);
  if (maxPrice < 250) activeFilters.push(`≤$${maxPrice}`);
  if (seatsMin > 0 || seatsMax < 3000) activeFilters.push(`Seats ${Math.min(seatsMin, seatsMax)}-${Math.max(seatsMin, seatsMax)}`);
  if (startDateFrom || startDateTo) activeFilters.push(`Start ${startDateFrom || "Any"} to ${startDateTo || "Any"}`);
  if (deadlineFrom || deadlineTo) activeFilters.push(`Deadline ${deadlineFrom || "Any"} to ${deadlineTo || "Any"}`);
  if (featuredOnly) activeFilters.push("Featured only");

  const clearPrice = () => setMaxPrice(250);
  const clearSeats = () => {
    setSeatsMin(0);
    setSeatsMax(3000);
  };
  const clearStartDateRange = () => {
    setStartDateFrom("");
    setStartDateTo("");
  };
  const clearDeadlineRange = () => {
    setDeadlineFrom("");
    setDeadlineTo("");
  };
  const clearAll = () => {
    setLevel("All");
    setRegion("All");
    setMaxPrice(250);
    setSeatsMin(0);
    setSeatsMax(3000);
    setStartDateFrom("");
    setStartDateTo("");
    setDeadlineFrom("");
    setDeadlineTo("");
    setFeaturedOnly(false);
    setSearch("");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpenFor(null);
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!filtersOpenFor) return;
      const targetNode = event.target as Node;
      const insideDesktop = desktopFilterWrapRef.current?.contains(targetNode);
      const insideMobile = mobileFilterWrapRef.current?.contains(targetNode);
      if (!insideDesktop && !insideMobile) {
        setFiltersOpenFor(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [filtersOpenFor]);

  const renderFilterPanelContent = () => (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p
          className="text-xs font-semibold"
          style={{
            color: "var(--fg)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Filters
        </p>
        <div className="flex items-center gap-3">
          {activeFilters.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[11px] font-semibold"
              style={{ color: "var(--accent-warm)", letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              Clear all
            </button>
          )}
          <button
            onClick={() => setFiltersOpenFor(null)}
            className="text-sm"
            style={{ color: "var(--fg-muted)" }}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p
              className="text-[10px] font-semibold"
              style={{ color: "var(--fg-muted)", letterSpacing: "0.24em", textTransform: "uppercase" }}
            >
              Level
            </p>
            {level !== "All" && (
              <button onClick={() => setLevel("All")} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
            )}
          </div>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="lux-select text-xs"
          >
            {LEVELS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p
              className="text-[10px] font-semibold"
              style={{ color: "var(--fg-muted)", letterSpacing: "0.24em", textTransform: "uppercase" }}
            >
              Region
            </p>
            {region !== "All" && (
              <button onClick={() => setRegion("All")} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
            )}
          </div>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="lux-select text-xs"
          >
            {REGIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p
            className="text-[10px] font-semibold"
            style={{ color: "var(--fg-muted)", letterSpacing: "0.24em", textTransform: "uppercase" }}
          >
            Max Price <span style={{ color: "var(--accent-warm)" }}>${maxPrice}</span>
          </p>
          {maxPrice < 250 && (
            <button onClick={clearPrice} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={250}
          step={10}
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          className="w-full"
          style={{ accentColor: "var(--accent-warm)" }}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          <span>$0</span><span>$250+</span>
        </div>
      </div>

      <div
        className="flex items-center justify-between rounded-xl p-3"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
      >
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(event) => setFeaturedOnly(event.target.checked)}
            style={{ accentColor: "var(--accent-warm)" }}
          />
          Featured only
        </label>
        {featuredOnly && (
          <button onClick={() => setFeaturedOnly(false)} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
        )}
      </div>

      <div>
        <button
          onClick={() => setMoreFiltersOpen((prev) => !prev)}
          className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            color: "var(--fg)",
          }}
        >
          <span>More filters</span>
          <span
            className="inline-block transition-transform duration-200"
            style={{ color: "var(--fg-muted)", transform: moreFiltersOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            ⌄
          </span>
        </button>

        {moreFiltersOpen && (
          <div className="mt-3 space-y-3">
            <div
              className="rounded-xl p-3"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: "var(--fg-muted)", letterSpacing: "0.24em", textTransform: "uppercase" }}
                >
                  Availability
                </p>
                {(seatsMin > 0 || seatsMax < 3000) && (
                  <button onClick={clearSeats} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={seatsMin}
                  onChange={(event) => setSeatsMin(Math.max(0, Number(event.target.value) || 0))}
                  className="lux-input text-xs"
                  placeholder="Min seats"
                />
                <input
                  type="number"
                  min={0}
                  value={seatsMax}
                  onChange={(event) => setSeatsMax(Math.max(0, Number(event.target.value) || 0))}
                  className="lux-input text-xs"
                  placeholder="Max seats"
                />
              </div>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: "var(--fg-muted)", letterSpacing: "0.24em", textTransform: "uppercase" }}
                >
                  Conference dates
                </p>
                {(startDateFrom || startDateTo) && (
                  <button onClick={clearStartDateRange} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={startDateFrom} onChange={(event) => setStartDateFrom(event.target.value)} className="lux-input text-xs" />
                <input type="date" value={startDateTo} onChange={(event) => setStartDateTo(event.target.value)} className="lux-input text-xs" />
              </div>
            </div>

            <div
              className="rounded-xl p-3"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between mb-2">
                <p
                  className="text-[10px] font-semibold"
                  style={{ color: "var(--fg-muted)", letterSpacing: "0.24em", textTransform: "uppercase" }}
                >
                  Registration deadline
                </p>
                {(deadlineFrom || deadlineTo) && (
                  <button onClick={clearDeadlineRange} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={deadlineFrom} onChange={(event) => setDeadlineFrom(event.target.value)} className="lux-input text-xs" />
                <input type="date" value={deadlineTo} onChange={(event) => setDeadlineTo(event.target.value)} className="lux-input text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDesktopFilterPopover = () => (
    <div className="absolute right-0 top-full mt-2 w-[380px] z-[70] pointer-events-auto">
      <div
        className="lux-card animate-slide-down"
        style={{
          background: "color-mix(in srgb, var(--bg) 94%, transparent 6%)",
          border: "1px solid var(--border)",
          backdropFilter: "blur(10px) saturate(112%)",
          WebkitBackdropFilter: "blur(10px) saturate(112%)",
        }}
      >
        {renderFilterPanelContent()}
      </div>
    </div>
  );

  const renderMobileFilterOverlay = () => (
    <div className="sm:hidden fixed inset-0 z-[80]">
      <button
        type="button"
        onClick={() => setFiltersOpenFor(null)}
        className="absolute inset-0"
        style={{ background: "color-mix(in srgb, var(--fg) 26%, transparent 74%)" }}
        aria-label="Close filters overlay"
      />
      <div className="relative h-full px-4 pt-24 pb-6">
        <div
          ref={mobileFilterWrapRef}
          className="lux-card animate-slide-down max-h-[75vh] overflow-y-auto overscroll-contain"
          style={{
            background: "color-mix(in srgb, var(--bg) 94%, transparent 6%)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(10px) saturate(112%)",
            WebkitBackdropFilter: "blur(10px) saturate(112%)",
          }}
        >
          {renderFilterPanelContent()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Page Header */}
      <section className="relative lux-section pt-36 pb-14 px-6">
        <div className="max-w-7xl mx-auto">
          <span className="lux-pill">
            <span className="lux-pill-dot" />
            Global Marketplace
          </span>
          <h1
            className="lux-display mt-8 max-w-4xl"
            style={{ color: "var(--fg)" }}
          >
            Find your next{" "}
            <span
              style={{
                background: "linear-gradient(120deg, #e7c390 10%, #f4e2c6 50%, #b28b57 90%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              conference
            </span>
            .
          </h1>
          <p className="lux-subdisplay mt-6 max-w-2xl">
            {allConferences.length} conferences available worldwide — filter by level,
            region, budget, and dates to find your perfect match.
          </p>
          {isOrganizerUser && (
            <p className="mt-4 text-sm" style={{ color: "var(--fg-muted)" }}>
              Organizer accounts can browse and view conferences, but registration is disabled.
            </p>
          )}

          <div className="mt-10 flex flex-col gap-3">
            <div
              className="flex items-center gap-3 max-w-2xl rounded-2xl overflow-hidden"
              style={{
                background: "color-mix(in srgb, var(--bg) 86%, transparent 14%)",
                border: "1px solid var(--border)",
                backdropFilter: "blur(14px) saturate(118%)",
                WebkitBackdropFilter: "blur(14px) saturate(118%)",
              }}
            >
              <svg
                className="ml-5 flex-shrink-0"
                width="18"
                height="18"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: "var(--fg-muted)" }}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search by conference name, city, country, or committee..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="flex-1 py-4 pr-4 bg-transparent outline-none text-sm"
                style={{ color: "var(--fg)" }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="mr-3 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                  style={{
                    background: "var(--bg-subtle)",
                    color: "var(--fg-muted)",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="sm:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpenFor((prev) => (prev === "mobile" ? null : "mobile"))}
                className="lux-button-ghost text-sm w-full justify-center gap-2"
                style={{ padding: "12px 18px", color: "var(--fg)", borderColor: "var(--border)", background: "var(--bg-subtle)" }}
              >
                <span>Filters</span>
                {activeFilters.length > 0 && (
                  <span className="badge badge-blue text-[11px] px-2 py-0.5">{activeFilters.length}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative lux-section max-w-7xl mx-auto px-6 py-16">
        <div className="space-y-8">
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilters.map((value) => (
                <span
                  key={value}
                  className="lux-chip lux-chip-active"
                  style={{ cursor: "default" }}
                >
                  {value}
                </span>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold ml-2"
                style={{
                  color: "var(--accent-warm)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Clear all
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
              <span
                className="font-semibold"
                style={{ color: "var(--fg)" }}
              >
                {filtered.length}
              </span>{" "}
              conferences found
            </p>
            <div className="flex items-center gap-2">
              <div ref={desktopFilterWrapRef} className="hidden sm:block relative">
                <button
                  type="button"
                  onClick={() => setFiltersOpenFor((prev) => (prev === "desktop" ? null : "desktop"))}
                  className="lux-button-ghost text-sm gap-2"
                  style={{
                    padding: "10px 18px",
                    color: "var(--fg)",
                    borderColor: "var(--border)",
                    background: "var(--bg-subtle)",
                  }}
                >
                  <span>Filters</span>
                  {activeFilters.length > 0 && (
                    <span className="badge badge-blue text-[11px] px-2 py-0.5">{activeFilters.length}</span>
                  )}
                </button>
                {filtersOpenFor === "desktop" && renderDesktopFilterPopover()}
              </div>
              <span className="text-xs tracking-[0.22em] uppercase" style={{ color: "var(--fg-muted)" }}>
                Sort
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="lux-select text-sm"
                style={{ width: "auto", padding: "10px 36px 10px 14px" }}
              >
                {SORT_OPTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((conference) => (
                <ConferenceCard key={conference.id} conference={conference} />
              ))}
            </div>
          ) : (
            <div
              className="lux-card py-24 text-center"
              style={{ borderStyle: "dashed" }}
            >
              <p
                className="lux-eyebrow"
                style={{ color: "var(--fg-muted)" }}
              >
                Nothing matches
              </p>
              <p
                className="mt-4 text-2xl font-semibold"
                style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}
              >
                No conferences found
              </p>
              <p
                className="mt-3 max-w-md mx-auto"
                style={{ color: "var(--fg-muted)" }}
              >
                Try adjusting your filters or search term to broaden the horizon.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="lux-button-primary text-sm mt-8"
                style={{ padding: "12px 22px" }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </section>

      {filtersOpenFor === "mobile" && renderMobileFilterOverlay()}

      <Footer />
    </div>
  );
}

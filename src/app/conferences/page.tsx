"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConferenceCard from "@/components/ConferenceCard";
import AuthModal from "@/components/AuthModal";
import type { Conference } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

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
  const { user } = useAuth();
  const isOrganizerUser = user?.role === "organizer";
  const [catalog, setCatalog] = useState<Conference[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [level, setLevel] = useState("All");
  const [region, setRegion] = useState("All");
  const [freeOnly, setFreeOnly] = useState(false);
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

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch("/api/marketplace", { signal });
      if (!res.ok) {
        throw new Error("Could not load conferences catalog.");
      }
      const data = (await res.json()) as { conferences?: Conference[] };
      if (Array.isArray(data.conferences)) {
        setCatalog(data.conferences);
      } else {
        setCatalog([]);
      }
    } catch (error) {
      if (signal?.aborted) return;
      setCatalog([]);
      setCatalogError(
        error instanceof Error ? error.message : "Could not load conferences catalog."
      );
    } finally {
      if (!signal?.aborted) setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(controller.signal);
    return () => controller.abort();
  }, [catalogReloadKey, loadCatalog]);

  const allConferences = catalog;
  const indexedConferences = useMemo(
    () =>
      allConferences.map((conference) => ({
        conference,
        searchText: [
          conference.title,
          conference.city,
          conference.country,
          ...conference.committees.map((committee) => committee.name),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [allConferences]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(search.trim().toLowerCase());
    }, 180);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filtered = useMemo(() => {
    const normalizedSeatsMin = Math.min(seatsMin, seatsMax);
    const normalizedSeatsMax = Math.max(seatsMin, seatsMax);
    const startFromValue = parseDayValue(startDateFrom);
    const startToValue = parseDayValue(startDateTo);
    const deadlineFromValue = parseDayValue(deadlineFrom);
    const deadlineToValue = parseDayValue(deadlineTo);

    let result = indexedConferences
      .filter(({ conference: c, searchText }) => {
      const matchSearch =
        !searchQuery || searchText.includes(searchQuery);
      const matchLevel = level === "All" || c.level === level;
      const matchRegion = region === "All" || c.region === region;
      const matchPrice = !freeOnly || c.price === 0;
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
      })
      .map(({ conference }) => conference);

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
    indexedConferences,
    searchQuery,
    level,
    region,
    freeOnly,
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
  if (freeOnly) activeFilters.push("Free only");
  if (seatsMin > 0 || seatsMax < 3000) activeFilters.push(`Seats ${Math.min(seatsMin, seatsMax)}-${Math.max(seatsMin, seatsMax)}`);
  if (startDateFrom || startDateTo) activeFilters.push(`Start ${startDateFrom || "Any"} to ${startDateTo || "Any"}`);
  if (deadlineFrom || deadlineTo) activeFilters.push(`Deadline ${deadlineFrom || "Any"} to ${deadlineTo || "Any"}`);
  if (featuredOnly) activeFilters.push("Featured only");

  const clearPrice = () => setFreeOnly(false);
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
    setFreeOnly(false);
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

  useEffect(() => {
    if (filtersOpenFor !== "mobile") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
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

      <div
        className="flex items-center justify-between rounded-xl p-3"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
      >
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(event) => setFreeOnly(event.target.checked)}
            style={{ accentColor: "var(--accent-warm)" }}
          />
          Free conferences only
        </label>
        {freeOnly && (
          <button onClick={clearPrice} className="text-[11px]" style={{ color: "var(--accent-warm)" }}>Clear</button>
        )}
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
      <div className="relative h-full px-4 pt-[calc(5.5rem+env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] flex flex-col">
        <div
          ref={mobileFilterWrapRef}
          className="lux-card animate-slide-down flex flex-col flex-1 min-h-0 max-h-[min(85vh,calc(100dvh-6rem))] overflow-hidden touch-manipulation"
          style={{
            background: "color-mix(in srgb, var(--bg) 94%, transparent 6%)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(10px) saturate(112%)",
            WebkitBackdropFilter: "blur(10px) saturate(112%)",
          }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {renderFilterPanelContent()}
          </div>
          <div
            className="flex-shrink-0 flex gap-2 p-4 border-t"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          >
            <button
              type="button"
              className="btn btn-primary flex-1 min-h-[48px] touch-manipulation"
              onClick={() => setFiltersOpenFor(null)}
            >
              Apply
            </button>
            <button
              type="button"
              className="btn btn-ghost flex-1 min-h-[48px] touch-manipulation"
              onClick={() => {
                clearAll();
                setFiltersOpenFor(null);
              }}
            >
              Clear all
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="marketplace-page min-h-[100dvh]" style={{ background: "var(--bg)", color: "var(--fg)" }}>

      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Page Header */}
      <section className="relative lux-section pt-[calc(9rem+env(safe-area-inset-top,0px))] pb-8 sm:pb-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <span className="lux-pill">
            <span className="lux-pill-dot" />
            Conferences
          </span>
          <h1
            className="lux-display mt-8 max-w-4xl"
            style={{ color: "var(--fg)" }}
          >
            Find your next{" "}
            <span className="text-gradient">
              conference
            </span>
            .
          </h1>
          <p className="lux-subdisplay mt-6 max-w-2xl">
            {catalogLoading
              ? "Loading published conferences…"
              : `${allConferences.length} conference${allConferences.length === 1 ? "" : "s"} published — filter by level, region, budget, and dates to find your match.`}
          </p>
          {isOrganizerUser && (
            <p className="mt-4 text-sm" style={{ color: "var(--fg-muted)" }}>
              Organizer accounts can browse and view conferences, but registration is disabled.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <div
              className="marketplace-search-shell flex items-center gap-3 max-w-2xl rounded-2xl overflow-hidden"
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
                className="marketplace-search-input flex-1 py-4 pr-4 bg-transparent outline-none text-sm"
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
                className="lux-button-ghost text-sm w-full justify-center gap-2 min-h-[48px] touch-manipulation inline-flex items-center"
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

      <section className="relative lux-section max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="space-y-6">
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
              <div className="marketplace-sort-wrap">
                <span className="marketplace-sort-label">Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="marketplace-sort-select"
                >
                  {SORT_OPTIONS.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {catalogLoading ? (
            <div className="lux-card py-24 text-center" style={{ borderStyle: "dashed" }}>
              <p className="lux-eyebrow" style={{ color: "var(--fg-muted)" }}>
                Loading
              </p>
              <p className="mt-4 text-lg font-medium" style={{ color: "var(--fg)" }}>
                Fetching published conferences…
              </p>
            </div>
          ) : catalogError ? (
            <div className="lux-card py-24 text-center" style={{ borderStyle: "dashed" }}>
              <p className="lux-eyebrow" style={{ color: "var(--fg-muted)" }}>
                Could not load catalog
              </p>
              <p className="mt-4 text-2xl font-semibold" style={{ color: "var(--fg)" }}>
                Something went wrong
              </p>
              <p className="mt-3 max-w-md mx-auto" style={{ color: "var(--fg-muted)" }}>
                {catalogError}
              </p>
              <button
                type="button"
                onClick={() => setCatalogReloadKey((key) => key + 1)}
                className="lux-button-primary text-sm mt-8"
                style={{ padding: "12px 22px" }}
              >
                Try again
              </button>
            </div>
          ) : filtered.length > 0 ? (
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
                {allConferences.length === 0 ? "No published conferences yet" : "Nothing matches"}
              </p>
              <p
                className="mt-4 text-2xl font-semibold"
                style={{ color: "var(--fg)", letterSpacing: "-0.02em" }}
              >
                {allConferences.length === 0 ? "Nothing listed yet" : "No conferences found"}
              </p>
              <p
                className="mt-3 max-w-md mx-auto"
                style={{ color: "var(--fg-muted)" }}
              >
                {allConferences.length === 0
                  ? "Organizers will appear here once they publish an event."
                  : "Try adjusting your filters or search term to broaden the horizon."}
              </p>
              {allConferences.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="lux-button-primary text-sm mt-8"
                  style={{ padding: "12px 22px" }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {filtersOpenFor === "mobile" && renderMobileFilterOverlay()}

      <Footer />
    </div>
  );
}

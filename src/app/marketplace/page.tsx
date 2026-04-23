"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConferenceCard from "@/components/ConferenceCard";
import AuthModal from "@/components/AuthModal";
import { CONFERENCES } from "@/lib/data";
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

  const filtered = useMemo(() => {
    const normalizedSeatsMin = Math.min(seatsMin, seatsMax);
    const normalizedSeatsMax = Math.max(seatsMin, seatsMax);
    const startFromValue = parseDayValue(startDateFrom);
    const startToValue = parseDayValue(startDateTo);
    const deadlineFromValue = parseDayValue(deadlineFrom);
    const deadlineToValue = parseDayValue(deadlineTo);

    let result = CONFERENCES.filter((c) => {
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

  const renderFilterPanel = (isMobile: boolean) => (
    <div
      className={`rounded-2xl p-4 space-y-4 animate-slide-down ${
        isMobile ? "w-full" : "absolute right-0 top-full mt-2 w-[360px] z-40"
      }`}
      style={{
        background: "var(--bg)",
        border: "1.5px solid var(--border)",
        boxShadow: "var(--card-shadow)",
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>Filters</p>
        <div className="flex items-center gap-3">
          {activeFilters.length > 0 && (
            <button onClick={clearAll} className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
              Clear all
            </button>
          )}
          <button
            onClick={() => setFiltersOpenFor(null)}
            className="text-xs"
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
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>Level</p>
            {level !== "All" && (
              <button onClick={() => setLevel("All")} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
            )}
          </div>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="input-base text-xs"
          >
            {LEVELS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>Region</p>
            {region !== "All" && (
              <button onClick={() => setRegion("All")} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
            )}
          </div>
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="input-base text-xs"
          >
            {REGIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
            Max Price: <span style={{ color: "var(--blue)" }}>${maxPrice}</span>
          </p>
          {maxPrice < 250 && (
            <button onClick={clearPrice} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
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
          style={{ accentColor: "var(--blue)" }}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          <span>$0</span><span>$250+</span>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--fg)" }}>
          <input
            type="checkbox"
            checked={featuredOnly}
            onChange={(event) => setFeaturedOnly(event.target.checked)}
          />
          Featured only
        </label>
        {featuredOnly && (
          <button onClick={() => setFeaturedOnly(false)} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
        )}
      </div>

      <div>
        <button
          onClick={() => setMoreFiltersOpen((prev) => !prev)}
          className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--bg-subtle)", color: "var(--fg)" }}
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
            <div className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                  Availability
                </p>
                {(seatsMin > 0 || seatsMax < 3000) && (
                  <button onClick={clearSeats} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={seatsMin}
                  onChange={(event) => setSeatsMin(Math.max(0, Number(event.target.value) || 0))}
                  className="input-base text-xs"
                  placeholder="Min seats"
                />
                <input
                  type="number"
                  min={0}
                  value={seatsMax}
                  onChange={(event) => setSeatsMax(Math.max(0, Number(event.target.value) || 0))}
                  className="input-base text-xs"
                  placeholder="Max seats"
                />
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                  Conference dates
                </p>
                {(startDateFrom || startDateTo) && (
                  <button onClick={clearStartDateRange} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={startDateFrom} onChange={(event) => setStartDateFrom(event.target.value)} className="input-base text-xs" />
                <input type="date" value={startDateTo} onChange={(event) => setStartDateTo(event.target.value)} className="input-base text-xs" />
              </div>
            </div>

            <div className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--fg-muted)" }}>
                  Registration deadline
                </p>
                {(deadlineFrom || deadlineTo) && (
                  <button onClick={clearDeadlineRange} className="text-[11px]" style={{ color: "var(--blue)" }}>Clear</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={deadlineFrom} onChange={(event) => setDeadlineFrom(event.target.value)} className="input-base text-xs" />
                <input type="date" value={deadlineTo} onChange={(event) => setDeadlineTo(event.target.value)} className="input-base text-xs" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Page Header */}
      <div
        className="pt-28 pb-12 px-6"
        style={{
          background: "linear-gradient(180deg, var(--blue-subtle) 0%, var(--bg) 100%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="section-label mb-4">Global Marketplace</div>
          <h1 className="text-4xl font-black tracking-tight mb-3" style={{ color: "var(--fg)" }}>
            Find your next <span className="text-gradient">Conference</span>
          </h1>
          <p className="text-base" style={{ color: "var(--fg-muted)" }}>
            {CONFERENCES.length} conferences available worldwide — filter to find your perfect match.
          </p>
          {isOrganizerUser && (
            <p className="text-sm mt-3" style={{ color: "var(--fg-muted)" }}>
              Organizer accounts can browse and view conferences, but registration is disabled.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <div
              className="flex items-center gap-3 max-w-2xl rounded-2xl overflow-hidden"
              style={{
                background: "var(--bg)",
                border: "1.5px solid var(--border-strong)",
                boxShadow: "var(--card-shadow)",
              }}
            >
              <svg className="ml-5 flex-shrink-0" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ color: "var(--fg-muted)" }}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
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
                  onClick={() => setSearch("")}
                  className="mr-3 w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                  style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)" }}
                >
                  ✕
                </button>
              )}
            </div>

            <div ref={mobileFilterWrapRef} className="sm:hidden relative">
              <button
                onClick={() => setFiltersOpenFor((prev) => (prev === "mobile" ? null : "mobile"))}
                className="btn btn-ghost text-sm w-full justify-center gap-2"
                style={{ border: "1.5px solid var(--border)" }}
              >
                <span>Filters</span>
                {activeFilters.length > 0 && (
                  <span className="badge badge-blue text-[11px] px-2 py-0.5">{activeFilters.length}</span>
                )}
              </button>
              {filtersOpenFor === "mobile" && (
                <div className="mt-2">
                  {renderFilterPanel(true)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="space-y-6">
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((value) => (
                <span key={value} className="badge badge-blue">{value}</span>
              ))}
              <button onClick={clearAll} className="text-xs font-semibold ml-1" style={{ color: "var(--blue)" }}>
                Clear all
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium" style={{ color: "var(--fg-muted)" }}>
              <span className="font-bold" style={{ color: "var(--fg)" }}>{filtered.length}</span> conferences found
            </p>
            <div className="flex items-center gap-2">
              <div ref={desktopFilterWrapRef} className="hidden sm:block relative">
                <button
                  onClick={() => setFiltersOpenFor((prev) => (prev === "desktop" ? null : "desktop"))}
                  className="btn btn-ghost text-sm gap-2"
                  style={{ border: "1.5px solid var(--border)" }}
                >
                  <span>Filters</span>
                  {activeFilters.length > 0 && (
                    <span className="badge badge-blue text-[11px] px-2 py-0.5">{activeFilters.length}</span>
                  )}
                </button>
                {filtersOpenFor === "desktop" && renderFilterPanel(false)}
              </div>
              <span className="text-sm" style={{ color: "var(--fg-muted)" }}>Sort:</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="input-base text-sm"
                style={{ width: "auto", padding: "8px 12px", borderRadius: "10px" }}
              >
                {SORT_OPTIONS.map((entry) => (
                  <option key={entry.value} value={entry.value}>{entry.label}</option>
                ))}
              </select>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((conference) => (
                <ConferenceCard key={conference.id} conference={conference} />
              ))}
            </div>
          ) : (
            <div
              className="py-24 text-center rounded-3xl"
              style={{ border: "2px dashed var(--border)" }}
            >
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-bold text-lg mb-2" style={{ color: "var(--fg)" }}>No conferences found</p>
              <p className="text-sm mb-4" style={{ color: "var(--fg-muted)" }}>Try adjusting your filters or search term</p>
              <button onClick={clearAll} className="btn btn-primary text-sm">Clear Filters</button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

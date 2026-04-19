"use client";

import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ConferenceCard from "@/components/ConferenceCard";
import AuthModal from "@/components/AuthModal";
import { CONFERENCES } from "@/lib/data";

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
  return new Date(d).getTime() || 0;
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("All");
  const [region, setRegion] = useState("All");
  const [maxPrice, setMaxPrice] = useState(250);
  const [sort, setSort] = useState("date");
  const [authOpen, setAuthOpen] = useState(false);

  const filtered = useMemo(() => {
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
      return matchSearch && matchLevel && matchRegion && matchPrice;
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
  }, [search, level, region, maxPrice, sort]);

  const activeFilters: string[] = [];
  if (level !== "All") activeFilters.push(level);
  if (region !== "All") activeFilters.push(region);
  if (maxPrice < 250) activeFilters.push(`≤$${maxPrice}`);

  const clearAll = () => { setLevel("All"); setRegion("All"); setMaxPrice(250); setSearch(""); };

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

          {/* Search bar */}
          <div
            className="mt-6 flex items-center gap-3 max-w-2xl rounded-2xl overflow-hidden"
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
              onChange={(e) => setSearch(e.target.value)}
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
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm" style={{ color: "var(--fg)" }}>Filters</h3>
                {activeFilters.length > 0 && (
                  <button onClick={clearAll} className="text-xs font-semibold" style={{ color: "var(--blue)" }}>
                    Clear all
                  </button>
                )}
              </div>

              {/* Active filter chips */}
              {activeFilters.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((f) => (
                    <span key={f} className="badge badge-blue">{f}</span>
                  ))}
                </div>
              )}

              {/* Level */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--fg-muted)" }}>Level</p>
                <div className="space-y-1">
                  {LEVELS.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLevel(l)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: level === l ? "var(--blue-subtle)" : "transparent",
                        color: level === l ? "var(--blue)" : "var(--fg-muted)",
                        fontWeight: level === l ? 700 : 500,
                      }}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Region */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--fg-muted)" }}>Region</p>
                <div className="space-y-1">
                  {REGIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRegion(r)}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: region === r ? "var(--blue-subtle)" : "transparent",
                        color: region === r ? "var(--blue)" : "var(--fg-muted)",
                        fontWeight: region === r ? 700 : 500,
                      }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Price */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--fg-muted)" }}>
                  Max Price: <span style={{ color: "var(--blue)" }}>${maxPrice}</span>
                </p>
                <input
                  type="range"
                  min={0}
                  max={250}
                  step={10}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: "var(--blue)" }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                  <span>$0</span><span>$250+</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-medium" style={{ color: "var(--fg-muted)" }}>
                <span className="font-bold" style={{ color: "var(--fg)" }}>{filtered.length}</span> conferences found
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--fg-muted)" }}>Sort:</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="input-base text-sm"
                  style={{ width: "auto", padding: "8px 12px", borderRadius: "10px" }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {filtered.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map((c) => (
                  <ConferenceCard key={c.id} conference={c} />
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
      </div>

      <Footer />
    </>
  );
}

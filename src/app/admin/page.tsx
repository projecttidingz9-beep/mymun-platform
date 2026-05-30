"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import AdminEventsTable from "@/components/admin/AdminEventsTable";
import AdminOverview from "@/components/admin/AdminOverview";
import ReviewQueue from "@/components/admin/ReviewQueue";
import type { AdminSection, AdminStatsPayload } from "@/components/admin/types";

export default function AdminDashboardPage() {
  const [section, setSection] = useState<AdminSection>("review");
  const [pendingCount, setPendingCount] = useState(0);
  const [stats, setStats] = useState<AdminStatsPayload | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/stats", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setStatsError(res.status === 403 ? "Access denied." : "Failed to load stats.");
        setStats(null);
        return;
      }
      const data = (await res.json()) as AdminStatsPayload;
      setStats(data);
      setPendingCount(data.eventsByStatus.REVIEW ?? 0);
    } catch {
      setStatsError("Failed to load stats.");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const handlePendingCountChange = useCallback((count: number) => {
    setPendingCount(count);
    void loadStats();
  }, [loadStats]);

  return (
    <AdminShell
      section={section}
      onSectionChange={setSection}
      pendingCount={pendingCount}
    >
      {section === "review" && (
        <ReviewQueue onPendingCountChange={handlePendingCountChange} />
      )}
      {section === "overview" && (
        <AdminOverview stats={stats} loading={statsLoading} error={statsError} />
      )}
      {section === "events" && <AdminEventsTable />}
    </AdminShell>
  );
}

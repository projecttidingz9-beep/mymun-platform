"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoggedIn, authReady, notifications, markNotificationRead } = useAuth();
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) router.push("/");
  }, [authReady, isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    void ensureServerSession();
  }, [isLoggedIn, user]);

  if (!authReady || !isLoggedIn || !user) {
    return <AppRouteSkeleton />;
  }

  const myNotifications = notifications.filter(
    (notification) =>
      (!notification.userEmail || notification.userEmail === user.email) &&
      (!notification.userId || notification.userId === user.id)
  );

  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-4xl mx-auto">
          <header className="app-header">
            <div className="app-header-copy">
              <div className="section-label mb-3">Updates</div>
              <h1 className="app-title">Notification Center</h1>
              <p className="app-subtitle mt-2">
                Stay on top of applications, payments, and conference updates.
              </p>
            </div>
          </header>

          <div className="app-card">
            {myNotifications.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No notifications yet.</p>
            ) : (
              <div className="space-y-3">
                {myNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 rounded-xl"
                    style={{
                      background: "var(--bg)",
                      border: "1.5px solid var(--border)",
                      opacity: notification.read ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                          {notification.title}
                        </p>
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                          {notification.message}
                        </p>
                        <p className="text-[11px] mt-2" style={{ color: "var(--fg-muted)" }}>
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <button
                          onClick={() => {
                            if (markingReadId) return;
                            setMarkingReadId(notification.id);
                            markNotificationRead(notification.id);
                            window.setTimeout(() => setMarkingReadId(null), 400);
                          }}
                          disabled={markingReadId === notification.id}
                          className="btn btn-ghost text-xs"
                        >
                          {markingReadId === notification.id ? "Saving…" : "Mark read"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

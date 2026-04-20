"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ensureServerSession } from "@/lib/client/session";
import { useAuth } from "@/lib/auth-context";

export default function NotificationsPage() {
  const router = useRouter();
  const { user, isLoggedIn, notifications, markNotificationRead } = useAuth();

  useEffect(() => {
    if (!isLoggedIn) router.push("/");
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    void ensureServerSession({ email: user.email, role: "delegate", name: user.name });
  }, [isLoggedIn, user]);

  if (!isLoggedIn || !user) return null;

  const myNotifications = notifications.filter(
    (notification) =>
      (!notification.userEmail || notification.userEmail === user.email) &&
      (!notification.userId || notification.userId === user.id)
  );

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--bg-subtle)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="section-label mb-3">Updates</div>
            <h1 className="text-3xl font-black" style={{ color: "var(--fg)" }}>Notification Center</h1>
          </div>

          <div className="card p-6 rounded-2xl">
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
                          onClick={() => markNotificationRead(notification.id)}
                          className="btn btn-ghost text-xs"
                        >
                          Mark read
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

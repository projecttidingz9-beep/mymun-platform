"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import { OrganizerConference } from "@/lib/types";

const STATUS_STYLES: Record<OrganizerConference["status"], string> = {
  Draft: "badge-gray",
  Review: "badge-gold",
  Published: "badge-green",
};

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const {
    user,
    isLoggedIn,
    organizerConferences,
    updateOrganizerConferenceStatus,
    updateApplicantStatus,
    toggleApplicantPayment,
    addAnnouncement,
  } = useAuth();

  const [selectedConferenceId, setSelectedConferenceId] = useState<string>("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/organizers");
    }
  }, [isLoggedIn, router]);

  useEffect(() => {
    if (!selectedConferenceId && organizerConferences.length > 0) {
      setSelectedConferenceId(organizerConferences[0].id);
    }
  }, [organizerConferences, selectedConferenceId]);

  const selectedConference = useMemo(
    () => organizerConferences.find((conference) => conference.id === selectedConferenceId),
    [organizerConferences, selectedConferenceId]
  );

  if (!isLoggedIn || !user) return null;

  const totalApplicants = organizerConferences.reduce((acc, conference) => acc + conference.applicants.length, 0);
  const totalAccepted = organizerConferences.reduce(
    (acc, conference) => acc + conference.applicants.filter((applicant) => applicant.status === "Accepted").length,
    0
  );
  const totalRevenue = organizerConferences.reduce((acc, conference) => {
    const paidDelegates = conference.applicants.filter((applicant) => applicant.paid).length;
    return acc + paidDelegates * conference.registrationFee;
  }, 0);

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--bg-subtle)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="section-label mb-3">Organizer Control Center</div>
              <h1 className="text-4xl font-black" style={{ color: "var(--fg)" }}>
                {user.name.split(" ")[0]}'s Organizer Dashboard
              </h1>
              <p className="text-base mt-1" style={{ color: "var(--fg-muted)" }}>
                Manage your conferences, delegate applications, and communications from one place.
              </p>
            </div>
            <Link href="/organizers" className="btn btn-primary text-sm">
              + Create New Conference
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Active Conferences", value: organizerConferences.length, icon: "🏛️", color: "#2563eb" },
              { label: "Total Applicants", value: totalApplicants, icon: "🧾", color: "#7c3aed" },
              { label: "Accepted Delegates", value: totalAccepted, icon: "✅", color: "#16a34a" },
              { label: "Collected Revenue", value: `$${totalRevenue}`, icon: "💰", color: "#d97706" },
            ].map((stat) => (
              <div key={stat.label} className="card p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <div className="w-2 h-2 rounded-full" style={{ background: stat.color }} />
                </div>
                <p className="text-3xl font-black" style={{ color: "var(--fg)" }}>{stat.value}</p>
                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Your Conferences</h2>
              {organizerConferences.map((conference) => (
                <button
                  key={conference.id}
                  onClick={() => setSelectedConferenceId(conference.id)}
                  className="card p-5 rounded-2xl w-full text-left"
                  style={{
                    border: selectedConferenceId === conference.id ? "2px solid var(--blue)" : "1.5px solid var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm" style={{ color: "var(--fg)" }}>{conference.title}</h3>
                    <span className={`badge ${STATUS_STYLES[conference.status]}`}>{conference.status}</span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                    {conference.city}, {conference.country} · {conference.level}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                    {conference.applicants.length} applicants · {conference.capacity} capacity
                  </p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-8 space-y-6">
              {!selectedConference ? (
                <div className="card p-8 rounded-2xl text-sm" style={{ color: "var(--fg-muted)" }}>
                  Select a conference to manage operations.
                </div>
              ) : (
                <>
                  <div className="card p-6 rounded-2xl">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
                      <h2 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
                        {selectedConference.title}
                      </h2>
                      <div className="flex gap-2">
                        {(["Draft", "Review", "Published"] as OrganizerConference["status"][]).map((status) => (
                          <button
                            key={status}
                            onClick={() => updateOrganizerConferenceStatus(selectedConference.id, status)}
                            className="btn btn-ghost text-xs"
                            style={{
                              background: selectedConference.status === status ? "var(--blue-subtle)" : "var(--bg-subtle)",
                              borderColor: selectedConference.status === status ? "var(--blue)" : "var(--border)",
                              color: selectedConference.status === status ? "var(--blue)" : "var(--fg-muted)",
                            }}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <p style={{ color: "var(--fg-muted)" }}><strong style={{ color: "var(--fg)" }}>Dates:</strong> {selectedConference.startDate} → {selectedConference.endDate}</p>
                      <p style={{ color: "var(--fg-muted)" }}><strong style={{ color: "var(--fg)" }}>Fee:</strong> ${selectedConference.registrationFee}</p>
                      <p style={{ color: "var(--fg-muted)" }}><strong style={{ color: "var(--fg)" }}>Capacity:</strong> {selectedConference.capacity}</p>
                    </div>
                  </div>

                  <div className="card p-6 rounded-2xl">
                    <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Applications</h3>
                    {selectedConference.applicants.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No applications yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedConference.applicants.map((applicant) => (
                          <div
                            key={applicant.id}
                            className="p-4 rounded-xl"
                            style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}
                          >
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{applicant.name}</p>
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{applicant.school}</p>
                                <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                                  {applicant.countryPreference} · {applicant.committeePreference}
                                </p>
                              </div>
                              <span className={`badge ${
                                applicant.status === "Accepted"
                                  ? "badge-green"
                                  : applicant.status === "Rejected"
                                    ? "badge-gray"
                                    : applicant.status === "Waitlisted"
                                      ? "badge-gold"
                                      : "badge-blue"
                              }`}>
                                {applicant.status}
                              </span>
                            </div>
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {(["Accepted", "Waitlisted", "Rejected"] as const).map((status) => (
                                <button
                                  key={status}
                                  onClick={() => updateApplicantStatus(selectedConference.id, applicant.id, status)}
                                  className="btn btn-ghost text-xs"
                                >
                                  Mark {status}
                                </button>
                              ))}
                              <button
                                onClick={() => toggleApplicantPayment(selectedConference.id, applicant.id)}
                                className="btn btn-outline-blue text-xs"
                              >
                                {applicant.paid ? "Set Unpaid" : "Mark Paid"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Committees</h3>
                      <div className="space-y-3">
                        {selectedConference.committees.map((committee) => (
                          <div key={committee.id} className="p-3 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                            <p className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{committee.name}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{committee.topic}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>Capacity: {committee.size}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card p-6 rounded-2xl">
                      <h3 className="text-lg font-bold mb-4" style={{ color: "var(--fg)" }}>Broadcast Announcement</h3>
                      <div className="space-y-3">
                        <input
                          value={announcementTitle}
                          onChange={(event) => setAnnouncementTitle(event.target.value)}
                          className="input-base"
                          placeholder="Title"
                        />
                        <textarea
                          value={announcementMessage}
                          onChange={(event) => setAnnouncementMessage(event.target.value)}
                          className="input-base"
                          rows={4}
                          placeholder="Share an update with delegates..."
                          style={{ resize: "none" }}
                        />
                        <button
                          className="btn btn-primary w-full text-sm"
                          disabled={!announcementTitle.trim() || !announcementMessage.trim()}
                          style={{ opacity: announcementTitle.trim() && announcementMessage.trim() ? 1 : 0.6 }}
                          onClick={() => {
                            addAnnouncement(selectedConference.id, announcementTitle.trim(), announcementMessage.trim());
                            setAnnouncementTitle("");
                            setAnnouncementMessage("");
                          }}
                        >
                          Send Announcement
                        </button>
                      </div>
                      <div className="space-y-2 mt-4">
                        {selectedConference.announcements.slice(0, 3).map((announcement) => (
                          <div key={announcement.id} className="p-3 rounded-xl text-xs" style={{ background: "var(--bg-subtle)" }}>
                            <p className="font-semibold" style={{ color: "var(--fg)" }}>{announcement.title}</p>
                            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{announcement.message}</p>
                            <p className="mt-1" style={{ color: "var(--fg-muted)" }}>{announcement.createdAt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

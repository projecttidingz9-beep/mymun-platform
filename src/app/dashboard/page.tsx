"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import { ensureServerSession } from "@/lib/client/session";
import { downloadRegistrationInvoicePdf } from "@/lib/client/invoice-pdf";
import { useAuth } from "@/lib/auth-context";
import { DelegateMunAward, DelegateMunParticipation, Registration } from "@/lib/types";

type DelegateTabId = "conferences" | "profile" | "security" | "payments" | "notifications";

const DELEGATE_TABS: Array<{ id: DelegateTabId; label: string; icon: string }> = [
  { id: "conferences", label: "My Conferences", icon: "🌍" },
  { id: "profile", label: "Profile", icon: "👤" },
  { id: "security", label: "Security", icon: "🔒" },
  { id: "payments", label: "Payments", icon: "💳" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
];

const isDelegateTabId = (value: string): value is DelegateTabId =>
  DELEGATE_TABS.some((tab) => tab.id === value);

const formatInvoiceAddress = (registration: Registration, userAddress?: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}) => {
  const registrationLocation = registration.country?.trim();
  const fromProfile = [
    userAddress?.line1,
    userAddress?.line2,
    userAddress?.city,
    userAddress?.state,
    userAddress?.postalCode,
    userAddress?.country,
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean);
  if (fromProfile.length > 0) return fromProfile.join(", ");
  if (registrationLocation) return registrationLocation;
  return "Billing address not added";
};

export default function DashboardPage() {
  const { user, isLoggedIn, authReady, notifications, markNotificationRead, updateDelegateProfile, logout } =
    useAuth();
  const router = useRouter();
  const [delegatePasses, setDelegatePasses] = useState<Array<{
    id: string;
    eventName: string;
    committeeName?: string;
    portfolioName?: string;
    categoryName: string;
    registrationId: string;
    releaseAt: string;
    released: boolean;
    checkedIn: boolean;
    checkedInAt?: string | null;
    qrImageDataUrl?: string;
    qrToken: string;
  }>>([]);
  const [serverNotifications, setServerNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
  }>>([]);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [draftSchool, setDraftSchool] = useState("");
  const [draftProfileImageUrl, setDraftProfileImageUrl] = useState("");
  const [draftFirstName, setDraftFirstName] = useState("");
  const [draftLastName, setDraftLastName] = useState("");
  const [draftCollege, setDraftCollege] = useState("");
  const [draftFieldOfStudy, setDraftFieldOfStudy] = useState("");
  const [draftProfileHeadline, setDraftProfileHeadline] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftState, setDraftState] = useState("");
  const [draftPostalCode, setDraftPostalCode] = useState("");
  const [draftInstagram, setDraftInstagram] = useState("");
  const [draftLinkedin, setDraftLinkedin] = useState("");
  const [draftTwitter, setDraftTwitter] = useState("");
  const [draftGithub, setDraftGithub] = useState("");
  const [draftInvoiceLine1, setDraftInvoiceLine1] = useState("");
  const [draftInvoiceLine2, setDraftInvoiceLine2] = useState("");
  const [draftInvoiceCity, setDraftInvoiceCity] = useState("");
  const [draftInvoiceState, setDraftInvoiceState] = useState("");
  const [draftInvoicePostalCode, setDraftInvoicePostalCode] = useState("");
  const [draftInvoiceCountry, setDraftInvoiceCountry] = useState("");
  const [draftProfileVisibility, setDraftProfileVisibility] = useState<"public" | "private">("public");
  const [draftCountry, setDraftCountry] = useState("");
  const [draftExperienceSummary, setDraftExperienceSummary] = useState("");
  const [draftAwardsSummary, setDraftAwardsSummary] = useState("");
  const [draftParticipations, setDraftParticipations] = useState<DelegateMunParticipation[]>([]);
  const [draftAwards, setDraftAwards] = useState<DelegateMunAward[]>([]);
  const [changePasswordCurrent, setChangePasswordCurrent] = useState("");
  const [changePasswordNext, setChangePasswordNext] = useState("");
  const [changePasswordConfirm, setChangePasswordConfirm] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DelegateTabId>("conferences");
  const [invoicePreviewRegistrationId, setInvoicePreviewRegistrationId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) router.push("/");
    if (isLoggedIn && user?.role === "organizer") {
      router.push("/organizers/dashboard");
    }
  }, [isLoggedIn, router, user?.role]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && isDelegateTabId(hash)) {
      setActiveTab(hash);
    }
    const onHashChange = () => {
      const next = window.location.hash.replace(/^#/, "");
      if (next && isDelegateTabId(next)) {
        setActiveTab(next);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const changeActiveTab = (next: DelegateTabId) => {
    setActiveTab(next);
    if (typeof window !== "undefined") {
      const newUrl = `${window.location.pathname}${window.location.search}#${next}`;
      window.history.replaceState(null, "", newUrl);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    void ensureServerSession();
    void fetch("/api/passes/me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setDelegatePasses(data.passes || []))
      .catch(() => setDelegatePasses([]));
    void fetch("/api/notifications/me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setServerNotifications(data.notifications || []))
      .catch(() => setServerNotifications([]));
  }, [isLoggedIn, user]);

  if (!authReady || !isLoggedIn || !user) {
    return <AppRouteSkeleton />;
  }

  const registrations = user.registeredConferences;
  const myNotifications = notifications.filter(
    (notification) =>
      (!notification.userEmail || notification.userEmail === user.email) &&
      (!notification.userId || notification.userId === user.id)
  );
  const mergedNotifications = [
    ...serverNotifications,
    ...myNotifications.map((notification) => ({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
      read: notification.read,
    })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const totalPaid = registrations.filter(r => r.paid).reduce((sum, r) => sum + r.amount, 0);
  const confirmed = registrations.filter(r => r.status === "Confirmed").length;

  const STATUS_STYLE: Record<string, { class: string }> = {
    Confirmed: { class: "badge-green" },
    Waitlisted: { class: "badge-gold" },
    Pending: { class: "badge-gray" },
  };

  const startEditingProfile = () => {
    const [firstNameFromName = "", ...lastNameParts] = user.name.split(" ");
    setDraftSchool(user.school || "");
    setDraftProfileImageUrl(user.profileImageUrl || "");
    setDraftFirstName(user.firstName || firstNameFromName);
    setDraftLastName(user.lastName || lastNameParts.join(" "));
    setDraftCollege(user.college || "");
    setDraftFieldOfStudy(user.fieldOfStudy || "");
    setDraftProfileHeadline(user.profileHeadline || "");
    setDraftPhone(user.phone || "");
    setDraftCity(user.city || "");
    setDraftState(user.state || "");
    setDraftPostalCode(user.postalCode || "");
    setDraftInstagram(user.socialMedia?.instagram || "");
    setDraftLinkedin(user.socialMedia?.linkedin || "");
    setDraftTwitter(user.socialMedia?.twitter || "");
    setDraftGithub(user.socialMedia?.github || "");
    setDraftInvoiceLine1(user.invoiceAddress?.line1 || "");
    setDraftInvoiceLine2(user.invoiceAddress?.line2 || "");
    setDraftInvoiceCity(user.invoiceAddress?.city || "");
    setDraftInvoiceState(user.invoiceAddress?.state || "");
    setDraftInvoicePostalCode(user.invoiceAddress?.postalCode || "");
    setDraftInvoiceCountry(user.invoiceAddress?.country || "");
    setDraftProfileVisibility(user.profileVisibility || "public");
    setDraftCountry(user.country || "");
    setDraftExperienceSummary(user.munExperienceSummary || "");
    setDraftAwardsSummary(user.munAwardsSummary || "");
    setDraftParticipations(user.munParticipations || []);
    setDraftAwards(user.munAwards || []);
    setIsEditingProfile(true);
  };

  const addParticipation = () => {
    setDraftParticipations((prev) => [
      ...prev,
      {
        id: `part-${Date.now()}-${prev.length}`,
        conferenceName: "",
        committee: "",
        role: "",
        year: undefined,
        countryRepresented: "",
        notes: "",
      },
    ]);
  };

  const onProfileImageSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith("image/")) {
      alert("Please upload an image file.");
      event.target.value = "";
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert("Profile image must be under 5MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setDraftProfileImageUrl(dataUrl);
      event.target.value = "";
    };
    reader.readAsDataURL(selectedFile);
  };

  const updateParticipation = (id: string, patch: Partial<DelegateMunParticipation>) => {
    setDraftParticipations((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const moveParticipation = (id: string, direction: "up" | "down") => {
    setDraftParticipations((prev) => {
      const currentIndex = prev.findIndex((entry) => entry.id === id);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const removeParticipation = (id: string) => {
    setDraftParticipations((prev) => prev.filter((entry) => entry.id !== id));
  };

  const onParticipationCertificateSelected = (
    participationId: string,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    const allowedType =
      selectedFile.type === "application/pdf" ||
      selectedFile.type.startsWith("image/") ||
      selectedFile.type.includes("document") ||
      selectedFile.type.includes("word");
    if (!allowedType) {
      alert("Please upload a PDF, image, or DOC file.");
      event.target.value = "";
      return;
    }
    const maxBytes = 8 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      alert("Certificate file must be under 8MB.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      updateParticipation(participationId, {
        certificateUrl: dataUrl,
        certificateFileName: selectedFile.name,
        certificateMimeType: selectedFile.type || undefined,
      });
      event.target.value = "";
    };
    reader.readAsDataURL(selectedFile);
  };

  const addAward = () => {
    setDraftAwards((prev) => [
      ...prev,
      {
        id: `award-${Date.now()}-${prev.length}`,
        title: "",
        conferenceName: "",
        year: undefined,
        category: "",
        committee: "",
      },
    ]);
  };

  const updateAward = (id: string, patch: Partial<DelegateMunAward>) => {
    setDraftAwards((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const moveAward = (id: string, direction: "up" | "down") => {
    setDraftAwards((prev) => {
      const currentIndex = prev.findIndex((entry) => entry.id === id);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const removeAward = (id: string) => {
    setDraftAwards((prev) => prev.filter((entry) => entry.id !== id));
  };

  const saveProfile = () => {
    if (!draftPhone.trim()) {
      alert("Phone number is mandatory.");
      return;
    }
    const missingCertificateEntry = draftParticipations.find(
      (entry) => entry.conferenceName.trim() && !entry.certificateUrl
    );
    if (missingCertificateEntry) {
      alert(
        `Please upload a participation certificate for "${missingCertificateEntry.conferenceName.trim()}".`
      );
      return;
    }
    updateDelegateProfile({
      profileImageUrl: draftProfileImageUrl,
      firstName: draftFirstName.trim(),
      lastName: draftLastName.trim(),
      school: draftSchool.trim(),
      college: draftCollege.trim(),
      fieldOfStudy: draftFieldOfStudy.trim(),
      profileHeadline: draftProfileHeadline.trim(),
      phone: draftPhone.trim(),
      city: draftCity.trim(),
      state: draftState.trim(),
      postalCode: draftPostalCode.trim(),
      socialMedia: {
        instagram: draftInstagram.trim(),
        linkedin: draftLinkedin.trim(),
        twitter: draftTwitter.trim(),
        github: draftGithub.trim(),
      },
      invoiceAddress: {
        line1: draftInvoiceLine1.trim(),
        line2: draftInvoiceLine2.trim(),
        city: draftInvoiceCity.trim(),
        state: draftInvoiceState.trim(),
        postalCode: draftInvoicePostalCode.trim(),
        country: draftInvoiceCountry.trim(),
      },
      country: draftCountry.trim(),
      munExperienceSummary: draftExperienceSummary.trim(),
      munAwardsSummary: draftAwardsSummary.trim(),
      profileVisibility: draftProfileVisibility,
      munParticipations: draftParticipations
        .filter((entry) => entry.conferenceName.trim())
        .map((entry) => ({
          ...entry,
          conferenceName: entry.conferenceName.trim(),
          committee: entry.committee?.trim() || undefined,
          role: entry.role?.trim() || undefined,
          countryRepresented: entry.countryRepresented?.trim() || undefined,
          notes: entry.notes?.trim() || undefined,
          year: entry.year,
          certificateUrl: entry.certificateUrl,
          certificateFileName: entry.certificateFileName?.trim() || undefined,
          certificateMimeType: entry.certificateMimeType?.trim() || undefined,
        })),
      munAwards: draftAwards
        .filter((entry) => entry.title.trim() && entry.conferenceName.trim())
        .map((entry) => ({
          ...entry,
          title: entry.title.trim(),
          conferenceName: entry.conferenceName.trim(),
          category: entry.category?.trim() || undefined,
          committee: entry.committee?.trim() || undefined,
          year: entry.year,
        })),
    });
    setIsEditingProfile(false);
  };

  const onDownloadInvoicePdf = (registration: Registration) => {
    if (!registration.paid) {
      alert("Invoice is available after payment is completed.");
      return;
    }
    downloadRegistrationInvoicePdf(registration, {
      name: user.name,
      email: user.email,
      invoiceAddress: user.invoiceAddress,
    });
  };

  const onChangePassword = async () => {
    if (!changePasswordCurrent || !changePasswordNext || !changePasswordConfirm) {
      alert("Please fill all password fields.");
      return;
    }
    if (changePasswordNext.length < 8) {
      alert("New password must be at least 8 characters.");
      return;
    }
    if (changePasswordNext !== changePasswordConfirm) {
      alert("New password and confirmation do not match.");
      return;
    }
    setChangePasswordLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: changePasswordCurrent,
          newPassword: changePasswordNext,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        alert(payload.error || "Could not change password.");
        return;
      }
      setChangePasswordCurrent("");
      setChangePasswordNext("");
      setChangePasswordConfirm("");
      alert("Password updated successfully.");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const onDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      alert("Please confirm your password to delete account.");
      return;
    }
    const confirmed = window.confirm(
      "This will permanently delete your account data. This action cannot be undone."
    );
    if (!confirmed) return;
    setDeleteLoading(true);
    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: deletePassword }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        alert(payload.error || "Could not delete account.");
        return;
      }
      await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
      logout();
      router.push("/");
    } finally {
      setDeleteLoading(false);
    }
  };

  const onForgotPasswordFromSecurity = async () => {
    if (!user.email) return;
    setForgotPasswordLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        alert(payload.error || "Could not send reset link.");
        return;
      }
      alert(`Password reset link sent to ${user.email}.`);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-7xl mx-auto">
          <header className="app-header">
            <div className="app-header-copy">
              <div className="section-label mb-3">My Dashboard</div>
              <h1 className="app-title">
                Welcome back, {user.name.split(" ")[0]} 👋
              </h1>
              <p className="app-subtitle mt-2">
                {user.school} · {user.country}
              </p>
            </div>
            <div className="app-header-actions">
              <Link href="/marketplace" className="btn btn-primary text-sm">
                + Find Conference
              </Link>
            </div>
          </header>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
            {[
              { label: "Conferences", value: registrations.length, icon: "🌍", tone: "info" as const },
              { label: "Confirmed", value: confirmed, icon: "✅", tone: "success" as const },
              { label: "Countries Represented", value: [...new Set(registrations.map(r => r.country))].length, icon: "🏳️", tone: "accent" as const },
              { label: "Total Invested", value: `$${totalPaid}`, icon: "💳", tone: "warning" as const },
            ].map((stat) => (
              <div key={stat.label} className="app-stat">
                <div className="app-stat-head">
                  <span className="app-stat-dot" data-tone={stat.tone} />
                  <span className="app-stat-label">{stat.label}</span>
                  <span className="ml-auto text-lg" aria-hidden>{stat.icon}</span>
                </div>
                <p className="app-stat-value">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="app-tabs mb-4" role="tablist" aria-label="Dashboard sections">
            {DELEGATE_TABS.map((tab) => {
              const count =
                tab.id === "notifications"
                  ? mergedNotifications.filter((n) => !n.read).length
                  : tab.id === "conferences"
                    ? registrations.length
                    : undefined;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className="app-tab"
                  data-active={activeTab === tab.id ? "true" : "false"}
                  onClick={() => changeActiveTab(tab.id)}
                >
                  <span aria-hidden>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {count !== undefined && count > 0 && (
                    <span className="app-tab-count">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div>
            {activeTab === "conferences" && (
              <div className="space-y-4">
              {delegatePasses.length > 0 && (
                <div className="card p-6 rounded-2xl mb-5">
                  <h3 className="font-bold mb-3" style={{ color: "var(--fg)" }}>Digital Delegate Passes</h3>
                  <div className="space-y-3">
                    {delegatePasses.map((pass) => (
                      <div key={pass.id} className="p-4 rounded-xl" style={{ background: "var(--bg-subtle)" }}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{pass.eventName}</p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              {pass.categoryName} · {pass.committeeName || "No committee"} · {pass.portfolioName || "No portfolio"}
                            </p>
                            <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                              Registration ID: {pass.registrationId}
                            </p>
                            {!pass.released && (
                              <p className="text-xs mt-1" style={{ color: "#d97706" }}>
                                Pass releases at {new Date(pass.releaseAt).toLocaleString()}
                              </p>
                            )}
                            {pass.checkedIn && (
                              <p className="text-xs mt-1" style={{ color: "#16a34a" }}>
                                Checked in at {pass.checkedInAt ? new Date(pass.checkedInAt).toLocaleString() : "event gate"}
                              </p>
                            )}
                          </div>
                          {pass.released && pass.qrImageDataUrl ? (
                            <div className="text-center">
                              <Image
                                src={pass.qrImageDataUrl}
                                alt="Delegate QR code"
                                width={112}
                                height={112}
                                className="w-28 h-28 rounded-lg bg-white p-2"
                              />
                              <a
                                href={pass.qrImageDataUrl}
                                download={`delegate-pass-${pass.registrationId}.png`}
                                className="btn btn-ghost text-xs mt-2"
                              >
                                Download Pass
                              </a>
                            </div>
                          ) : (
                            <span className="badge badge-gold">Locked</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {registrations.length === 0 ? (
                <div
                  className="app-card py-20 text-center"
                  style={{ border: "2px dashed var(--border)" }}
                >
                  <p className="text-5xl mb-4">🎓</p>
                  <h3 className="text-xl font-bold mb-2" style={{ color: "var(--fg)" }}>No conferences yet</h3>
                  <p className="app-subtitle mb-5">Start your MUN journey by finding your first conference.</p>
                  <Link href="/marketplace" className="btn btn-primary text-sm">Browse Marketplace →</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {registrations.map((reg) => {
                    return (
                      <div key={reg.id} className="card p-5 rounded-2xl">
                        <div className="flex items-start gap-4">
                          <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, var(--blue), var(--accent-warm))" }}
                          >
                            <span className="text-white font-black text-xl">M</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <h3 className="font-bold text-base" style={{ color: "var(--fg)" }}>
                                {reg.conferenceTitle}
                              </h3>
                              <span className={`badge ${STATUS_STYLE[reg.status]?.class ?? "badge-gray"}`}>
                                {reg.status}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                              <span>🏛️ Assigned: {reg.assignedCommitteeName || reg.committeeName || "Pending"}</span>
                              <span>📌 Portfolio: {reg.assignedPortfolioName || "Not assigned"}</span>
                              <span>🏳️ {reg.country}</span>
                              <span>📂 {reg.categoryName}</span>
                              <span>📅 Registered {reg.registeredAt}</span>
                            </div>
                            <div className="mt-2">
                              <span className={`badge ${
                                reg.organizerStatus === "Allotted"
                                  ? "badge-green"
                                  : reg.organizerStatus === "Waitlisted"
                                    ? "badge-gold"
                                    : reg.organizerStatus === "Rejected"
                                      ? "badge-gray"
                                      : "badge-blue"
                              }`}>
                                Organizer Status: {reg.organizerStatus || "Pending"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                          <div className="flex items-center gap-2">
                            <span className={`badge text-[10px] ${reg.paid ? "badge-success" : "badge-danger"}`}>
                              {reg.paid ? "✓ Paid" : "Pending Payment"}
                            </span>
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>${reg.amount}</span>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              href={`/conference/${reg.conferenceId}`}
                              className="btn btn-ghost text-xs"
                              style={{ padding: "6px 14px", borderRadius: "8px" }}
                            >
                              View Conference
                            </Link>
                            {(() => {
                              const certificateEntry = (user.munParticipations || []).find(
                                (entry) =>
                                  entry.conferenceName.trim().toLowerCase() ===
                                    reg.conferenceTitle.trim().toLowerCase() && entry.certificateUrl
                              );
                              if (!certificateEntry?.certificateUrl) return null;
                              return (
                                <a
                                  href={certificateEntry.certificateUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-ghost text-xs"
                                  style={{ padding: "6px 14px", borderRadius: "8px" }}
                                >
                                  View Certificate
                                </a>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              </div>
            )}

            {activeTab === "profile" && (
              <div className="space-y-4">
              <div className="card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold" style={{ color: "var(--fg)" }}>My Profile</h3>
                  {!isEditingProfile ? (
                    <button onClick={startEditingProfile} className="btn btn-ghost text-xs">Edit</button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingProfile(false)} className="btn btn-ghost text-xs">Cancel</button>
                      <button onClick={saveProfile} className="btn btn-primary text-xs">Save</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 mb-5">
                  {user.profileImageUrl ? (
                    <Image
                      src={user.profileImageUrl}
                      alt={`${user.name} profile`}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-black text-2xl"
                      style={{ background: "linear-gradient(135deg, var(--blue), var(--accent-warm))" }}
                    >
                      {user.avatar}
                    </div>
                  )}
                  <div>
                    <p className="font-bold" style={{ color: "var(--fg)" }}>{user.name}</p>
                    <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.email}</p>
                  </div>
                </div>
                {isEditingProfile ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Profile Picture</p>
                      <input
                        type="file"
                        accept="image/*"
                        className="input-base text-xs"
                        onChange={onProfileImageSelected}
                      />
                      {draftProfileImageUrl && (
                        <div className="flex items-center gap-3">
                          <Image
                            src={draftProfileImageUrl}
                            alt="Draft profile preview"
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <button
                            className="btn btn-ghost text-xs"
                            onClick={() => setDraftProfileImageUrl("")}
                          >
                            Remove Picture
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={draftFirstName}
                        onChange={(event) => setDraftFirstName(event.target.value)}
                        className="input-base text-xs"
                        placeholder="First name"
                      />
                      <input
                        value={draftLastName}
                        onChange={(event) => setDraftLastName(event.target.value)}
                        className="input-base text-xs"
                        placeholder="Last name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={draftSchool}
                        onChange={(event) => setDraftSchool(event.target.value)}
                        className="input-base text-xs"
                        placeholder="School"
                      />
                      <input
                        value={draftCountry}
                        onChange={(event) => setDraftCountry(event.target.value)}
                        className="input-base text-xs"
                        placeholder="Country"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={draftCollege}
                        onChange={(event) => setDraftCollege(event.target.value)}
                        className="input-base text-xs"
                        placeholder="College"
                      />
                      <input
                        value={draftFieldOfStudy}
                        onChange={(event) => setDraftFieldOfStudy(event.target.value)}
                        className="input-base text-xs"
                        placeholder="Field of study"
                      />
                    </div>
                    <input
                      value={draftProfileHeadline}
                      onChange={(event) => setDraftProfileHeadline(event.target.value)}
                      className="input-base text-xs"
                      placeholder="Profile headline"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={draftPhone}
                        onChange={(event) => setDraftPhone(event.target.value)}
                        className="input-base text-xs"
                        placeholder="Phone"
                      />
                      <input
                        value={draftPostalCode}
                        onChange={(event) => setDraftPostalCode(event.target.value)}
                        className="input-base text-xs"
                        placeholder="Postal code"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={draftCity}
                        onChange={(event) => setDraftCity(event.target.value)}
                        className="input-base text-xs"
                        placeholder="City"
                      />
                      <input
                        value={draftState}
                        onChange={(event) => setDraftState(event.target.value)}
                        className="input-base text-xs"
                        placeholder="State"
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Social Media</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={draftInstagram} onChange={(event) => setDraftInstagram(event.target.value)} className="input-base text-xs" placeholder="Instagram URL" />
                        <input value={draftLinkedin} onChange={(event) => setDraftLinkedin(event.target.value)} className="input-base text-xs" placeholder="LinkedIn URL" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={draftTwitter} onChange={(event) => setDraftTwitter(event.target.value)} className="input-base text-xs" placeholder="X/Twitter URL" />
                        <input value={draftGithub} onChange={(event) => setDraftGithub(event.target.value)} className="input-base text-xs" placeholder="GitHub URL" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Invoice Address</p>
                      <input value={draftInvoiceLine1} onChange={(event) => setDraftInvoiceLine1(event.target.value)} className="input-base text-xs" placeholder="Address line 1" />
                      <input value={draftInvoiceLine2} onChange={(event) => setDraftInvoiceLine2(event.target.value)} className="input-base text-xs" placeholder="Address line 2 (optional)" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={draftInvoiceCity} onChange={(event) => setDraftInvoiceCity(event.target.value)} className="input-base text-xs" placeholder="Invoice city" />
                        <input value={draftInvoiceState} onChange={(event) => setDraftInvoiceState(event.target.value)} className="input-base text-xs" placeholder="Invoice state" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={draftInvoicePostalCode} onChange={(event) => setDraftInvoicePostalCode(event.target.value)} className="input-base text-xs" placeholder="Invoice postal code" />
                        <input value={draftInvoiceCountry} onChange={(event) => setDraftInvoiceCountry(event.target.value)} className="input-base text-xs" placeholder="Invoice country" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Profile Privacy</p>
                      <select
                        value={draftProfileVisibility}
                        onChange={(event) => setDraftProfileVisibility(event.target.value === "private" ? "private" : "public")}
                        className="input-base text-xs"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                      </select>
                    </div>
                    <textarea
                      value={draftExperienceSummary}
                      onChange={(event) => setDraftExperienceSummary(event.target.value)}
                      className="input-base text-xs"
                      rows={3}
                      placeholder="MUN experience summary"
                    />
                    <textarea
                      value={draftAwardsSummary}
                      onChange={(event) => setDraftAwardsSummary(event.target.value)}
                      className="input-base text-xs"
                      rows={3}
                      placeholder="Awards summary"
                    />

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Participations</p>
                        <button onClick={addParticipation} className="btn btn-ghost text-xs">+ Add</button>
                      </div>
                      {draftParticipations.map((entry, index) => (
                        <div key={entry.id} className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => moveParticipation(entry.id, "up")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === 0}
                              aria-label="Move participation up"
                            >
                              <span aria-hidden>↑</span>
                            </button>
                            <button
                              onClick={() => moveParticipation(entry.id, "down")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === draftParticipations.length - 1}
                              aria-label="Move participation down"
                            >
                              <span aria-hidden>↓</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.conferenceName} onChange={(event) => updateParticipation(entry.id, { conferenceName: event.target.value })} className="input-base text-xs" placeholder="Conference" />
                            <input value={entry.committee || ""} onChange={(event) => updateParticipation(entry.id, { committee: event.target.value })} className="input-base text-xs" placeholder="Committee" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.role || ""} onChange={(event) => updateParticipation(entry.id, { role: event.target.value })} className="input-base text-xs" placeholder="Role" />
                            <input value={entry.countryRepresented || ""} onChange={(event) => updateParticipation(entry.id, { countryRepresented: event.target.value })} className="input-base text-xs" placeholder="Country represented" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={entry.year ?? ""}
                              onChange={(event) => updateParticipation(entry.id, { year: event.target.value ? Number(event.target.value) : undefined })}
                              className="input-base text-xs"
                              placeholder="Year"
                            />
                            <button onClick={() => removeParticipation(entry.id)} className="btn btn-ghost text-xs">Remove</button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,image/*"
                              className="input-base text-xs"
                              onChange={(event) => onParticipationCertificateSelected(entry.id, event)}
                            />
                            <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                              Certificate upload is mandatory for each participation entry.
                            </p>
                            {entry.certificateFileName && (
                              <div className="flex items-center justify-between">
                                <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                                  Uploaded: {entry.certificateFileName}
                                </p>
                                <button
                                  className="btn btn-ghost text-xs"
                                  onClick={() =>
                                    updateParticipation(entry.id, {
                                      certificateUrl: undefined,
                                      certificateFileName: undefined,
                                      certificateMimeType: undefined,
                                    })
                                  }
                                >
                                  Remove Certificate
                                </button>
                              </div>
                            )}
                          </div>
                          <textarea value={entry.notes || ""} onChange={(event) => updateParticipation(entry.id, { notes: event.target.value })} className="input-base text-xs" rows={2} placeholder="Notes" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Awards</p>
                        <button onClick={addAward} className="btn btn-ghost text-xs">+ Add</button>
                      </div>
                      {draftAwards.map((entry, index) => (
                        <div key={entry.id} className="rounded-xl p-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => moveAward(entry.id, "up")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === 0}
                              aria-label="Move award up"
                            >
                              <span aria-hidden>↑</span>
                            </button>
                            <button
                              onClick={() => moveAward(entry.id, "down")}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                              style={{ background: "var(--bg)", color: "var(--fg-muted)", border: "1px solid var(--border)" }}
                              disabled={index === draftAwards.length - 1}
                              aria-label="Move award down"
                            >
                              <span aria-hidden>↓</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.title} onChange={(event) => updateAward(entry.id, { title: event.target.value })} className="input-base text-xs" placeholder="Award title" />
                            <input value={entry.conferenceName} onChange={(event) => updateAward(entry.id, { conferenceName: event.target.value })} className="input-base text-xs" placeholder="Conference" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={entry.category || ""} onChange={(event) => updateAward(entry.id, { category: event.target.value })} className="input-base text-xs" placeholder="Category" />
                            <input value={entry.committee || ""} onChange={(event) => updateAward(entry.id, { committee: event.target.value })} className="input-base text-xs" placeholder="Committee" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              value={entry.year ?? ""}
                              onChange={(event) => updateAward(entry.id, { year: event.target.value ? Number(event.target.value) : undefined })}
                              className="input-base text-xs"
                              placeholder="Year"
                            />
                            <button onClick={() => removeAward(entry.id)} className="btn btn-ghost text-xs">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>First Name</span>
                      <span className="font-medium" style={{ color: "var(--fg)" }}>{user.firstName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>Last Name</span>
                      <span className="font-medium" style={{ color: "var(--fg)" }}>{user.lastName || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>School</span>
                      <span className="font-medium text-right max-w-[180px] text-xs" style={{ color: "var(--fg)" }}>{user.school}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>College</span>
                      <span className="font-medium text-right max-w-[180px] text-xs" style={{ color: "var(--fg)" }}>{user.college || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>Field of Study</span>
                      <span className="font-medium text-right max-w-[180px] text-xs" style={{ color: "var(--fg)" }}>{user.fieldOfStudy || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>Country</span>
                      <span className="font-medium" style={{ color: "var(--fg)" }}>{user.country}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: "var(--fg-muted)" }}>Profile Visibility</span>
                      <span className="font-medium" style={{ color: "var(--fg)" }}>
                        {user.profileVisibility === "private" ? "Private" : "Public"}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>Headline</p>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.profileHeadline || "No headline added."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>MUN Experience</p>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.munExperienceSummary || "No experience summary added."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>Awards Summary</p>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{user.munAwardsSummary || "No awards summary added."}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>Social Media</p>
                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                        {user.socialMedia?.instagram || user.socialMedia?.linkedin || user.socialMedia?.twitter || user.socialMedia?.github
                          ? [user.socialMedia?.instagram, user.socialMedia?.linkedin, user.socialMedia?.twitter, user.socialMedia?.github].filter(Boolean).join(" · ")
                          : "No social media links added."}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>Invoice Address</p>
                      <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                        {user.invoiceAddress?.line1 || user.invoiceAddress?.city || user.invoiceAddress?.country
                          ? [
                              user.invoiceAddress?.line1,
                              user.invoiceAddress?.line2,
                              user.invoiceAddress?.city,
                              user.invoiceAddress?.state,
                              user.invoiceAddress?.postalCode,
                              user.invoiceAddress?.country,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : "No invoice address added."}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>
                        Participations ({user.munParticipations?.length || 0})
                      </p>
                      <p className="text-[11px] mb-1" style={{ color: "var(--fg-muted)" }}>
                        Total conferences attended: {user.munParticipations?.length || 0}
                      </p>
                      <div className="space-y-1">
                        {(user.munParticipations || []).slice(0, 3).map((entry, index) => (
                          <p key={entry.id} className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            {index + 1}. {entry.conferenceName} {entry.year ? `(${entry.year})` : ""} {entry.committee ? `· ${entry.committee}` : ""}
                          </p>
                        ))}
                        {(user.munParticipations || []).length === 0 && (
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>No participations added yet.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: "var(--fg)" }}>
                        Awards ({user.munAwards?.length || 0})
                      </p>
                      <p className="text-[11px] mb-1" style={{ color: "var(--fg-muted)" }}>
                        Total awards won: {user.munAwards?.length || 0}
                      </p>
                      <div className="space-y-1">
                        {(user.munAwards || []).slice(0, 2).map((entry) => (
                          <p key={entry.id} className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                            {entry.title} · {entry.conferenceName} {entry.year ? `(${entry.year})` : ""}
                          </p>
                        ))}
                        {(user.munAwards || []).length === 0 && (
                          <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>No awards added yet.</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/delegates/${user.id}`} className="btn btn-ghost text-xs w-full">
                      View Public Profile
                    </Link>
                  </div>
                )}
              </div>

              {isEditingProfile && (
                <div className="app-sticky-bar">
                  <div>
                    <p className="app-sticky-bar-copy">You have unsaved profile edits</p>
                    <p className="app-sticky-bar-copy-muted">Review your changes, then save to apply.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="btn btn-ghost text-xs">
                      Discard
                    </button>
                    <button type="button" onClick={saveProfile} className="btn btn-primary text-xs">
                      Save changes
                    </button>
                  </div>
                </div>
              )}
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-4">
              <div className="card p-5 rounded-2xl">
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>Account Security</h3>
                <div className="space-y-3">
                  <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>Change Password</p>
                  <input
                    type="password"
                    value={changePasswordCurrent}
                    onChange={(event) => setChangePasswordCurrent(event.target.value)}
                    className="input-base text-xs"
                    placeholder="Current password"
                  />
                  <input
                    type="password"
                    value={changePasswordNext}
                    onChange={(event) => setChangePasswordNext(event.target.value)}
                    className="input-base text-xs"
                    placeholder="New password"
                  />
                  <input
                    type="password"
                    value={changePasswordConfirm}
                    onChange={(event) => setChangePasswordConfirm(event.target.value)}
                    className="input-base text-xs"
                    placeholder="Confirm new password"
                  />
                  <button
                    onClick={onChangePassword}
                    className="btn btn-primary text-xs w-full"
                    disabled={changePasswordLoading}
                  >
                    {changePasswordLoading ? "Updating..." : "Update Password"}
                  </button>
                  <button
                    onClick={onForgotPasswordFromSecurity}
                    className="btn btn-ghost text-xs w-full"
                    disabled={forgotPasswordLoading}
                  >
                    {forgotPasswordLoading ? "Sending reset link..." : "Forgot password? Send reset email"}
                  </button>
                </div>
                <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--danger)" }}>Delete Account</p>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    className="input-base text-xs"
                    placeholder="Confirm password to delete account"
                  />
                  <button
                    onClick={onDeleteAccount}
                    className="btn btn-danger text-xs w-full mt-2"
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? "Deleting..." : "Delete My Account"}
                  </button>
                </div>
              </div>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="space-y-4">
              <div className="card p-5 rounded-2xl">
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>Payment History</h3>
                {registrations.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    No payment records yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {registrations.map((registration) => (
                      <div key={registration.id} className="rounded-xl p-3" style={{ background: "var(--bg-subtle)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                              {registration.conferenceTitle}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                              {registration.categoryName} · Registered {registration.registeredAt}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--fg-muted)" }}>
                              Amount: ${registration.amount.toFixed(2)}
                            </p>
                          </div>
                          <span className={`badge ${registration.paid ? "badge-green" : "badge-gray"}`}>
                            {registration.paid ? "Paid" : "Pending"}
                          </span>
                        </div>
                        <button
                          className="btn btn-ghost text-xs mt-2 w-full"
                          disabled={!registration.paid}
                          onClick={() => onDownloadInvoicePdf(registration)}
                        >
                          {registration.paid ? "Download Invoice (PDF)" : "Invoice available after payment"}
                        </button>
                        {registration.paid && (
                          <button
                            className="btn btn-primary text-xs mt-2 w-full"
                            onClick={() =>
                              setInvoicePreviewRegistrationId((current) =>
                                current === registration.id ? null : registration.id
                              )
                            }
                          >
                            {invoicePreviewRegistrationId === registration.id ? "Hide Invoice" : "View Invoice"}
                          </button>
                        )}
                        {registration.paid && invoicePreviewRegistrationId === registration.id && (
                          <div className="rounded-xl p-4 mt-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div>
                                <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>Tax Invoice</p>
                                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Invoice ID: INV-{registration.id}</p>
                              </div>
                              <span className="badge badge-success">Paid</span>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3 mt-3 text-xs">
                              <div>
                                <p style={{ color: "var(--fg-muted)" }}>Bill To</p>
                                <p className="font-semibold mt-1" style={{ color: "var(--fg)" }}>{user.name}</p>
                                <p style={{ color: "var(--fg-muted)" }}>{user.email}</p>
                                <p style={{ color: "var(--fg-muted)" }}>
                                  {formatInvoiceAddress(registration, user.invoiceAddress)}
                                </p>
                              </div>
                              <div>
                                <p style={{ color: "var(--fg-muted)" }}>Conference</p>
                                <p className="font-semibold mt-1" style={{ color: "var(--fg)" }}>{registration.conferenceTitle}</p>
                                <p style={{ color: "var(--fg-muted)" }}>{registration.categoryName}</p>
                                <p style={{ color: "var(--fg-muted)" }}>Registered {registration.registeredAt}</p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 flex items-center justify-between text-sm" style={{ borderTop: "1px solid var(--border)" }}>
                              <span style={{ color: "var(--fg-muted)" }}>Total Paid</span>
                              <span className="font-bold" style={{ color: "var(--fg)" }}>${registration.amount.toFixed(2)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-4">
              <div className="card p-5 rounded-2xl">
                <h3 className="font-bold mb-4" style={{ color: "var(--fg)" }}>Recent Notifications</h3>
                {mergedNotifications.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No updates yet.</p>
                ) : (
                  <div className="space-y-2">
                    {mergedNotifications.slice(0, 3).map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => markNotificationRead(notification.id)}
                        className="w-full text-left rounded-xl p-3"
                        style={{ background: "var(--bg-subtle)" }}
                      >
                        <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>{notification.title}</p>
                        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{notification.message}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="p-6 rounded-2xl"
                style={{
                  background: "linear-gradient(135deg, var(--blue), var(--accent-warm))",
                  border: "none",
                  boxShadow: "var(--card-shadow)",
                }}
              >
                <h3 className="font-bold mb-2 text-white">💡 Tip of the Day</h3>
                <p className="text-white/85 text-sm leading-relaxed">
                  Start preparing your position paper at least 2 weeks before the conference. Research your country&apos;s official UN voting history for strong arguments.
                </p>

              </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

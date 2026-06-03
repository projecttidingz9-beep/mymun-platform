"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/lib/auth-context";
import {
  type Conference,
  OrganizerCommittee,
  Registration,
  RegistrationCategory,
} from "@/lib/types";
import { getPhaseStatus, resolveRegistrationPrice } from "@/lib/pricing";
import { getCategoryTypeHint, getCategoryTypeLabel } from "@/lib/registration-category-types";
import { getMarketplaceConferences } from "@/lib/marketplace-conferences";
import { formatMoney } from "@/lib/format-money";

type Step = 1 | 2 | 3 | 4;

const createConfirmationId = () => `TZ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, user, addRegistration, organizerConferences } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState(user?.name || "");
  const [school, setSchool] = useState(user?.school || "");
  const [phone, setPhone] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCommitteeId, setSelectedCommitteeId] = useState("");
  const [secondPreferenceCommitteeId, setSecondPreferenceCommitteeId] = useState("");
  const [thirdPreferenceCommitteeId, setThirdPreferenceCommitteeId] = useState("");
  const [portfolioPreferencePrimary, setPortfolioPreferencePrimary] = useState("");
  const [portfolioPreferenceSecondary, setPortfolioPreferenceSecondary] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string[]>>({});
  const [catalogConference, setCatalogConference] = useState<Conference | null>(null);

  const eventKey = String(params.id);
  const organizerConference = organizerConferences.find((conference) => conference.id === eventKey);
  const fromLocalList = getMarketplaceConferences(organizerConferences).find(
    (conference) => conference.id === eventKey || conference.slug === eventKey
  );
  const marketplaceConference = fromLocalList ?? catalogConference;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/marketplace", { cache: "no-store" });
        const data = (await res.json()) as { conferences?: Conference[] };
        const list = Array.isArray(data.conferences) ? data.conferences : [];
        const match = list.find((c) => c.id === eventKey || c.slug === eventKey) ?? null;
        if (!cancelled) setCatalogConference(match);
      } catch {
        if (!cancelled) setCatalogConference(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/");
      return;
    }
    if (user?.role === "organizer") {
      router.push(`/conference/${String(params.id)}`);
    }
  }, [isLoggedIn, user?.role, router, params.id]);

  const displayTitle = organizerConference?.title || marketplaceConference?.title || "Conference";
  const displayCity = organizerConference?.city || marketplaceConference?.city || "";
  const displayStartDate = organizerConference?.startDate || marketplaceConference?.startDate || "";
  const checkoutCurrency =
    (typeof organizerConference?.currency === "string" && organizerConference.currency.trim()
      ? organizerConference.currency.trim()
      : null) ||
    marketplaceConference?.currency?.trim() ||
    "INR";

  const rawCategories: RegistrationCategory[] = organizerConference
    ? organizerConference.registrationCategories
    : [
        {
          id: "default-delegate",
          name: "Delegate Registration",
          description: "Standard delegate registration",
          applicationType: "delegate",
          isOpen: true,
          basePrice: marketplaceConference?.price || 0,
          requiresCommitteeSelection: true,
          formFields: [
            {
              id: "mun-experience",
              label: "MUN Experience",
              type: "select",
              required: true,
              options: ["beginner", "intermediate", "experienced"],
            },
          ],
          pricingPhases: [],
        },
      ];
  const categories = rawCategories.filter((category) => category.isOpen !== false);

  const committees: OrganizerCommittee[] = organizerConference
    ? organizerConference.committees
    : (marketplaceConference?.committees || []).map((committee) => ({
        id: committee.id,
        name: committee.name,
        agenda: committee.topic1,
        seatCount: committee.size,
        basePrice: undefined,
        portfolios: [],
      }));

  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedCommittee = committees.find((committee) => committee.id === selectedCommitteeId);
  const selectedCommitteePortfolios =
    committees.find((committee) => committee.id === selectedCommitteeId)?.portfolios ?? [];
  const delegationSizeRaw = Number(answers.delegation_size ?? 0);
  const isDelegationCategory = selectedCategory?.applicationType === "delegation";
  const delegationSizeValid =
    !isDelegationCategory ||
    (Number.isFinite(delegationSizeRaw) &&
      delegationSizeRaw >= 1 &&
      (selectedCategory?.maxDelegatesPerDelegation === undefined ||
        delegationSizeRaw <= selectedCategory.maxDelegatesPerDelegation));
  const priceResult = selectedCategory
    ? resolveRegistrationPrice(selectedCategory, selectedCommitteeId || undefined)
    : {
        amount: 0,
        phaseId: undefined,
        phaseName: undefined,
        source: "category-base" as const,
        status: "base" as const,
      };

  const resolvedFeeDisplay = formatMoney(priceResult.amount, checkoutCurrency);

  const committeeQuestionsValid = (() => {
    if (!selectedCommittee) return true;
    return (selectedCommittee.customQuestions ?? []).every(
      (q) => !q.required || (answers[`cq-${selectedCommittee.id}-${q.id}`] !== undefined && String(answers[`cq-${selectedCommittee.id}-${q.id}`]).trim() !== "")
    );
  })();

  const handlePay = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const registrationId = createConfirmationId();
      const formAnswers = Object.fromEntries(
        Object.entries(answers).filter(([key]) => !key.startsWith("cq-"))
      );
      const res = await fetch("/api/registrations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          eventId: String(params.id),
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          committeeConfigId: selectedCommitteeId || undefined,
          committeeName: selectedCommittee?.name,
          portfolioName: portfolioPreferencePrimary || undefined,
          committeePreferences: [selectedCommitteeId, secondPreferenceCommitteeId, thirdPreferenceCommitteeId].filter(
            Boolean
          ),
          portfolioPreferencesByCommittee: selectedCommitteeId
            ? {
                [selectedCommitteeId]: [portfolioPreferencePrimary, portfolioPreferenceSecondary].filter(Boolean),
              }
            : {},
          formAnswers,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        clientRegistration?: Registration;
      };
      if (!res.ok || !payload.clientRegistration) {
        alert(payload.error || "Registration failed. If this conference was created only on this device, publish it from the organizer dashboard so it exists on the server.");
        return;
      }
      addRegistration(payload.clientRegistration);
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid = !!selectedCategoryId;
  const isStep2Valid = !!selectedCategory && phone.trim().length > 0 && selectedCategory.formFields.every(
    (field) => !field.required || answers[field.id] !== undefined
  ) && delegationSizeValid;
  const isStep3Valid = (!selectedCategory?.requiresCommitteeSelection || !!selectedCommitteeId) && committeeQuestionsValid;
  const isStep4Valid = true;

  if (user?.role === "organizer") {
    return (
      <>
        <Navbar />
        <div className="app-shell min-h-[min(45vh,100dvh)] flex flex-col items-center justify-center px-4 sm:px-6">
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            Redirecting organizers to the conference page…
          </p>
        </div>
        <Footer />
      </>
    );
  }

  if (!organizerConference && !marketplaceConference) {
    return (
      <>
        <Navbar />
        <div className="app-shell">
          <div className="max-w-2xl mx-auto">
            <div className="app-card text-center py-14">
              <h1 className="app-title">Conference Not Found</h1>
              <p className="app-subtitle mt-2">
                This conference may not be live yet or the link is invalid.
              </p>
              <div className="mt-6">
                <Link href="/marketplace" className="btn btn-primary">
                  Back to Marketplace
                </Link>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="app-shell">
        <div className="max-w-2xl mx-auto">
          <header className="app-header">
            <div className="app-header-copy">
              <div className="section-label mb-3">
                {`Checkout · Step ${step}/4`}
              </div>
              <h1 className="app-title">
                Complete Your Registration
              </h1>
              <p className="app-subtitle mt-2">
                {displayTitle}
              </p>
            </div>
            <div className="app-header-actions">
              <Link href={`/conference/${params.id}`} className="btn btn-ghost text-sm">
                ← Back to Conference
              </Link>
            </div>
          </header>

          {step <= 4 && (
            <div className="app-card mb-6 flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--blue), var(--accent-warm))" }}
              >
                <span className="text-white font-black text-xl">M</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold" style={{ color: "var(--fg)" }}>{displayTitle}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{displayStartDate} · {displayCity}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: "var(--fg)" }}>{resolvedFeeDisplay}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{priceResult.phaseName || "Base pricing"}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="card p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Choose Category</h2>
              {categories.length === 0 && (
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  No registration categories are currently open for this conference.
                </p>
              )}
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className="app-card app-card-interactive app-card-tight"
                  data-selected={selectedCategoryId === category.id ? "true" : "false"}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{category.name}</span>
                    <span className="badge badge-blue">{formatMoney(category.basePrice, checkoutCurrency)}</span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--blue)" }}>
                    {getCategoryTypeLabel(category.applicationType)}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{category.description || "No description provided."}</p>
                  {(category.applicationType === "delegate" || category.applicationType === "delegation") && category.pricingPhases.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {category.pricingPhases.map((phase) => {
                        const status = getPhaseStatus(phase, new Date());
                        const badgeClass =
                          status === "Active" ? "badge-green" : status === "Upcoming" ? "badge-blue" : "badge-gray";
                        return (
                          <span key={phase.id} className={`badge ${badgeClass}`}>
                            {phase.name} · {status === "Ended" ? "Ended" : status}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
              <button
                onClick={() => { setAnswers({ fullName, school, phone }); setStep(2); }}
                disabled={!isStep1Valid}
                className="btn btn-primary w-full"
                style={{ opacity: isStep1Valid ? 1 : 0.5 }}
              >
                Continue to Form →
              </button>
            </div>
          )}

          {step === 2 && selectedCategory && (
            <div className="card p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>{selectedCategory.name} Form</h2>
              <div className="rounded-xl p-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--fg)" }}>
                  Category Type: {getCategoryTypeLabel(selectedCategory.applicationType)}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                  {getCategoryTypeHint(selectedCategory.applicationType)}
                </p>
              </div>
              <input value={fullName} onChange={(event) => { setFullName(event.target.value); setAnswers((prev) => ({ ...prev, fullName: event.target.value })); }} className="input-base" placeholder="Full Name" />
              <input value={school} onChange={(event) => { setSchool(event.target.value); setAnswers((prev) => ({ ...prev, school: event.target.value })); }} className="input-base" placeholder="School / University" />
              <input value={phone} onChange={(event) => { setPhone(event.target.value); setAnswers((prev) => ({ ...prev, phone: event.target.value })); }} className="input-base" placeholder="Phone *" required />
              {selectedCategory.formFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                    {field.label} {field.required ? "*" : ""}
                  </label>
                  {field.type === "select" ? (
                    <select className="input-base" value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.value }))}>
                      <option value="">Select option</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea className="input-base" rows={3} value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.value }))} />
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                      <input type="checkbox" checked={Boolean(answers[field.id])} onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.checked }))} />
                      Yes
                    </label>
                  ) : field.type === "file" ? (
                    <div className="space-y-2">
                      <input
                        className="input-base"
                        type="file"
                        multiple={(field.maxFiles || 1) > 1}
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          const maxFiles = field.maxFiles || 1;
                          const maxFileSizeMb = field.maxFileSizeMb || 5;
                          if (files.length > maxFiles) {
                            alert(`You can upload up to ${maxFiles} files.`);
                            event.target.value = "";
                            return;
                          }
                          const overLimit = files.find((file) => file.size > maxFileSizeMb * 1024 * 1024);
                          if (overLimit) {
                            alert(`Each file must be under ${maxFileSizeMb}MB.`);
                            event.target.value = "";
                            return;
                          }
                          const readPromises = files.map(
                            (file) =>
                              new Promise<string>((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
                                reader.onerror = () => reject(new Error("Failed to read file."));
                                reader.readAsDataURL(file);
                              })
                          );
                          Promise.all(readPromises)
                            .then((payload) => {
                              const filtered = payload.filter(Boolean);
                              setUploadedFiles((prev) => ({ ...prev, [field.id]: filtered }));
                              setAnswers((prev) => ({ ...prev, [field.id]: filtered }));
                            })
                            .catch(() => {
                              alert("Could not read one or more files.");
                            });
                        }}
                      />
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        Max files: {field.maxFiles || 1} · Max size per file: {field.maxFileSizeMb || 5}MB
                      </p>
                      {(uploadedFiles[field.id] || []).length > 0 && (
                        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                          {(uploadedFiles[field.id] || []).length} file(s) selected
                        </p>
                      )}
                    </div>
                  ) : (
                    <input className="input-base" type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: field.type === "number" ? Number(event.target.value) : event.target.value }))} placeholder={field.placeholder} />
                  )}
                </div>
              ))}
              {isDelegationCategory && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                    Number of Delegates in this Delegation *
                  </label>
                  <input
                    className="input-base"
                    type="number"
                    min={1}
                    max={selectedCategory?.maxDelegatesPerDelegation}
                    value={answers.delegation_size === undefined ? "" : String(answers.delegation_size)}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setAnswers((prev) => ({
                        ...prev,
                        delegation_size: raw === "" ? "" : Number(raw),
                      }));
                    }}
                    placeholder={
                      selectedCategory?.maxDelegatesPerDelegation
                        ? `Max ${selectedCategory.maxDelegatesPerDelegation}`
                        : "Enter delegation size"
                    }
                  />
                  {selectedCategory?.maxDelegatesPerDelegation && (
                    <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                      Maximum allowed delegates: {selectedCategory.maxDelegatesPerDelegation}
                    </p>
                  )}
                  {!delegationSizeValid && (
                    <div className="alert alert-danger mt-2">
                      <p>
                        Delegation size must be at least 1
                        {selectedCategory?.maxDelegatesPerDelegation
                          ? ` and at most ${selectedCategory.maxDelegatesPerDelegation}.`
                          : "."}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn btn-ghost flex-1">← Back</button>
                <button onClick={() => setStep(3)} disabled={!isStep2Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep2Valid ? 1 : 0.5 }}>
                  Continue to Committee →
                </button>
              </div>
            </div>
          )}

          {step === 3 && selectedCategory && (
            <div className="card p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Committee Selection</h2>
              {selectedCategory.requiresCommitteeSelection ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>First Preference *</label>
                    <select
                      value={selectedCommitteeId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setSelectedCommitteeId(nextId);
                        // Clean up old answers for other committees to avoid bloat, 
                        // but keep standard fields.
                        setAnswers((prev) => {
                          const next = { ...prev };
                          Object.keys(next).forEach((key) => {
                            if (key.startsWith("cq-") && !key.startsWith(`cq-${nextId}-`)) {
                              delete next[key];
                            }
                          });
                          return next;
                        });
                      }}
                      className="input-base"
                    >
                      <option value="">Select first preference</option>
                      {committees.map((committee) => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedCommittee && (selectedCommittee.customQuestions ?? []).length > 0 && (
                    <div className="p-4 rounded-xl space-y-4" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                      <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{selectedCommittee.name} Questions</p>
                      {(selectedCommittee.customQuestions ?? []).map((q) => (
                        <div key={q.id}>
                          <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                            {q.question} {q.required ? "*" : ""}
                          </label>
                          <textarea
                            className="input-base text-xs"
                            rows={2}
                            value={String(answers[`cq-${selectedCommittee.id}-${q.id}`] ?? "")}
                            onChange={(event) => setAnswers((prev) => ({ ...prev, [`cq-${selectedCommittee.id}-${q.id}`]: event.target.value }))}
                            placeholder="Your answer..."
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Second Preference</label>
                    <select value={secondPreferenceCommitteeId} onChange={(event) => setSecondPreferenceCommitteeId(event.target.value)} className="input-base">
                      <option value="">Select second preference</option>
                      {committees.map((committee) => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Third Preference</label>
                    <select value={thirdPreferenceCommitteeId} onChange={(event) => setThirdPreferenceCommitteeId(event.target.value)} className="input-base">
                      <option value="">Select third preference</option>
                      {committees.map((committee) => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedCommitteePortfolios.length > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Portfolio Preference 1</label>
                        <select value={portfolioPreferencePrimary} onChange={(event) => setPortfolioPreferencePrimary(event.target.value)} className="input-base">
                          <option value="">Select portfolio</option>
                          {selectedCommitteePortfolios.map((portfolio) => (
                            <option key={portfolio.id} value={portfolio.name}>{portfolio.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Portfolio Preference 2</label>
                        <select value={portfolioPreferenceSecondary} onChange={(event) => setPortfolioPreferenceSecondary(event.target.value)} className="input-base">
                          <option value="">Select portfolio</option>
                          {selectedCommitteePortfolios.map((portfolio) => (
                            <option key={portfolio.id} value={portfolio.name}>{portfolio.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>No committee selection required for this category.</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn btn-ghost flex-1">← Back</button>
                <button onClick={() => setStep(4)} disabled={!isStep3Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep3Valid ? 1 : 0.5 }}>
                  Continue to Preview →
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="card p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Preview & confirm</h2>
              <p className="text-xs leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                Tidingz records your registration on our servers. Paid conferences use manual payment confirmation by default — complete payment using the instructions on the conference page after submitting.
              </p>
              <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Review your submission</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Name: {fullName || "N/A"}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Phone: {phone || "N/A"}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Category: {selectedCategory?.name || "N/A"}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>Committee: {selectedCommittee?.name || "N/A"}</p>
              </div>
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Resolved fee</span>
                  <span style={{ color: "var(--fg)" }}>{resolvedFeeDisplay}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Pricing phase</span>
                  <span style={{ color: "var(--fg)" }}>{priceResult.phaseName || "Base price"}</span>
                </div>
                {priceResult.status === "ended-phase" && (
                  <p className="text-xs" style={{ color: "var(--warning)" }}>
                    Active phase ended. Using latest ended phase pricing fallback.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="btn btn-ghost flex-1">← Back</button>
                <button onClick={handlePay} disabled={!isStep4Valid || loading} className="btn btn-primary flex-[2]" style={{ opacity: isStep4Valid && !loading ? 1 : 0.5 }}>
                  {loading
                    ? "Submitting..."
                    : priceResult.amount <= 0
                      ? "Confirm free registration"
                      : `Submit registration (${resolvedFeeDisplay})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

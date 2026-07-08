"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AppRouteSkeleton from "@/components/AppRouteSkeleton";
import SignInGate from "@/components/SignInGate";
import { useAuth } from "@/lib/auth-context";
import {
  type Conference,
  OrganizerCommittee,
  Registration,
  RegistrationCategory,
} from "@/lib/types";
import { getPhaseStatus, resolveRegistrationPrice } from "@/lib/pricing";
import { getCategoryTypeLabel } from "@/lib/registration-category-types";
import { preferenceLabelForCommittee } from "@/lib/india-committee-presets";
import { getMarketplaceConferences } from "@/lib/marketplace-conferences";
import { formatMoney } from "@/lib/format-money";
import { downloadRegistrationInvoice } from "@/lib/client/invoice-pdf";
import { createCashfreeOrder, openCashfreeCheckout } from "@/lib/client/cashfree-checkout";
import { CONFERENCES_PATH } from "@/lib/paths";
import { useToast } from "@/components/Toast";
import AppSelect from "@/components/AppSelect";

type Step = 1 | 2 | 3 | 4 | 5;

const createConfirmationId = () => `TZ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, user, authReady, addRegistration, organizerConferences, openAuthModal } = useAuth();
  const toast = useToast();
  const payingOnlineRef = useRef(false);

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
  const [portfolioPreferenceTertiary, setPortfolioPreferenceTertiary] = useState("");
  const [countryPreferencePrimary, setCountryPreferencePrimary] = useState("");
  const [countryPreferenceSecondary, setCountryPreferenceSecondary] = useState("");
  const [countryPreferenceTertiary, setCountryPreferenceTertiary] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | number | boolean | string[]>>({});
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string[]>>({});
  const [catalogConference, setCatalogConference] = useState<Conference | null>(null);
  const [checkoutConfig, setCheckoutConfig] = useState<{
    eventId: string;
    registrationCategories: RegistrationCategory[];
    committees: OrganizerCommittee[];
    currency: string;
    logoImageUrl?: string;
    allocationMode?: "PAY_FIRST" | "ALLOT_FIRST";
  } | null>(null);
  const [checkoutConfigLoaded, setCheckoutConfigLoaded] = useState(false);
  const [submittedRegistration, setSubmittedRegistration] = useState<Registration | null>(null);
  const [submittedPaymentIntentId, setSubmittedPaymentIntentId] = useState<string | null>(null);
  const [payingOnline, setPayingOnline] = useState(false);
  const [delegationSchoolName, setDelegationSchoolName] = useState("");
  const [delegationMaxMembers, setDelegationMaxMembers] = useState("");
  const [delegationInviteLink, setDelegationInviteLink] = useState("");
  const [creatingDelegation, setCreatingDelegation] = useState(false);
  const [emailVerifyBlocked, setEmailVerifyBlocked] = useState(false);
  const [serverDuplicateRegistration, setServerDuplicateRegistration] = useState<Registration | null>(null);

  const eventKey = String(params.id);
  const organizerConference = organizerConferences.find((conference) => conference.id === eventKey);
  const fromLocalList = getMarketplaceConferences(organizerConferences).find(
    (conference) => conference.id === eventKey || conference.slug === eventKey
  );
  const marketplaceConference = fromLocalList ?? catalogConference;
  const resolvedEventId = checkoutConfig?.eventId ?? organizerConference?.id ?? eventKey;
  const existingRegistration =
    user?.registeredConferences?.find((registration) => registration.conferenceId === resolvedEventId) ||
    serverDuplicateRegistration;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/marketplace/${encodeURIComponent(eventKey)}`);
        if (!res.ok) {
          if (!cancelled) setCatalogConference(null);
          return;
        }
        const data = (await res.json()) as { conference?: Conference };
        if (!cancelled) setCatalogConference(data.conference ?? null);
      } catch {
        if (!cancelled) setCatalogConference(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/marketplace/${encodeURIComponent(eventKey)}/checkout-config`);
        if (!res.ok) {
          if (!cancelled) {
            setCheckoutConfig(null);
            setCheckoutConfigLoaded(true);
          }
          return;
        }
        const data = (await res.json()) as {
          eventId?: string;
          registrationCategories?: RegistrationCategory[];
          committees?: OrganizerCommittee[];
          currency?: string;
          logoImageUrl?: string;
          allocationMode?: "PAY_FIRST" | "ALLOT_FIRST";
        };
        if (!cancelled) {
          setCheckoutConfig({
            eventId: data.eventId ?? eventKey,
            registrationCategories: data.registrationCategories ?? [],
            committees: data.committees ?? [],
            currency: data.currency?.trim() || "INR",
            logoImageUrl: data.logoImageUrl,
            allocationMode: data.allocationMode,
          });
          setCheckoutConfigLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setCheckoutConfig(null);
          setCheckoutConfigLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventKey]);

  useEffect(() => {
    if (!authReady) return;
    if (!isLoggedIn) {
      openAuthModal();
      return;
    }
    if (user?.role === "organizer") {
      router.push(`/conference/${String(params.id)}`);
    }
  }, [authReady, isLoggedIn, openAuthModal, user?.role, router, params.id]);

  const displayTitle = organizerConference?.title || marketplaceConference?.title || "Conference";
  const displayCity = organizerConference?.city || marketplaceConference?.city || "";
  const displayStartDate = organizerConference?.startDate || marketplaceConference?.startDate || "";
  const displayLogoUrl =
    organizerConference?.logoImageUrl ||
    checkoutConfig?.logoImageUrl ||
    marketplaceConference?.logoImageUrl ||
    "";
  const allocationMode =
    organizerConference?.allocationMode || checkoutConfig?.allocationMode || "PAY_FIRST";
  const isAllotFirst = allocationMode === "ALLOT_FIRST";
  // Country is optional for registration (can be filled later for invoices).
  const profileIncomplete =
    Boolean(user) &&
    (!(user?.name || "").trim() || !(user?.school || "").trim() || !(user?.phone || "").trim());
  const checkoutCurrency =
    (typeof organizerConference?.currency === "string" && organizerConference.currency.trim()
      ? organizerConference.currency.trim()
      : null) ||
    checkoutConfig?.currency ||
    marketplaceConference?.currency?.trim() ||
    "INR";

  const rawCategories: RegistrationCategory[] = organizerConference
    ? organizerConference.registrationCategories
    : checkoutConfig?.registrationCategories ?? [];
  const categories = rawCategories.filter((category) => category.isOpen !== false);

  const committees: OrganizerCommittee[] = organizerConference
    ? organizerConference.committees
    : checkoutConfig?.committees.length
      ? checkoutConfig.committees
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
  const applicationType = selectedCategory?.applicationType || "delegate";
  const isOcCategory = applicationType === "organizer";
  const isChairCategory = applicationType === "chair";
  const isDelegationCategory = applicationType === "delegation";
  const isPressCategory = applicationType === "press";
  /** Step 2: preferences — skipped for OC registration. */
  const needsPreferencesStep = Boolean(selectedCategory) && !isOcCategory;
  /** Step 3: custom questions — only when the category has form fields (or delegation size). */
  const needsQuestionsStep =
    Boolean(selectedCategory) &&
    ((selectedCategory?.formFields?.length ?? 0) > 0 || isDelegationCategory);
  const needsPortfolioPrefs =
    needsPreferencesStep && (applicationType === "delegate" || applicationType === "delegation");
  const pressCommittees = committees.filter(
    (committee) =>
      committee.committeeFormat === "PRESS_CORPS" ||
      committee.committeeFormat === "IP" ||
      committee.customTypeLabel?.toLowerCase().includes("press")
  );
  const checkoutCommittees = isPressCategory && pressCommittees.length > 0 ? pressCommittees : committees;
  const requiredCommitteePrefs = Math.min(3, Math.max(1, checkoutCommittees.length || 1));
  const requiredPortfolioPrefs = Math.min(3, Math.max(0, selectedCommitteePortfolios.length));
  const preferenceLabel = selectedCommittee
    ? preferenceLabelForCommittee(selectedCommittee.committeeType, selectedCommittee.committeeFormat)
    : "Country";
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

  const committeeOptionLabel = (committee: OrganizerCommittee) => {
    if (!selectedCategory) return committee.name;
    const { amount } = resolveRegistrationPrice(selectedCategory, committee.id);
    return `${committee.name} — ${formatMoney(amount, checkoutCurrency)}`;
  };

  const committeeQuestionsValid = (() => {
    if (!selectedCommittee) return true;
    return (selectedCommittee.customQuestions ?? []).every(
      (q) => !q.required || (answers[`cq-${selectedCommittee.id}-${q.id}`] !== undefined && String(answers[`cq-${selectedCommittee.id}-${q.id}`]).trim() !== "")
    );
  })();

  const startOnlinePayment = async (paymentIntentId: string, amount: number): Promise<boolean> => {
    if (amount <= 0) return true;
    if (payingOnlineRef.current) return false;
    payingOnlineRef.current = true;
    setPayingOnline(true);
    try {
      const order = await createCashfreeOrder({
        paymentIntentId,
        eventId: organizerConference?.id ?? checkoutConfig?.eventId ?? String(params.id),
        customerPhone: phone.trim(),
      });
      await openCashfreeCheckout(order.paymentSessionId);
      return true;
    } catch (error) {
      toast.show(error instanceof Error ? error.message : "Could not start payment.", "error");
      return false;
    } finally {
      payingOnlineRef.current = false;
      setPayingOnline(false);
    }
  };

  const handlePay = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    try {
      const registrationId = createConfirmationId();
      const formAnswers = {
        fullName: fullName.trim(),
        school: school.trim(),
        phone: phone.trim(),
        ...answers,
      };
      const res = await fetch("/api/registrations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId,
          eventId: organizerConference?.id ?? checkoutConfig?.eventId ?? String(params.id),
          categoryId: selectedCategory.id,
          categoryName: selectedCategory.name,
          fullName: fullName.trim(),
          school: school.trim(),
          phone: phone.trim(),
          committeeConfigId: selectedCommitteeId || undefined,
          committeeName: selectedCommittee?.name,
          committeePreferences: [selectedCommitteeId, secondPreferenceCommitteeId, thirdPreferenceCommitteeId].filter(
            Boolean
          ),
          countryPreferences: [
            countryPreferencePrimary,
            countryPreferenceSecondary,
            countryPreferenceTertiary,
          ].filter(Boolean),
          portfolioPreferencesByCommittee: selectedCommitteeId
            ? {
                [selectedCommitteeId]: [
                  portfolioPreferencePrimary,
                  portfolioPreferenceSecondary,
                  portfolioPreferenceTertiary,
                ].filter(Boolean),
              }
            : {},
          formAnswers,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        clientRegistration?: Registration;
        existingRegistrationId?: string;
        registration?: {
          paymentIntentId?: string;
          paid?: boolean;
          amount?: number;
        };
      };
      if (res.status === 403 && payload.code === "EMAIL_NOT_VERIFIED") {
        setEmailVerifyBlocked(true);
        return;
      }
      if (res.status === 409) {
        const duplicate =
          user?.registeredConferences?.find(
            (registration) =>
              registration.id === payload.existingRegistrationId ||
              registration.conferenceId === String(params.id)
          ) ?? null;
        setServerDuplicateRegistration(
          duplicate ?? {
            id: payload.existingRegistrationId || "existing",
            conferenceId: String(params.id),
            conferenceTitle: displayTitle,
            categoryId: selectedCategory.id,
            categoryName: selectedCategory.name,
            formAnswers: {},
            status: "Pending",
            registeredAt: new Date().toISOString(),
            paid: false,
            amount: priceResult.amount,
          }
        );
        return;
      }
      if (!res.ok || !payload.clientRegistration) {
        toast.show(
          payload.error ||
            "Registration failed. If this conference was created only on this device, publish it from the organizer dashboard so it exists on the server.",
          "error"
        );
        return;
      }
      addRegistration(payload.clientRegistration);
      setSubmittedRegistration(payload.clientRegistration);
      const paymentIntentId = payload.registration?.paymentIntentId ?? null;
      setSubmittedPaymentIntentId(paymentIntentId);

      const shouldPayOnline =
        !isAllotFirst &&
        priceResult.amount > 0 &&
        !payload.clientRegistration.paid &&
        Boolean(paymentIntentId);

      if (shouldPayOnline && paymentIntentId) {
        await startOnlinePayment(paymentIntentId, priceResult.amount);
      }

      setStep(5);
    } finally {
      setLoading(false);
    }
  };

  const isStep1Valid =
    !!selectedCategoryId &&
    fullName.trim().length > 0 &&
    school.trim().length > 0 &&
    phone.trim().length > 0;
  const committeePrefValues = [
    selectedCommitteeId,
    secondPreferenceCommitteeId,
    thirdPreferenceCommitteeId,
  ].slice(0, requiredCommitteePrefs);
  const portfolioPrefValues = [
    portfolioPreferencePrimary,
    portfolioPreferenceSecondary,
    portfolioPreferenceTertiary,
  ].slice(0, requiredPortfolioPrefs);
  const isPreferencesValid =
    !needsPreferencesStep ||
    (committeePrefValues.every(Boolean) &&
      committeeQuestionsValid &&
      (!needsPortfolioPrefs ||
        selectedCommitteePortfolios.length === 0 ||
        (portfolioPrefValues.length === requiredPortfolioPrefs &&
          portfolioPrefValues.every(Boolean))));
  const isQuestionsValid =
    !needsQuestionsStep ||
    (!!selectedCategory &&
      selectedCategory.formFields.every(
        (field) =>
          !field.required ||
          (answers[field.id] !== undefined && String(answers[field.id]).trim() !== "")
      ) &&
      delegationSizeValid);
  const isStep4Valid = isStep1Valid && isPreferencesValid && isQuestionsValid;

  const goForwardFrom = (from: Step) => {
    if (from === 1) {
      if (needsPreferencesStep) setStep(2);
      else if (needsQuestionsStep) setStep(3);
      else setStep(4);
      return;
    }
    if (from === 2) {
      if (needsQuestionsStep) setStep(3);
      else setStep(4);
      return;
    }
    if (from === 3) setStep(4);
  };

  const goBackFrom = (from: Step) => {
    if (from === 4) {
      if (needsQuestionsStep) setStep(3);
      else if (needsPreferencesStep) setStep(2);
      else setStep(1);
      return;
    }
    if (from === 3) {
      if (needsPreferencesStep) setStep(2);
      else setStep(1);
      return;
    }
    if (from === 2) setStep(1);
  };

  if (!authReady || (!organizerConference && !checkoutConfigLoaded)) {
    return <AppRouteSkeleton />;
  }

  if (!isLoggedIn) {
    return (
      <>
        <Navbar />
        <SignInGate
          title="Sign in to register"
          description={`Sign in or create an account to complete registration for ${displayTitle}.`}
          onSignIn={openAuthModal}
          backHref={`/conference/${eventKey}`}
          backLabel="Back to conference"
        />
        <Footer />
      </>
    );
  }

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

  if (!organizerConference && checkoutConfigLoaded && !checkoutConfig) {
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
                <Link href={CONFERENCES_PATH} className="btn btn-primary">
                  Back to conferences
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
                {step === 5 ? "Checkout · Complete" : `Checkout · Step ${step}/4`}
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

          {existingRegistration && step < 5 && (
            <div
              className="rounded-xl px-4 py-4 mb-6"
              style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                You are already registered for this conference
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                Status: {existingRegistration.status}
                {existingRegistration.paid ? " · Paid" : " · Payment pending"}
              </p>
              <Link href="/dashboard" className="btn btn-primary text-xs mt-3 inline-flex">
                Go to dashboard
              </Link>
            </div>
          )}

          {emailVerifyBlocked && (
            <div
              className="rounded-xl px-4 py-4 mb-6"
              style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.35)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                Please verify your email first
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                Verify your email from the delegate dashboard, then return to complete registration.
              </p>
              <Link href="/dashboard" className="btn btn-primary text-xs mt-3 inline-flex">
                Open dashboard
              </Link>
            </div>
          )}

          {profileIncomplete && !existingRegistration && (
            <div
              className="rounded-xl px-4 py-4 mb-6"
              style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.35)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                Complete your profile before registering
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                Add your name, school, and phone on your dashboard, then return to register.
              </p>
              <Link href="/dashboard?tab=profile" className="btn btn-primary text-xs mt-3 inline-flex">
                Complete profile
              </Link>
            </div>
          )}

          {step <= 4 && !existingRegistration && (
            <div className="app-card mb-6 flex items-center gap-4">
              {displayLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayLogoUrl}
                  alt={`${displayTitle} logo`}
                  className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--blue), var(--accent-warm))" }}
                >
                  <span className="text-white font-black text-xl">
                    {displayTitle.slice(0, 1).toUpperCase() || "M"}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base" style={{ color: "var(--fg)" }}>{displayTitle}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{displayStartDate} · {displayCity}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: "var(--fg)" }}>{resolvedFeeDisplay}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{priceResult.phaseName || "Base pricing"}</p>
              </div>
            </div>
          )}

          {step === 1 && !existingRegistration && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>1. Category &amp; contact</h2>
              {categories.length === 0 && (
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  No registration categories are currently open for this conference.
                </p>
              )}
              {categories.map((category) => {
                const categoryPrice = resolveRegistrationPrice(category, undefined);
                return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(category.id)}
                  className="app-card app-card-interactive app-card-tight text-left"
                  data-selected={selectedCategoryId === category.id ? "true" : "false"}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-base" style={{ color: "var(--fg)" }}>{category.name}</span>
                    <div className="text-right">
                      <span className="badge badge-blue">
                        {formatMoney(categoryPrice.amount, checkoutCurrency)}
                      </span>
                      {categoryPrice.phaseName && (
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--fg-muted)" }}>
                          {categoryPrice.phaseName}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-1" style={{ color: "var(--blue)" }}>
                    {getCategoryTypeLabel(category.applicationType)}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{category.description || "No description provided."}</p>
                  {category.pricingPhases.length > 0 && (
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
                );
              })}
              <div className="space-y-3 pt-2">
                <input
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setAnswers((prev) => ({ ...prev, fullName: event.target.value }));
                  }}
                  className="input-base text-base min-h-[44px]"
                  placeholder="Full name *"
                />
                <input
                  value={school}
                  onChange={(event) => {
                    setSchool(event.target.value);
                    setAnswers((prev) => ({ ...prev, school: event.target.value }));
                  }}
                  className="input-base text-base min-h-[44px]"
                  placeholder="School / University *"
                />
                <input
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setAnswers((prev) => ({ ...prev, phone: event.target.value }));
                  }}
                  className="input-base text-base min-h-[44px]"
                  placeholder="Phone *"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setAnswers((prev) => ({ ...prev, fullName, school, phone }));
                  goForwardFrom(1);
                }}
                disabled={!isStep1Valid || profileIncomplete}
                className="btn btn-primary w-full min-h-[44px]"
                style={{ opacity: isStep1Valid && !profileIncomplete ? 1 : 0.5 }}
              >
                Continue →
              </button>
            </div>
          )}

          {step === 2 && !existingRegistration && selectedCategory && needsPreferencesStep && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>2. Preferences</h2>
              <div className="rounded-xl p-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                  {getCategoryTypeLabel(selectedCategory.applicationType)}
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                  {isChairCategory
                    ? `Choose ${requiredCommitteePrefs} committee preference${requiredCommitteePrefs === 1 ? "" : "s"}.`
                    : `Choose ${requiredCommitteePrefs} committee preference${requiredCommitteePrefs === 1 ? "" : "s"}${
                        needsPortfolioPrefs && requiredPortfolioPrefs > 0
                          ? ` and ${requiredPortfolioPrefs} portfolio preference${requiredPortfolioPrefs === 1 ? "" : "s"}`
                          : ""
                      }.`}
                </p>
              </div>
              <div className="space-y-4">
                <AppSelect
                  label={`Committee preference 1 *`}
                  value={selectedCommitteeId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setSelectedCommitteeId(nextId);
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
                >
                  <option value="">Select first preference</option>
                  {checkoutCommittees.map((committee) => (
                    <option key={committee.id} value={committee.id}>
                      {committeeOptionLabel(committee)}
                    </option>
                  ))}
                </AppSelect>
                {selectedCommittee && (selectedCommittee.customQuestions ?? []).length > 0 && (
                  <div className="p-4 rounded-xl space-y-4" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                    <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{selectedCommittee.name} Questions</p>
                    {(selectedCommittee.customQuestions ?? []).map((q) => (
                      <div key={q.id}>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                          {q.question} {q.required ? "*" : ""}
                        </label>
                        <textarea
                          className="input-base text-sm min-h-[44px]"
                          rows={2}
                          value={String(answers[`cq-${selectedCommittee.id}-${q.id}`] ?? "")}
                          onChange={(event) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [`cq-${selectedCommittee.id}-${q.id}`]: event.target.value,
                            }))
                          }
                          placeholder="Your answer..."
                        />
                      </div>
                    ))}
                  </div>
                )}
                {requiredCommitteePrefs >= 2 && (
                  <AppSelect
                    label="Committee preference 2 *"
                    value={secondPreferenceCommitteeId}
                    onChange={(event) => setSecondPreferenceCommitteeId(event.target.value)}
                  >
                    <option value="">Select second preference</option>
                    {checkoutCommittees
                      .filter((committee) => committee.id !== selectedCommitteeId)
                      .map((committee) => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                  </AppSelect>
                )}
                {requiredCommitteePrefs >= 3 && (
                  <AppSelect
                    label="Committee preference 3 *"
                    value={thirdPreferenceCommitteeId}
                    onChange={(event) => setThirdPreferenceCommitteeId(event.target.value)}
                  >
                    <option value="">Select third preference</option>
                    {checkoutCommittees
                      .filter(
                        (committee) =>
                          committee.id !== selectedCommitteeId &&
                          committee.id !== secondPreferenceCommitteeId
                      )
                      .map((committee) => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                  </AppSelect>
                )}
                {needsPortfolioPrefs && requiredPortfolioPrefs > 0 && (
                  <>
                    <AppSelect
                      label={`${preferenceLabel} preference 1 *`}
                      value={portfolioPreferencePrimary}
                      onChange={(event) => {
                        setPortfolioPreferencePrimary(event.target.value);
                        setCountryPreferencePrimary(event.target.value);
                      }}
                    >
                      <option value="">Select portfolio</option>
                      {selectedCommitteePortfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.name}>{portfolio.name}</option>
                      ))}
                    </AppSelect>
                    {requiredPortfolioPrefs >= 2 && (
                      <AppSelect
                        label={`${preferenceLabel} preference 2 *`}
                        value={portfolioPreferenceSecondary}
                        onChange={(event) => {
                          setPortfolioPreferenceSecondary(event.target.value);
                          setCountryPreferenceSecondary(event.target.value);
                        }}
                      >
                        <option value="">Select portfolio</option>
                        {selectedCommitteePortfolios
                          .filter((portfolio) => portfolio.name !== portfolioPreferencePrimary)
                          .map((portfolio) => (
                            <option key={portfolio.id} value={portfolio.name}>{portfolio.name}</option>
                          ))}
                      </AppSelect>
                    )}
                    {requiredPortfolioPrefs >= 3 && (
                      <AppSelect
                        label={`${preferenceLabel} preference 3 *`}
                        value={portfolioPreferenceTertiary}
                        onChange={(event) => {
                          setPortfolioPreferenceTertiary(event.target.value);
                          setCountryPreferenceTertiary(event.target.value);
                        }}
                      >
                        <option value="">Select portfolio</option>
                        {selectedCommitteePortfolios
                          .filter(
                            (portfolio) =>
                              portfolio.name !== portfolioPreferencePrimary &&
                              portfolio.name !== portfolioPreferenceSecondary
                          )
                          .map((portfolio) => (
                            <option key={portfolio.id} value={portfolio.name}>{portfolio.name}</option>
                          ))}
                      </AppSelect>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => goBackFrom(2)} className="btn btn-ghost flex-1 min-h-[44px]">← Back</button>
                <button
                  type="button"
                  onClick={() => goForwardFrom(2)}
                  disabled={!isPreferencesValid}
                  className="btn btn-primary flex-[2] min-h-[44px]"
                  style={{ opacity: isPreferencesValid ? 1 : 0.5 }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 3 && !existingRegistration && selectedCategory && needsQuestionsStep && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>3. Additional questions</h2>
              {selectedCategory.formFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                    {field.label} {field.required ? "*" : ""}
                  </label>
                  {field.type === "select" ? (
                    <AppSelect
                      value={String(answers[field.id] ?? "")}
                      onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.value }))}
                    >
                      <option value="">Select option</option>
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </AppSelect>
                  ) : field.type === "textarea" ? (
                    <textarea
                      className="input-base text-base"
                      rows={3}
                      value={String(answers[field.id] ?? "")}
                      onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.value }))}
                    />
                  ) : field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm min-h-[44px]" style={{ color: "var(--fg-muted)" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(answers[field.id])}
                        onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.checked }))}
                      />
                      Yes
                    </label>
                  ) : field.type === "file" ? (
                    <div className="space-y-2">
                      <input
                        className="input-base min-h-[44px]"
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
                    <input
                      className="input-base text-base min-h-[44px]"
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      value={String(answers[field.id] ?? "")}
                      onChange={(event) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [field.id]: field.type === "number" ? Number(event.target.value) : event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
              {isDelegationCategory && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>
                    Number of delegates in this delegation *
                  </label>
                  <input
                    className="input-base text-base min-h-[44px]"
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
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => goBackFrom(3)} className="btn btn-ghost flex-1 min-h-[44px]">← Back</button>
                <button
                  type="button"
                  onClick={() => goForwardFrom(3)}
                  disabled={!isQuestionsValid}
                  className="btn btn-primary flex-[2] min-h-[44px]"
                  style={{ opacity: isQuestionsValid ? 1 : 0.5 }}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 4 && !existingRegistration && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
                {isAllotFirst || priceResult.amount <= 0 ? "4. Confirm application" : "4. Payment"}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                {isAllotFirst
                  ? "This conference uses allot-first mode. You can submit your application now and pay after you receive an allotment."
                  : priceResult.amount <= 0
                    ? "Review your details and confirm your free registration."
                    : "Review your details and complete payment to submit your application."}
              </p>
              <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>Review your submission</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Name: {fullName || "N/A"}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Phone: {phone || "N/A"}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Category: {selectedCategory?.name || "N/A"}</p>
                {!isOcCategory && (
                  <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Committee: {selectedCommittee?.name || "N/A"}</p>
                )}
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
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => goBackFrom(4)} className="btn btn-ghost flex-1 min-h-[44px]">← Back</button>
                <button
                  type="button"
                  onClick={() => void handlePay()}
                  disabled={!isStep4Valid || loading || profileIncomplete}
                  className="btn btn-primary flex-[2] min-h-[44px]"
                  style={{ opacity: isStep4Valid && !loading && !profileIncomplete ? 1 : 0.5 }}
                >
                  {loading
                    ? "Submitting..."
                    : priceResult.amount <= 0 || isAllotFirst
                      ? isAllotFirst
                        ? "Submit application"
                        : "Confirm free registration"
                      : `Submit & pay (${resolvedFeeDisplay})`}
                </button>
              </div>
            </div>
          )}

          {step === 5 && submittedRegistration && (
            <div className="card p-8 rounded-2xl space-y-5">
              <div className="text-center space-y-2">
                <p className="text-4xl" aria-hidden>
                  ✓
                </p>
                <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
                  Registration submitted!
                </h2>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  Your application for {displayTitle} has been recorded.
                </p>
              </div>
              <div className="rounded-xl p-4 space-y-1" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                  Registration summary
                </p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Registration ID: {submittedRegistration.id}
                </p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Category: {submittedRegistration.categoryName}
                </p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Fee: {formatMoney(submittedRegistration.amount, checkoutCurrency)} ·{" "}
                  {submittedRegistration.paid ? "Paid" : "Payment pending"}
                </p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Registered: {submittedRegistration.registeredAt}
                </p>
              </div>
              {!submittedRegistration.paid && submittedPaymentIntentId && submittedRegistration.amount > 0 && (
                <button
                  type="button"
                  className="btn btn-primary w-full"
                  disabled={payingOnline}
                  onClick={() => {
                    void startOnlinePayment(submittedPaymentIntentId, submittedRegistration.amount);
                  }}
                >
                  {payingOnline
                    ? "Opening payment..."
                    : `Pay now (${formatMoney(submittedRegistration.amount, checkoutCurrency)})`}
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline-blue w-full"
                disabled={!submittedRegistration?.paid}
                title={submittedRegistration?.paid ? undefined : "Pay first to download invoice"}
                onClick={() => {
                  if (!user || !submittedRegistration?.paid) return;
                  void downloadRegistrationInvoice(submittedRegistration, {
                    name: user.name,
                    email: user.email,
                    invoiceAddress: user.invoiceAddress,
                  }).catch((error) => {
                    toast.show(
                      error instanceof Error ? error.message : "Could not download invoice.",
                      "error"
                    );
                  });
                }}
              >
                {submittedRegistration?.paid ? "Download Invoice (PDF)" : "Invoice available after payment"}
              </button>
              {submittedRegistration.categoryName?.toLowerCase().includes("delegation") ||
              selectedCategory?.applicationType === "delegation" ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                    Create your delegation
                  </p>
                  {delegationInviteLink ? (
                    <div className="space-y-2">
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        Share this link with your delegation members:
                      </p>
                      <input className="input-base text-xs" readOnly value={delegationInviteLink} />
                    </div>
                  ) : (
                    <>
                      <input
                        className="input-base text-xs"
                        placeholder="School / institution name"
                        value={delegationSchoolName}
                        onChange={(event) => setDelegationSchoolName(event.target.value)}
                      />
                      <input
                        className="input-base text-xs"
                        type="number"
                        min={1}
                        placeholder="Max members (optional)"
                        value={delegationMaxMembers}
                        onChange={(event) => setDelegationMaxMembers(event.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-primary text-xs w-full"
                        disabled={!delegationSchoolName.trim() || creatingDelegation}
                        onClick={() => {
                          setCreatingDelegation(true);
                          void fetch("/api/delegations", {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              eventId: String(params.id),
                              schoolName: delegationSchoolName.trim(),
                              maxMembers: delegationMaxMembers ? Number(delegationMaxMembers) : undefined,
                              registrationId: submittedRegistration.id,
                            }),
                          })
                            .then(async (res) => {
                              const data = (await res.json()) as {
                                delegation?: { inviteToken?: string };
                                error?: string;
                              };
                              const token = data.delegation?.inviteToken;
                              if (!res.ok || !token) {
                                toast.show(data.error || "Could not create delegation.", "error");
                                return;
                              }
                              setDelegationInviteLink(
                                `${window.location.origin}/join/delegation/${token}`
                              );
                              toast.show("Delegation created. Share the invite link with your team.", "success");
                            })
                            .finally(() => setCreatingDelegation(false));
                        }}
                      >
                        {creatingDelegation ? "Creating…" : "Create delegation & get invite link"}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
              <p className="text-xs text-center" style={{ color: "var(--fg-muted)" }}>
                Your digital pass will be issued after the organizer completes allotment.
              </p>
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => router.push("/dashboard#conferences")}
              >
                Track my registration
              </button>
              <button
                type="button"
                className="btn btn-ghost w-full"
                onClick={() => router.push("/dashboard")}
              >
                Go to dashboard
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}

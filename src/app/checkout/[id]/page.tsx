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
import { getCategoryTypeHint, getCategoryTypeLabel } from "@/lib/registration-category-types";
import { preferenceLabelForCommittee } from "@/lib/india-committee-presets";
import { getMarketplaceConferences } from "@/lib/marketplace-conferences";
import { formatMoney } from "@/lib/format-money";
import { downloadRegistrationInvoice } from "@/lib/client/invoice-pdf";
import { createCashfreeOrder, openCashfreeCheckout } from "@/lib/client/cashfree-checkout";
import { CONFERENCES_PATH } from "@/lib/paths";
import { useToast } from "@/components/Toast";
import AppSelect from "@/components/AppSelect";
import { normalizeDelegationCode } from "@/lib/delegation-code";

type Step = 1 | 2 | 3 | 4 | 5;

type DelegationAffiliation = {
  id: string;
  code: string;
  name?: string | null;
  schoolName?: string | null;
  maxMembers?: number | null;
  memberCount?: number;
  status: string;
  isHead: boolean;
};

const createConfirmationId = () => `TZ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, user, authReady, addRegistration, organizerConferences, openAuthModal } = useAuth();
  const toast = useToast();
  const payingOnlineRef = useRef(false);

  const [step, setStep] = useState<Step>(1);
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
  const [delegationJoinCode, setDelegationJoinCode] = useState("");
  const [delegationMode, setDelegationMode] = useState<"create" | "join" | null>(null);
  const [delegationAffiliation, setDelegationAffiliation] =
    useState<DelegationAffiliation | null>(null);
  const [delegationLoading, setDelegationLoading] = useState(false);
  const [delegationError, setDelegationError] = useState("");
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

  useEffect(() => {
    if (!authReady || !isLoggedIn || !resolvedEventId || user?.role === "organizer") return;
    let cancelled = false;
    setDelegationLoading(true);
    void fetch(`/api/delegations?eventId=${encodeURIComponent(resolvedEventId)}`, {
      credentials: "include",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          delegation?: DelegationAffiliation | null;
        };
        if (!cancelled && response.ok) {
          setDelegationAffiliation(payload.delegation ?? null);
          if (payload.delegation?.code) setDelegationJoinCode(payload.delegation.code);
        }
      })
      .finally(() => {
        if (!cancelled) setDelegationLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, isLoggedIn, resolvedEventId, user?.role]);

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
  const fullName =
    [user?.firstName, user?.lastName].filter((value) => value?.trim()).join(" ").trim() ||
    user?.name?.trim() ||
    "";
  const school = user?.school?.trim() || "";
  const phone = user?.phone?.trim() || "";
  const normalizedPhone = phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  const profileComplete = Boolean(
    user?.firstName?.trim() &&
      user?.lastName?.trim() &&
      user?.school?.trim() &&
      user?.country?.trim() &&
      /^[6-9]\d{9}$/.test(normalizedPhone)
  );
  const profileIncomplete = Boolean(user) && !profileComplete;
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
  const delegationCategoryId =
    categories.find((category) => category.applicationType === "delegation")?.id || "";

  useEffect(() => {
    if (delegationAffiliation && delegationCategoryId && !selectedCategoryId) {
      setSelectedCategoryId(delegationCategoryId);
    }
  }, [delegationAffiliation, delegationCategoryId, selectedCategoryId]);

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
  const applicationType = selectedCategory?.applicationType || "delegate";
  const isOcCategory = applicationType === "organizer" || applicationType === "secretariat";
  const isChairCategory = applicationType === "chair";
  const isDelegationCategory = applicationType === "delegation";
  const isPressCategory = applicationType === "press";

  useEffect(() => {
    if (isDelegationCategory && !delegationAffiliation && delegationMode === null) {
      setDelegationMode("create");
      if (!delegationSchoolName && school) setDelegationSchoolName(school);
    }
    if (!isDelegationCategory && delegationMode !== null) {
      setDelegationMode(null);
      setDelegationError("");
    }
  }, [isDelegationCategory, delegationAffiliation, delegationMode, delegationSchoolName, school]);

  /** Step 2: preferences — skipped only for organizer / secretariat (no committee allotment). */
  const needsPreferencesStep = Boolean(selectedCategory) && !isOcCategory;
  /** Step 3 is always part of the 4-step flow; empty when no organizer questions. */
  const hasCategoryQuestions = (selectedCategory?.formFields?.length ?? 0) > 0;
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

  const committeeQuestionsValid = true;

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
        country: user?.country?.trim() || "",
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
          delegationCode: isDelegationCategory ? delegationAffiliation?.code : undefined,
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
    profileComplete &&
    (!isDelegationCategory || delegationAffiliation?.status === "OPEN");
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
    !hasCategoryQuestions ||
    (!!selectedCategory &&
      selectedCategory.formFields.every(
        (field) =>
          !field.required ||
          (answers[field.id] !== undefined && String(answers[field.id]).trim() !== "")
      ));
  const isStep4Valid = isStep1Valid && isPreferencesValid && isQuestionsValid;

  const goForwardFrom = (from: Step) => {
    if (from === 1) {
      setStep(needsPreferencesStep ? 2 : 3);
      return;
    }
    if (from === 2) {
      setStep(3);
      return;
    }
    if (from === 3) setStep(4);
  };

  const goBackFrom = (from: Step) => {
    if (from === 4) {
      setStep(3);
      return;
    }
    if (from === 3) {
      setStep(needsPreferencesStep ? 2 : 1);
      return;
    }
    if (from === 2) setStep(1);
  };

  const refreshDelegationAffiliation = async () => {
    const response = await fetch(
      `/api/delegations?eventId=${encodeURIComponent(resolvedEventId)}`,
      { credentials: "include" }
    );
    const payload = (await response.json().catch(() => ({}))) as {
      delegation?: DelegationAffiliation | null;
      error?: string;
    };
    if (!response.ok) throw new Error(payload.error || "Could not load delegation.");
    setDelegationAffiliation(payload.delegation ?? null);
    if (payload.delegation?.code) setDelegationJoinCode(payload.delegation.code);
    return payload.delegation ?? null;
  };

  const handleCreateDelegation = async () => {
    const schoolName = delegationSchoolName.trim() || school;
    if (!schoolName) {
      setDelegationError("Enter your school or institution name.");
      return;
    }
    const maxMembers = delegationMaxMembers ? Number(delegationMaxMembers) : undefined;
    if (
      maxMembers !== undefined &&
      selectedCategory?.maxDelegatesPerDelegation &&
      maxMembers > selectedCategory.maxDelegatesPerDelegation
    ) {
      setDelegationError(
        `This conference allows at most ${selectedCategory.maxDelegatesPerDelegation} students per delegation.`
      );
      return;
    }
    setDelegationError("");
    setCreatingDelegation(true);
    try {
      const response = await fetch("/api/delegations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: resolvedEventId,
          schoolName,
          maxMembers,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        delegation?: DelegationAffiliation & { inviteToken?: string };
        error?: string;
      };
      if (!response.ok || !payload.delegation) {
        throw new Error(payload.error || "Could not create delegation.");
      }
      const code = payload.delegation.code || payload.delegation.inviteToken || "";
      setDelegationAffiliation({ ...payload.delegation, code });
      setDelegationJoinCode(code);
      toast.show("Team code generated. Share it with your teammates.", "success");
    } catch (error) {
      setDelegationError(error instanceof Error ? error.message : "Could not create delegation.");
    } finally {
      setCreatingDelegation(false);
    }
  };

  const handleJoinDelegation = async () => {
    const code = normalizeDelegationCode(delegationJoinCode);
    if (!code) {
      setDelegationError("Enter the team code shared by your delegation head.");
      return;
    }
    setDelegationError("");
    setDelegationLoading(true);
    try {
      const response = await fetch(`/api/delegations/join/${encodeURIComponent(code)}`, {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not join delegation.");
      await refreshDelegationAffiliation();
      toast.show("You joined the delegation. Continue with your own preferences and payment.", "success");
    } catch (error) {
      setDelegationError(error instanceof Error ? error.message : "Could not join delegation.");
    } finally {
      setDelegationLoading(false);
    }
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
            <div className="app-header-copy flex items-start gap-4">
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
              <div className="min-w-0">
                <div className="section-label mb-3">
                  {step === 5 ? "Checkout · Complete" : `Checkout · Step ${Math.min(step, 4)}/4`}
                </div>
                <h1 className="app-title">Complete Your Registration</h1>
                <p className="app-subtitle mt-2">{displayTitle}</p>
              </div>
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
            <div className="card p-6 rounded-2xl mb-6">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>
                Complete your profile first
              </h2>
              <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
                First name, last name, school, country, and a valid mobile number are required before you can register.
              </p>
              <Link href="/dashboard?tab=profile" className="btn btn-primary mt-4 inline-flex">
                Go to Profile
              </Link>
            </div>
          )}

          {step <= 4 && !existingRegistration && !profileIncomplete && (
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

          {step === 1 && !existingRegistration && !profileIncomplete && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>1. Select a category</h2>
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
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    if (category.applicationType === "delegation") {
                      setDelegationMode("create");
                      setDelegationError("");
                      if (!delegationSchoolName && school) setDelegationSchoolName(school);
                    }
                  }}
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
                        <p className="text-xs sm:text-sm mt-0.5 font-medium" style={{ color: "var(--blue)" }}>
                          {categoryPrice.phaseName}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm mt-1" style={{ color: "var(--blue)" }}>
                    {getCategoryTypeLabel(category.applicationType)}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{category.description || "No description provided."}</p>
                  {category.applicationType === "delegation" && (
                    <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                      {getCategoryTypeHint("delegation")}
                    </p>
                  )}
                  {category.pricingPhases.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {category.pricingPhases.map((phase) => {
                        const status = getPhaseStatus(phase, new Date());
                        const badgeClass =
                          status === "Active" ? "badge-green" : status === "Upcoming" ? "badge-blue" : "badge-gray";
                        return (
                          <div key={phase.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                              {phase.name}
                            </span>
                            <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
                              {formatMoney(phase.basePrice, checkoutCurrency)}
                            </span>
                            <span className={`badge text-xs sm:text-sm ${badgeClass}`}>
                              {status === "Ended" ? "Ended" : status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </button>
                );
              })}
              {isDelegationCategory && (
                <div
                  className="rounded-xl p-4 space-y-4"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                      Team formation
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                      Create a unique team code or join with a code from your delegation head. After joining, each member continues with their own preferences and payment.
                    </p>
                  </div>
                  {delegationLoading && !delegationAffiliation ? (
                    <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                      Checking your delegation…
                    </p>
                  ) : delegationAffiliation ? (
                    <div
                      className="rounded-xl p-4 space-y-2"
                      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>
                            {delegationAffiliation.schoolName || delegationAffiliation.name || "Your delegation"}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                            {delegationAffiliation.isHead ? "Delegation head" : "Team member"}
                            {delegationAffiliation.memberCount
                              ? ` · ${delegationAffiliation.memberCount} member${
                                  delegationAffiliation.memberCount === 1 ? "" : "s"
                                }`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`badge ${
                            delegationAffiliation.status === "OPEN" ? "badge-green" : "badge-gray"
                          }`}
                        >
                          {delegationAffiliation.status === "OPEN" ? "Joined" : "Team closed"}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          className="input-base text-sm font-mono tracking-wider flex-1"
                          readOnly
                          value={delegationAffiliation.code}
                          aria-label="Delegation team code"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost text-xs"
                          onClick={() => {
                            void navigator.clipboard.writeText(delegationAffiliation.code);
                            toast.show("Team code copied.", "success");
                          }}
                        >
                          Copy code
                        </button>
                      </div>
                      {delegationAffiliation.isHead && (
                        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                          Share this code with teammates. They can choose “Join code” and complete their own registration.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost text-xs"
                          data-active={delegationMode === "create" ? "true" : "false"}
                          onClick={() => {
                            setDelegationMode("create");
                            setDelegationError("");
                            if (!delegationSchoolName) setDelegationSchoolName(school);
                          }}
                        >
                          Create code
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost text-xs"
                          data-active={delegationMode === "join" ? "true" : "false"}
                          onClick={() => {
                            setDelegationMode("join");
                            setDelegationError("");
                          }}
                        >
                          Join code
                        </button>
                      </div>
                      {delegationMode === "create" && (
                        <div className="space-y-3">
                          <input
                            className="input-base text-sm"
                            placeholder="School / institution name"
                            value={delegationSchoolName}
                            onChange={(event) => setDelegationSchoolName(event.target.value)}
                          />
                          <input
                            className="input-base text-sm"
                            type="number"
                            min={1}
                            max={selectedCategory?.maxDelegatesPerDelegation}
                            placeholder={
                              selectedCategory?.maxDelegatesPerDelegation
                                ? `Team size (max ${selectedCategory.maxDelegatesPerDelegation})`
                                : "Maximum team members (optional)"
                            }
                            value={delegationMaxMembers}
                            onChange={(event) => setDelegationMaxMembers(event.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-primary w-full text-sm"
                            disabled={creatingDelegation}
                            onClick={() => void handleCreateDelegation()}
                          >
                            {creatingDelegation ? "Generating code…" : "Generate team code"}
                          </button>
                        </div>
                      )}
                      {delegationMode === "join" && (
                        <div className="space-y-3">
                          <input
                            className="input-base text-sm font-mono uppercase tracking-wider"
                            placeholder="Enter team code"
                            value={delegationJoinCode}
                            onChange={(event) => setDelegationJoinCode(event.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-primary w-full text-sm"
                            disabled={delegationLoading || !delegationJoinCode.trim()}
                            onClick={() => void handleJoinDelegation()}
                          >
                            {delegationLoading ? "Joining…" : "Join with code"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {delegationError && (
                    <div className="alert alert-danger">
                      <span>{delegationError}</span>
                    </div>
                  )}
                </div>
              )}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                  Applying as {fullName}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                  Your contact and institution details will be taken from your profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => goForwardFrom(1)}
                disabled={!isStep1Valid || profileIncomplete}
                className="btn btn-primary w-full min-h-[44px]"
                style={{ opacity: isStep1Valid && !profileIncomplete ? 1 : 0.5 }}
              >
                Continue →
              </button>
            </div>
          )}

          {step === 2 && !existingRegistration && !profileIncomplete && selectedCategory && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>2. Preferences</h2>
              {!needsPreferencesStep ? (
                <p
                  className="text-sm rounded-xl p-4"
                  style={{ color: "var(--fg-muted)", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  Committee preferences are not required for this registration type. Continue to the next step.
                </p>
              ) : (
                <>
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
              {checkoutCommittees.length === 0 ? (
                <p
                  className="text-sm rounded-xl p-4"
                  style={{ color: "var(--fg-muted)", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  No committees have been set up for this conference yet. Preferences will be available once committees are added.
                </p>
              ) : (
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
              )}
                </>
              )}
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

          {step === 3 && !existingRegistration && !profileIncomplete && selectedCategory && (
            <div className="card p-6 sm:p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>3. Additional questions</h2>
              {!hasCategoryQuestions ? (
                <p
                  className="text-sm rounded-xl p-4"
                  style={{ color: "var(--fg-muted)", background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  No additional questions for this category. Continue to confirm your registration.
                </p>
              ) : null}
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

          {step === 4 && !existingRegistration && !profileIncomplete && (
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
              {submittedRegistration.paid ? (
                <button
                  type="button"
                  className="btn btn-outline-blue w-full"
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
                  Download Invoice (PDF)
                </button>
              ) : (
                <p className="text-xs text-center" style={{ color: "var(--fg-muted)" }}>
                  Invoice becomes available after payment is confirmed.
                </p>
              )}
              {(submittedRegistration.categoryName?.toLowerCase().includes("delegation") ||
                selectedCategory?.applicationType === "delegation") &&
              delegationAffiliation ? (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                    {delegationAffiliation.schoolName || "Your delegation"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    Your individual registration, preferences, and payment are linked to this team.
                  </p>
                  <div className="flex gap-2">
                    <input
                      className="input-base text-xs font-mono tracking-wider flex-1"
                      readOnly
                      value={delegationAffiliation.code}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost text-xs"
                      onClick={() => void navigator.clipboard.writeText(delegationAffiliation.code)}
                    >
                      Copy code
                    </button>
                  </div>
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

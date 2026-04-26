"use client";

import { ChangeEvent, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthModal from "@/components/AuthModal";
import Reveal from "@/components/Reveal";
import { useAuth } from "@/lib/auth-context";
import { DynamicFieldType, RegistrationCategory } from "@/lib/types";
import { hasOverlappingPhases } from "@/lib/pricing";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const FEATURES_FOR_ORGANIZERS = [
  {
    icon: "📋",
    title: "Committee Builder",
    desc: "Create unlimited committees with custom topics, delegate caps, background guides, and difficulty ratings.",
  },
  {
    icon: "💳",
    title: "Automated Payments",
    desc: "Accept registrations and payments globally. Automated invoicing, refunds, and financial reporting built in.",
  },
  {
    icon: "📧",
    title: "Delegate Communication",
    desc: "Bulk email delegates, send schedule updates, share documents, and manage FAQs from one dashboard.",
  },
  {
    icon: "📊",
    title: "Analytics Dashboard",
    desc: "Real-time registration charts, geographic delegate maps, revenue tracking, and engagement metrics.",
  },
  {
    icon: "🔒",
    title: "Application Review",
    desc: "Streamlined application review with custom forms, position paper collection, and batch acceptance.",
  },
  {
    icon: "🏆",
    title: "Awards Management",
    desc: "Digital awards issuance, certificate generation, and best delegate tracking — no manual work.",
  },
];

const FIELD_TYPE_OPTIONS: DynamicFieldType[] = ["text", "textarea", "select", "number", "date", "checkbox"];
const STEPS = ["Event Basics", "Registration Categories", "Committees", "Pricing Phases", "Custom Forms", "Review & Submit"];
const COMMITTEE_TYPE_OPTIONS = [
  { value: "UN", label: "UN Committee" },
  { value: "NON_UN", label: "Non-UN Committee" },
  { value: "CUSTOM", label: "Custom Type" },
] as const;

const getCommitteeTypeLabel = (committee: { committeeType: "UN" | "NON_UN" | "CUSTOM"; customTypeLabel: string }) => {
  if (committee.committeeType === "UN") return "UN";
  if (committee.committeeType === "NON_UN") return "Non-UN";
  return committee.customTypeLabel.trim() || "Custom";
};

export default function OrganizersPage() {
  const router = useRouter();
  const { isLoggedIn, user, addOrganizerConference } = useAuth();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const showLoggedInCta = hydrated && isLoggedIn;
  const [authOpen, setAuthOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [submitted, setSubmitted] = useState(false);
  const idCounter = useRef(1);

  const [confName, setConfName] = useState("");
  const [confCity, setConfCity] = useState("");
  const [confCountry, setConfCountry] = useState("");
  const [confOrg, setConfOrg] = useState("");
  const [committees, setCommittees] = useState([
    {
      id: "cm-1",
      name: "",
      agenda: "",
      committeeType: "UN" as "UN" | "NON_UN" | "CUSTOM",
      customTypeLabel: "",
      seatCount: "",
      basePrice: "",
      chairName: "",
      chairEmail: "",
      isPublic: true,
      customQuestions: "",
    },
  ]);
  const [categories, setCategories] = useState<RegistrationCategory[]>([
    {
      id: "cat-1",
      name: "Delegate Registration",
      description: "",
      applicationType: "delegate",
      isOpen: true,
      deadlineOverride: "",
      basePrice: 85,
      requiresCommitteeSelection: true,
      formFields: [],
      pricingPhases: [],
    },
  ]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [level, setLevel] = useState("High School");
  const [capacity, setCapacity] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [logoImageUrl, setLogoImageUrl] = useState("");
  const [brandPrimaryColor, setBrandPrimaryColor] = useState("#2563eb");
  const [brandSecondaryColor, setBrandSecondaryColor] = useState("#60a5fa");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerSourceType, setBannerSourceType] = useState<"upload" | "url" | null>(null);
  const [bannerError, setBannerError] = useState("");

  const nextId = (prefix: string) => {
    idCounter.current += 1;
    return `${prefix}-${idCounter.current}`;
  };

  const addCommittee = () =>
    setCommittees((prev) => [
      ...prev,
      {
        id: nextId("cm"),
        name: "",
        agenda: "",
        committeeType: "UN" as "UN" | "NON_UN" | "CUSTOM",
        customTypeLabel: "",
        seatCount: "",
        basePrice: "",
        chairName: "",
        chairEmail: "",
        isPublic: true,
        customQuestions: "",
      },
    ]);
  const removeCommittee = (i: number) => setCommittees(prev => prev.filter((_, idx) => idx !== i));
  const updateCommittee = (
    i: number,
    field:
      | "name"
      | "agenda"
      | "committeeType"
      | "customTypeLabel"
      | "seatCount"
      | "basePrice"
      | "chairName"
      | "chairEmail"
      | "customQuestions",
    val: string
  ) =>
    setCommittees(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: nextId("cat"),
        name: "",
        description: "",
        applicationType: "delegate",
        isOpen: true,
        deadlineOverride: "",
        basePrice: 0,
        requiresCommitteeSelection: true,
        formFields: [],
        pricingPhases: [],
      },
    ]);
  };

  const updateCategory = (
    index: number,
    patch: Partial<
      Pick<
        RegistrationCategory,
        | "name"
        | "description"
        | "applicationType"
        | "isOpen"
        | "deadlineOverride"
        | "maxDelegatesPerDelegation"
        | "basePrice"
        | "requiresCommitteeSelection"
      >
    >
  ) => {
    setCategories((prev) => prev.map((category, idx) => (idx === index ? { ...category, ...patch } : category)));
  };

  const addPhase = (categoryId: string) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              pricingPhases: [
                ...category.pricingPhases,
                {
                  id: nextId("phase"),
                  name: "",
                  startDate: "",
                  endDate: "",
                  basePrice: category.basePrice || 0,
                  committeePrices: [],
                },
              ],
            }
      )
    );
  };

  const updatePhase = (
    categoryId: string,
    phaseId: string,
    patch: Partial<{ name: string; startDate: string; endDate: string; basePrice: number }>
  ) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              pricingPhases: category.pricingPhases.map((phase) =>
                phase.id === phaseId ? { ...phase, ...patch } : phase
              ),
            }
      )
    );
  };

  const updateCommitteeOverride = (
    categoryId: string,
    phaseId: string,
    committeeId: string,
    rawPrice: string
  ) => {
    const committeeName = committees.find((committee) => committee.id === committeeId)?.name || committeeId;
    const parsed = Number(rawPrice);
    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              pricingPhases: category.pricingPhases.map((phase) => {
                if (phase.id !== phaseId) return phase;
                const rest = phase.committeePrices.filter((entry) => entry.committeeId !== committeeId);
                if (!rawPrice.trim() || Number.isNaN(parsed)) {
                  return { ...phase, committeePrices: rest };
                }
                return {
                  ...phase,
                  committeePrices: [...rest, { committeeId, committeeName, price: parsed }],
                };
              }),
            }
      )
    );
  };

  const addField = (categoryId: string) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              formFields: [
                ...category.formFields,
                {
                  id: nextId("field"),
                  label: "",
                  type: "text",
                  required: true,
                  placeholder: "",
                },
              ],
            }
      )
    );
  };

  const updateField = (
    categoryId: string,
    fieldId: string,
    patch: Partial<{ label: string; type: DynamicFieldType; required: boolean; placeholder: string; options: string[] }>
  ) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id !== categoryId
          ? category
          : {
              ...category,
              formFields: category.formFields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
            }
      )
    );
  };

  const openWizard = () => {
    router.push("/organizers/create");
  };

  const openDashboard = () => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    router.push("/organizers/dashboard");
  };

  const handleSubmit = async () => {
    await new Promise(r => setTimeout(r, 1200));
    addOrganizerConference({
      title: confName,
      city: confCity,
      country: confCountry,
      organizerName: confOrg,
      venue: venue || undefined,
      description: description || undefined,
      level: level as "High School" | "University" | "Open",
      capacity: Number(capacity),
      startDate,
      endDate,
      registrationDeadline: deadline,
      logoImageUrl: logoImageUrl.trim() || undefined,
      bannerImageUrl: bannerImageUrl.trim() || undefined,
      bannerSourceType: bannerSourceType || undefined,
      socialLinks: {
        website: website.trim() || undefined,
        instagram: instagram.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        twitter: twitter.trim() || undefined,
      },
      brandPrimaryColor: brandPrimaryColor.trim() || undefined,
      brandSecondaryColor: brandSecondaryColor.trim() || undefined,
      registrationCategories: categories
        .filter((category) => category.name.trim())
        .map((category) => ({
          ...category,
          deadlineOverride: category.deadlineOverride?.trim() || undefined,
          isOpen: category.isOpen !== false,
          pricingPhases: category.pricingPhases.filter(
            (phase) => phase.name && phase.startDate && phase.endDate
          ),
          formFields: category.formFields.filter((field) => field.label.trim()),
        })),
      committees: committees
        .filter((committee) => committee.name && committee.agenda)
        .map((committee, index) => ({
          id: committee.id || `cm-${Date.now()}-${index}`,
          name: committee.name,
          agenda: committee.agenda,
          committeeType: committee.committeeType,
          customTypeLabel:
            committee.committeeType === "CUSTOM" ? committee.customTypeLabel.trim() || undefined : undefined,
          type: getCommitteeTypeLabel(committee),
          seatCount: Number(committee.seatCount) || 0,
          basePrice: committee.basePrice ? Number(committee.basePrice) : undefined,
          chairName: committee.chairName || undefined,
          chairEmail: committee.chairEmail || undefined,
          isPublic: committee.isPublic,
          customQuestions: committee.customQuestions
            .split(",")
            .map((question) => question.trim())
            .filter(Boolean)
            .map((question, questionIndex) => ({
              id: `${committee.id}-q-${questionIndex}`,
              question,
              required: true,
            })),
        })),
    });
    setSubmitted(true);
  };

  const handleBannerFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setBannerError("Please upload an image file.");
      event.target.value = "";
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (selectedFile.size > maxBytes) {
      setBannerError("Banner image must be under 2MB.");
      event.target.value = "";
      return;
    }

    setBannerError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBannerImageUrl(reader.result);
        setBannerSourceType("upload");
      }
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleBannerUrlChange = (value: string) => {
    setBannerError("");
    setBannerImageUrl(value);
    setBannerSourceType(value.trim() ? "url" : null);
  };

  const isStep1Valid = confName && confCity && confCountry && confOrg;
  const isStep2Valid = categories.some((category) => category.name.trim());
  const isStep3Valid = committees.some(c => c.name && c.agenda);
  const isStep4Valid = categories.every((category) => !hasOverlappingPhases(category.pricingPhases));
  const isStep5Valid = categories.every(
    (category) => category.formFields.length === 0 || category.formFields.some((field) => field.label.trim())
  );

  return (
    <div className="lux-shell lux-shell-immersive min-h-screen">
      <div aria-hidden className="lux-backdrop" />

      <Navbar openAuthModal={() => setAuthOpen(true)} />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      {/* Hero */}
      <section className="relative lux-section pt-36 pb-28 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <span className="lux-pill">
            <span className="lux-pill-dot" />
            For Conference Organizers
          </span>

          <h1
            className="lux-display-xl mt-10"
            style={{ color: "var(--fg-immersive)" }}
          >
            Run the world&apos;s next
            <br />
            great{" "}
            <span
              style={{
                background:
                  "linear-gradient(120deg, #e7c390 10%, #f4e2c6 50%, #b28b57 90%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              MUN conference.
            </span>
          </h1>

          <p className="lux-subdisplay mt-8 max-w-2xl mx-auto">
            From a 50-delegate school conference to a 3,000-delegate world summit,
            Tidingz gives organizers the tools to craft unforgettable experiences.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={openWizard}
              className="lux-button-primary text-base"
              style={{ padding: "16px 32px" }}
            >
              Create your conference
            </button>
            <button
              type="button"
              onClick={openDashboard}
              className="lux-button-ghost text-base"
              style={{
                padding: "16px 28px",
                color: "var(--fg-immersive)",
                borderColor: "rgba(243,237,224,0.28)",
                background: "rgba(243,237,224,0.03)",
              }}
            >
              {showLoggedInCta ? "Open organizer dashboard" : "Sign in to dashboard"}
            </button>
          </div>

          <div
            className="mt-14 flex flex-col sm:flex-row gap-8 justify-center text-xs tracking-[0.22em] uppercase"
            style={{ color: "rgba(243,237,224,0.52)" }}
          >
            {["Free to start", "No credit card", "Setup in 10 minutes"].map(
              (point) => (
                <span key={point} className="flex items-center gap-2">
                  <span style={{ color: "var(--accent-warm)" }}>◆</span>
                  {point}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* Create Conference Wizard */}
      {wizardOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}>
          <div
            className="w-full max-w-2xl rounded-3xl overflow-hidden animate-fade-up"
            style={{ background: "var(--bg)", border: "1.5px solid var(--border)", boxShadow: "0 32px 80px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" }}
          >
            {/* Header */}
            <div className="p-7 pb-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-2xl font-black" style={{ color: "var(--fg)" }}>
                  {submitted ? "🎉 Conference Submitted!" : `Create Conference — Step ${step} of 6`}
                </h2>
                {!submitted && (
                  <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>{STEPS[step - 1]}</p>
                )}
              </div>
              <button onClick={() => { setWizardOpen(false); setSubmitted(false); setStep(1); }} style={{ color: "var(--fg-muted)", fontSize: "20px" }}>✕</button>
            </div>

            {/* Progress bar */}
            {!submitted && (
              <div className="px-7 py-3" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <div key={s} className="flex-1 h-1.5 rounded-full" style={{
                      background: s <= step ? "var(--blue)" : "var(--border)",
                    }} />
                  ))}
                </div>
              </div>
            )}

            <div className="p-7">
              {submitted ? (
                <div className="text-center space-y-5 py-6">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-4xl" style={{ background: "#dcfce7" }}>✅</div>
                  <h3 className="text-2xl font-black" style={{ color: "var(--fg)" }}>{confName} is submitted!</h3>
                  <p style={{ color: "var(--fg-muted)" }}>
                    Our team will review your conference within 48 hours and publish it on the marketplace. You&apos;ll receive a confirmation email at the registered address.
                  </p>
                  {user && (
                    <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                      Saved to your organizer account: <strong>{user.email}</strong>
                    </p>
                  )}
                  <div className="rounded-2xl p-5 text-left space-y-2" style={{ background: "var(--bg-subtle)" }}>
                    <p className="text-sm"><strong>Conference:</strong> {confName}</p>
                    <p className="text-sm"><strong>Location:</strong> {confCity}, {confCountry}</p>
                    <p className="text-sm"><strong>Committees:</strong> {committees.filter(c => c.name).length}</p>
                    <p className="text-sm"><strong>Categories:</strong> {categories.filter((category) => category.name).length}</p>
                  </div>
                  <button onClick={() => router.push("/organizers/dashboard")} className="btn btn-primary w-full">
                    Open Organizer Dashboard
                  </button>
                </div>
              ) : (
                <>
                  {/* Step 1: Event Basics */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Conference Name *</label>
                        <input value={confName} onChange={e => setConfName(e.target.value)} className="input-base" placeholder="e.g. Singapore International MUN" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>City *</label>
                          <input value={confCity} onChange={e => setConfCity(e.target.value)} className="input-base" placeholder="City" />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Country *</label>
                          <input value={confCountry} onChange={e => setConfCountry(e.target.value)} className="input-base" placeholder="Country" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Organizing Body *</label>
                        <input value={confOrg} onChange={e => setConfOrg(e.target.value)} className="input-base" placeholder="e.g. School MUN Society" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Venue</label>
                        <input value={venue} onChange={e => setVenue(e.target.value)} className="input-base" placeholder="Venue / campus / hotel" />
                      </div>
                      <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="input-base"
                        rows={3}
                        placeholder="Conference description shown on public page"
                      />
                      <input
                        value={logoImageUrl}
                        onChange={(event) => setLogoImageUrl(event.target.value)}
                        className="input-base text-sm"
                        placeholder="Conference logo URL (https://...)"
                      />
                      <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                        <label className="block text-sm font-semibold" style={{ color: "var(--fg)" }}>Conference Banner (optional)</label>
                        <input
                          value={bannerSourceType === "url" ? bannerImageUrl : ""}
                          onChange={(event) => handleBannerUrlChange(event.target.value)}
                          className="input-base text-sm"
                          placeholder="Paste banner image URL (https://...)"
                        />
                        <div>
                          <label className="block text-xs mb-1" style={{ color: "var(--fg-muted)" }}>
                            Or upload image (PNG/JPG/WebP, max 2MB)
                          </label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={handleBannerFileChange}
                            className="input-base text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-white"
                          />
                        </div>
                        {bannerError && (
                          <p className="text-xs" style={{ color: "#dc2626" }}>{bannerError}</p>
                        )}
                        {bannerImageUrl.trim() && (
                          <div className="rounded-xl overflow-hidden" style={{ border: "1.5px solid var(--border)" }}>
                            <div className="h-28 bg-cover bg-center" style={{ backgroundImage: `url("${bannerImageUrl}")` }} />
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input value={website} onChange={(event) => setWebsite(event.target.value)} className="input-base text-sm" placeholder="Website URL" />
                        <input value={instagram} onChange={(event) => setInstagram(event.target.value)} className="input-base text-sm" placeholder="Instagram URL" />
                        <input value={linkedin} onChange={(event) => setLinkedin(event.target.value)} className="input-base text-sm" placeholder="LinkedIn URL" />
                        <input value={twitter} onChange={(event) => setTwitter(event.target.value)} className="input-base text-sm" placeholder="X / Twitter URL" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--fg-muted)" }}>Primary brand color</label>
                          <input value={brandPrimaryColor} onChange={(event) => setBrandPrimaryColor(event.target.value)} className="input-base text-sm" placeholder="#2563eb" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1" style={{ color: "var(--fg-muted)" }}>Secondary brand color</label>
                          <input value={brandSecondaryColor} onChange={(event) => setBrandSecondaryColor(event.target.value)} className="input-base text-sm" placeholder="#60a5fa" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Conference Level</label>
                        <div className="grid grid-cols-3 gap-2">
                          {["High School", "University", "Open"].map((l) => (
                            <button key={l} onClick={() => setLevel(l)} className="py-2.5 rounded-xl text-sm font-semibold transition-all border" style={{
                              background: level === l ? "var(--blue-subtle)" : "var(--bg-subtle)",
                              color: level === l ? "var(--blue)" : "var(--fg-muted)",
                              borderColor: level === l ? "var(--blue)" : "var(--border)",
                            }}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setStep(2)} disabled={!isStep1Valid} className="btn btn-primary w-full" style={{ opacity: isStep1Valid ? 1 : 0.5 }}>
                        Next: Add Categories →
                      </button>
                    </div>
                  )}

                  {/* Step 2: Categories */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Create registration categories like Delegate, EB, OC, or IP.</p>
                      {categories.map((category, index) => (
                        <div key={category.id} className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Category {index + 1}</span>
                            {index > 0 && (
                              <button
                                onClick={() => setCategories((prev) => prev.filter((_, idx) => idx !== index))}
                                className="text-xs"
                                style={{ color: "#dc2626" }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              value={category.name}
                              onChange={(event) => updateCategory(index, { name: event.target.value })}
                              className="input-base text-sm"
                              placeholder="Category name"
                            />
                            <input
                              value={category.basePrice}
                              onChange={(event) => updateCategory(index, { basePrice: Number(event.target.value) })}
                              className="input-base text-sm"
                              placeholder="Default price"
                              type="number"
                            />
                          </div>
                          <input
                            value={category.description}
                            onChange={(event) => updateCategory(index, { description: event.target.value })}
                            className="input-base text-sm"
                            placeholder="Describe this registration category"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              value={category.applicationType || "delegate"}
                              onChange={(event) =>
                                updateCategory(index, {
                                  applicationType: event.target.value as "delegate" | "chair" | "delegation" | "organizer" | "other",
                                })
                              }
                              className="input-base text-sm"
                            >
                              <option value="delegate">Delegate</option>
                              <option value="delegation">Delegation</option>
                              <option value="chair">Chair</option>
                              <option value="organizer">Organizer Team</option>
                              <option value="other">Other (Custom)</option>
                            </select>
                            <input
                              value={category.deadlineOverride || ""}
                              onChange={(event) => updateCategory(index, { deadlineOverride: event.target.value })}
                              className="input-base text-sm"
                              type="date"
                            />
                          </div>
                          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                            <input
                              type="checkbox"
                              checked={category.isOpen !== false}
                              onChange={(event) => updateCategory(index, { isOpen: event.target.checked })}
                            />
                            Category open for applications
                          </label>
                          {category.applicationType === "delegation" && (
                            <input
                              value={category.maxDelegatesPerDelegation ?? ""}
                              onChange={(event) => {
                                const parsed = Number(event.target.value);
                                updateCategory(index, {
                                  maxDelegatesPerDelegation:
                                    Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined,
                                });
                              }}
                              className="input-base text-sm"
                              placeholder="Max delegates per delegation (optional)"
                              type="number"
                              min={1}
                            />
                          )}
                          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                            <input
                              type="checkbox"
                              checked={category.requiresCommitteeSelection}
                              onChange={(event) =>
                                updateCategory(index, { requiresCommitteeSelection: event.target.checked })
                              }
                            />
                            Requires committee selection
                          </label>
                        </div>
                      ))}
                      <button onClick={addCategory} className="btn btn-ghost w-full text-sm" style={{ borderStyle: "dashed" }}>
                        + Add Another Category
                      </button>
                      <div className="flex gap-3">
                        <button onClick={() => setStep(1)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={() => setStep(3)} disabled={!isStep2Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep2Valid ? 1 : 0.5 }}>
                          Next: Add Committees →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Committees */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <p className="text-sm" style={{ color: "var(--fg-muted)" }}>Define custom committees; nothing is hardcoded to UN bodies.</p>
                      {committees.map((cm, i) => (
                        <div key={cm.id} className="p-4 rounded-xl space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold" style={{ color: "var(--fg)" }}>Committee {i + 1}</span>
                            {i > 0 && <button onClick={() => removeCommittee(i)} className="text-xs" style={{ color: "#dc2626" }}>Remove</button>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input value={cm.name} onChange={e => updateCommittee(i, "name", e.target.value)} className="input-base text-sm" placeholder="Committee name (AIPPM, Lok Sabha...)" />
                            <input value={cm.seatCount} onChange={e => updateCommittee(i, "seatCount", e.target.value)} className="input-base text-sm" placeholder="Seat count" type="number" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <select
                              value={cm.committeeType}
                              onChange={(event) => updateCommittee(i, "committeeType", event.target.value as "UN" | "NON_UN" | "CUSTOM")}
                              className="input-base text-sm"
                            >
                              {COMMITTEE_TYPE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <input value={cm.basePrice} onChange={e => updateCommittee(i, "basePrice", e.target.value)} className="input-base text-sm" placeholder="Committee base price (optional)" type="number" />
                          </div>
                          {cm.committeeType === "CUSTOM" && (
                            <input
                              value={cm.customTypeLabel}
                              onChange={(event) => updateCommittee(i, "customTypeLabel", event.target.value)}
                              className="input-base text-sm"
                              placeholder="Custom committee type (e.g. Lok Sabha / AIPPM)"
                            />
                          )}
                          <input value={cm.agenda} onChange={e => updateCommittee(i, "agenda", e.target.value)} className="input-base text-sm" placeholder="Committee agenda" />
                          <div className="grid grid-cols-2 gap-3">
                            <input value={cm.chairName} onChange={e => updateCommittee(i, "chairName", e.target.value)} className="input-base text-sm" placeholder="Chair name" />
                            <input value={cm.chairEmail} onChange={e => updateCommittee(i, "chairEmail", e.target.value)} className="input-base text-sm" placeholder="Chair email" />
                          </div>
                          <input
                            value={cm.customQuestions}
                            onChange={e => updateCommittee(i, "customQuestions", e.target.value)}
                            className="input-base text-sm"
                            placeholder="Custom questions (comma separated)"
                          />
                          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                            <input
                              type="checkbox"
                              checked={cm.isPublic}
                              onChange={(event) =>
                                setCommittees((prev) =>
                                  prev.map((committee, idx) =>
                                    idx === i ? { ...committee, isPublic: event.target.checked } : committee
                                  )
                                )
                              }
                            />
                            Show committee on public conference page
                          </label>
                        </div>
                      ))}
                      <button onClick={addCommittee} className="btn btn-ghost w-full text-sm" style={{ borderStyle: "dashed" }}>
                        + Add Another Committee
                      </button>
                      <div className="grid grid-cols-2 gap-4">
                        <input value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base" type="date" />
                        <input value={endDate} onChange={e => setEndDate(e.target.value)} className="input-base" type="date" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Capacity *</label>
                        <input value={capacity} onChange={e => setCapacity(e.target.value)} className="input-base" type="number" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--fg)" }}>Registration Deadline *</label>
                        <input value={deadline} onChange={e => setDeadline(e.target.value)} className="input-base" type="date" />
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setStep(2)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={() => setStep(4)} disabled={!isStep3Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep3Valid ? 1 : 0.5 }}>
                          Next: Pricing Phases →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Pricing Phases */}
                  {step === 4 && (
                    <div className="space-y-5">
                      {categories.map((category) => (
                        <div key={category.id} className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold" style={{ color: "var(--fg)" }}>{category.name || "Untitled Category"}</h4>
                            <button onClick={() => addPhase(category.id)} className="btn btn-ghost text-xs">+ Add Phase</button>
                          </div>
                          {category.pricingPhases.length === 0 && (
                            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No phases added. Base category price will be used.</p>
                          )}
                          {category.pricingPhases.map((phase) => (
                            <div key={phase.id} className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg)" }}>
                              <div className="grid grid-cols-2 gap-2">
                                <input className="input-base text-sm" placeholder="Phase name" value={phase.name} onChange={(event) => updatePhase(category.id, phase.id, { name: event.target.value })} />
                                <input className="input-base text-sm" placeholder="Phase price" type="number" value={phase.basePrice} onChange={(event) => updatePhase(category.id, phase.id, { basePrice: Number(event.target.value) })} />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <input className="input-base text-sm" type="date" value={phase.startDate} onChange={(event) => updatePhase(category.id, phase.id, { startDate: event.target.value })} />
                                <input className="input-base text-sm" type="date" value={phase.endDate} onChange={(event) => updatePhase(category.id, phase.id, { endDate: event.target.value })} />
                              </div>
                              {category.requiresCommitteeSelection && committees.length > 0 && (
                                <div className="grid md:grid-cols-2 gap-2">
                                  {committees.map((committee) => (
                                    <input
                                      key={committee.id}
                                      className="input-base text-xs"
                                      placeholder={`${committee.name || "Committee"} override`}
                                      value={
                                        phase.committeePrices.find((entry) => entry.committeeId === committee.id)?.price ?? ""
                                      }
                                      onChange={(event) => updateCommitteeOverride(category.id, phase.id, committee.id, event.target.value)}
                                      type="number"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {hasOverlappingPhases(category.pricingPhases) && (
                            <p className="text-xs" style={{ color: "#dc2626" }}>Phases overlap. Adjust dates to continue.</p>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-3">
                        <button onClick={() => setStep(3)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={() => setStep(5)} disabled={!isStep4Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep4Valid ? 1 : 0.5 }}>
                          Next: Build Forms →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Custom Forms */}
                  {step === 5 && (
                    <div className="space-y-5">
                      {categories.map((category) => (
                        <div key={category.id} className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold" style={{ color: "var(--fg)" }}>{category.name || "Untitled Category"}</h4>
                            <button onClick={() => addField(category.id)} className="btn btn-ghost text-xs">+ Add Field</button>
                          </div>
                          {category.formFields.length === 0 && (
                            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>No custom fields added yet.</p>
                          )}
                          {category.formFields.map((field) => (
                            <div key={field.id} className="p-3 rounded-xl space-y-2" style={{ background: "var(--bg)" }}>
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  className="input-base text-sm"
                                  placeholder="Field label"
                                  value={field.label}
                                  onChange={(event) => updateField(category.id, field.id, { label: event.target.value })}
                                />
                                <select
                                  className="input-base text-sm"
                                  value={field.type}
                                  onChange={(event) => updateField(category.id, field.id, { type: event.target.value as DynamicFieldType })}
                                >
                                  {FIELD_TYPE_OPTIONS.map((type) => (
                                    <option key={type} value={type}>{type}</option>
                                  ))}
                                </select>
                              </div>
                              <input
                                className="input-base text-sm"
                                placeholder="Placeholder text (optional)"
                                value={field.placeholder || ""}
                                onChange={(event) => updateField(category.id, field.id, { placeholder: event.target.value })}
                              />
                              {field.type === "select" && (
                                <input
                                  className="input-base text-sm"
                                  placeholder="Options comma separated"
                                  value={field.options?.join(", ") || ""}
                                  onChange={(event) =>
                                    updateField(category.id, field.id, {
                                      options: event.target.value
                                        .split(",")
                                        .map((value) => value.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                />
                              )}
                              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
                                <input
                                  type="checkbox"
                                  checked={field.required}
                                  onChange={(event) =>
                                    updateField(category.id, field.id, { required: event.target.checked })
                                  }
                                />
                                Required field
                              </label>
                            </div>
                          ))}
                        </div>
                      ))}
                      <div className="flex gap-3">
                        <button onClick={() => setStep(4)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={() => setStep(6)} disabled={!isStep5Valid} className="btn btn-primary flex-[2]" style={{ opacity: isStep5Valid ? 1 : 0.5 }}>
                          Next: Review →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 6: Review */}
                  {step === 6 && (
                    <div className="space-y-5">
                      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                        {[
                          { label: "Conference", value: confName },
                          { label: "Location", value: `${confCity}, ${confCountry}` },
                          { label: "Organizer", value: confOrg },
                          { label: "Level", value: level },
                          { label: "Categories", value: categories.map((category) => category.name).filter(Boolean).join(", ") },
                          { label: "Committees", value: committees.filter(c => c.name).map(c => c.name).join(", ") },
                          { label: "Capacity", value: `${capacity} delegates` },
                          { label: "Dates", value: `${startDate} to ${endDate}` },
                        ].map(r => (
                          <div key={r.label} className="flex justify-between text-sm">
                            <span style={{ color: "var(--fg-muted)" }}>{r.label}</span>
                            <span className="font-semibold text-right max-w-[240px]" style={{ color: "var(--fg)" }}>{r.value || "—"}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                        By submitting, you agree to Tidingz&apos;s Organizer Terms. Your conference will be reviewed within 48 hours.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setStep(5)} className="btn btn-ghost flex-1">← Back</button>
                        <button onClick={handleSubmit} className="btn btn-primary flex-[2]">
                          🚀 Submit Conference
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <section className="relative lux-section py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <Reveal>
              <p
                className="lux-eyebrow justify-center inline-flex"
                style={{ color: "rgba(243,237,224,0.55)" }}
              >
                Organizer Tools
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="lux-display mt-6 max-w-3xl mx-auto"
                style={{ color: "var(--fg-immersive)" }}
              >
                Everything to run a world-class conference.
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES_FOR_ORGANIZERS.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 0.06}>
                <div className="lux-card lux-card-interactive p-8 h-full">
                  <p
                    className="text-xs font-semibold"
                    style={{
                      color: "var(--accent-warm)",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3
                    className="mt-5 text-xl font-semibold"
                    style={{
                      color: "var(--fg-immersive)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="mt-3 leading-relaxed text-sm"
                    style={{ color: "rgba(243,237,224,0.68)" }}
                  >
                    {feature.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative lux-section py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <Reveal>
              <p
                className="lux-eyebrow justify-center inline-flex"
                style={{ color: "rgba(243,237,224,0.55)" }}
              >
                Pricing
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <h2
                className="lux-display mt-6"
                style={{ color: "var(--fg-immersive)" }}
              >
                Transparent pricing.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.08}>
            <div className="lux-card p-8 md:p-10 max-w-4xl mx-auto">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-3">
                  <p
                    className="text-[10px] font-semibold"
                    style={{
                      color: "var(--accent-warm)",
                      letterSpacing: "0.28em",
                      textTransform: "uppercase",
                    }}
                  >
                    Platform Fee
                  </p>
                  <p
                    className="text-4xl md:text-5xl font-semibold"
                    style={{
                      color: "var(--fg-immersive)",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    5%
                  </p>
                  <p
                    className="text-sm md:text-base"
                    style={{ color: "rgba(243,237,224,0.76)" }}
                  >
                    We charge a 5% platform fee on each paid registration transaction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openWizard}
                  className="lux-button-primary text-sm"
                  style={{ padding: "14px 22px", alignSelf: "flex-start" }}
                >
                  Get Started
                </button>
              </div>
              <div className="lux-divider my-6" />
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  "No monthly subscription plans",
                  "Fee applies only when delegate payment succeeds",
                  "You keep the remaining 95% (before gateway/provider charges)",
                ].map((line) => (
                  <div
                    key={line}
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{
                      background: "rgba(243,237,224,0.04)",
                      border: "1px solid rgba(243,237,224,0.1)",
                      color: "rgba(243,237,224,0.82)",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative lux-section py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Reveal>
            <p
              className="lux-eyebrow justify-center inline-flex"
              style={{ color: "rgba(243,237,224,0.55)" }}
            >
              Begin
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2
              className="lux-display mt-6"
              style={{ color: "var(--fg-immersive)" }}
            >
              Ready when you are.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={openWizard}
                className="lux-button-primary text-base"
                style={{ padding: "16px 34px" }}
              >
                Create your conference
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}

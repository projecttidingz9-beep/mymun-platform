"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { CONFERENCES } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { OrganizerCommittee, Registration, RegistrationCategory } from "@/lib/types";
import { resolveRegistrationPrice } from "@/lib/pricing";

type Step = 1 | 2 | 3 | 4 | 5;

const COUNTRIES = [
  "Argentina", "Australia", "Brazil", "Canada", "China", "Egypt", "France",
  "Germany", "India", "Indonesia", "Japan", "Kenya", "Mexico", "Nigeria",
  "Pakistan", "Russia", "Saudi Arabia", "South Africa", "United Kingdom",
  "United States", "Italy", "Spain", "South Korea", "Turkey", "Iran",
];

const createConfirmationId = () => `MYM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
  const [selectedCountry, setSelectedCountry] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState(user?.name || "");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationId, setConfirmationId] = useState("");

  const organizerConference = organizerConferences.find((conference) => conference.id === params.id);
  const marketplaceConference = CONFERENCES.find((conference) => conference.id === params.id);

  useEffect(() => {
    if (!isLoggedIn) router.push("/");
  }, [isLoggedIn, router]);

  if (!organizerConference && !marketplaceConference) return null;

  const displayTitle = organizerConference?.title || marketplaceConference?.title || "Conference";
  const displayCity = organizerConference?.city || marketplaceConference?.city || "";
  const displayStartDate = organizerConference?.startDate || marketplaceConference?.startDate || "";
  const currencySymbol = marketplaceConference?.currency === "EUR" ? "€" : marketplaceConference?.currency === "GBP" ? "£" : "$";

  const categories: RegistrationCategory[] = organizerConference
    ? organizerConference.registrationCategories
    : [
        {
          id: "default-delegate",
          name: "Delegate Registration",
          description: "Standard delegate registration",
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
  const priceResult = selectedCategory
    ? resolveRegistrationPrice(selectedCategory, selectedCommitteeId || undefined)
    : { amount: 0, phaseId: undefined, phaseName: undefined };

  const formatCardNumber = (value: string) =>
    value.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExpiry = (value: string) =>
    value.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2");

  const handlePay = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1800));
    const confId = createConfirmationId();
    setConfirmationId(confId);

    const registration: Registration = {
      id: confId,
      conferenceId: String(params.id),
      conferenceTitle: displayTitle,
      categoryId: selectedCategory.id,
      categoryName: selectedCategory.name,
      committeeId: selectedCommitteeId || undefined,
      committeeName: selectedCommittee?.name,
      committeePreferences: [selectedCommitteeId, secondPreferenceCommitteeId, thirdPreferenceCommitteeId].filter(Boolean),
      portfolioPreferencesByCommittee: selectedCommitteeId
        ? {
            [selectedCommitteeId]: [portfolioPreferencePrimary, portfolioPreferenceSecondary].filter(Boolean),
          }
        : {},
      country: selectedCountry || undefined,
      formAnswers: answers,
      pricingPhaseId: priceResult.phaseId,
      pricingPhaseName: priceResult.phaseName,
      status: "Confirmed",
      registeredAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      paid: true,
      amount: priceResult.amount,
    };

    addRegistration(registration);
    setLoading(false);
    setStep(5);
  };

  const isStep1Valid = !!selectedCategoryId;
  const isStep2Valid = !!selectedCategory && selectedCategory.formFields.every(
    (field) => !field.required || answers[field.id] !== undefined
  );
  const isStep3Valid = !selectedCategory?.requiresCommitteeSelection || !!selectedCommitteeId;
  const isStep4Valid = cardNumber.replace(/\s/g, "").length === 16 && !!cardName && expiry.length === 5 && cvv.length >= 3;

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-16 px-6" style={{ background: "var(--bg-subtle)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link href={`/conference/${params.id}`} className="text-sm mb-4 flex items-center gap-1" style={{ color: "var(--fg-muted)" }}>
              ← Back to {displayTitle}
            </Link>
            <h1 className="text-3xl font-black" style={{ color: "var(--fg)" }}>
              {step === 5 ? "🎉 Registration Confirmed!" : "Complete Registration"}
            </h1>
          </div>

          {step < 5 && (
            <div className="p-5 rounded-2xl mb-6 flex items-center gap-4" style={{ background: "var(--bg)", border: "1.5px solid var(--border)" }}>
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${marketplaceConference?.color || "from-blue-600 to-indigo-700"} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white font-black text-xl">M</span>
              </div>
              <div className="flex-1">
                <p className="font-bold" style={{ color: "var(--fg)" }}>{displayTitle}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>{displayStartDate} · {displayCity}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black" style={{ color: "var(--fg)" }}>{currencySymbol}{priceResult.amount}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{priceResult.phaseName || "Base pricing"}</p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="card p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Choose Category</h2>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className="w-full text-left p-4 rounded-xl border transition-all"
                  style={{
                    background: selectedCategoryId === category.id ? "var(--blue-subtle)" : "var(--bg-subtle)",
                    borderColor: selectedCategoryId === category.id ? "var(--blue)" : "var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm" style={{ color: "var(--fg)" }}>{category.name}</span>
                    <span className="badge badge-blue">${category.basePrice}</span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>{category.description || "No description provided."}</p>
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
              <input value={fullName} onChange={(event) => { setFullName(event.target.value); setAnswers((prev) => ({ ...prev, fullName: event.target.value })); }} className="input-base" placeholder="Full Name" />
              <input value={school} onChange={(event) => { setSchool(event.target.value); setAnswers((prev) => ({ ...prev, school: event.target.value })); }} className="input-base" placeholder="School / University" />
              <input value={phone} onChange={(event) => { setPhone(event.target.value); setAnswers((prev) => ({ ...prev, phone: event.target.value })); }} className="input-base" placeholder="Phone" />
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
                  ) : (
                    <input className="input-base" type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"} value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: field.type === "number" ? Number(event.target.value) : event.target.value }))} placeholder={field.placeholder} />
                  )}
                </div>
              ))}
              <select value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value)} className="input-base">
                <option value="">Country Preference...</option>
                {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
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
                    <select value={selectedCommitteeId} onChange={(event) => setSelectedCommitteeId(event.target.value)} className="input-base">
                      <option value="">Select first preference</option>
                      {committees.map((committee) => (
                        <option key={committee.id} value={committee.id}>{committee.name}</option>
                      ))}
                    </select>
                  </div>
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
                  Continue to Payment →
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="card p-8 rounded-2xl space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "var(--fg)" }}>Payment Details</h2>
              <input value={cardNumber} onChange={(event) => setCardNumber(formatCardNumber(event.target.value))} className="input-base" placeholder="Card Number" maxLength={19} />
              <input value={cardName} onChange={(event) => setCardName(event.target.value)} className="input-base" placeholder="Name on Card" />
              <div className="grid grid-cols-2 gap-4">
                <input value={expiry} onChange={(event) => setExpiry(formatExpiry(event.target.value))} className="input-base" placeholder="MM/YY" maxLength={5} />
                <input value={cvv} onChange={(event) => setCvv(event.target.value.replace(/\D/g, "").slice(0, 4))} className="input-base" placeholder="CVV" type="password" maxLength={4} />
              </div>
              <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Resolved fee</span>
                  <span style={{ color: "var(--fg)" }}>{currencySymbol}{priceResult.amount}.00</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--fg-muted)" }}>Pricing phase</span>
                  <span style={{ color: "var(--fg)" }}>{priceResult.phaseName || "Base price"}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="btn btn-ghost flex-1">← Back</button>
                <button onClick={handlePay} disabled={!isStep4Valid || loading} className="btn btn-primary flex-[2]" style={{ opacity: isStep4Valid && !loading ? 1 : 0.5 }}>
                  {loading ? "Processing..." : `Pay ${currencySymbol}${priceResult.amount}.00`}
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="card p-10 rounded-2xl text-center space-y-6">
              <h2 className="text-3xl font-black" style={{ color: "var(--fg)" }}>You&apos;re Registered!</h2>
              <div className="rounded-2xl p-5 text-left space-y-3" style={{ background: "var(--bg-subtle)", border: "1.5px solid var(--border)" }}>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--fg-muted)" }}>Confirmation ID</span><span style={{ color: "var(--blue)" }}>{confirmationId}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--fg-muted)" }}>Category</span><span style={{ color: "var(--fg)" }}>{selectedCategory?.name}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--fg-muted)" }}>Committee</span><span style={{ color: "var(--fg)" }}>{selectedCommittee?.name || "N/A"}</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: "var(--fg-muted)" }}>Amount Paid</span><span style={{ color: "#16a34a" }}>{currencySymbol}{priceResult.amount}.00</span></div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/dashboard" className="btn btn-primary flex-1">Go to Dashboard →</Link>
                <Link href="/marketplace" className="btn btn-ghost flex-1">Browse More →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

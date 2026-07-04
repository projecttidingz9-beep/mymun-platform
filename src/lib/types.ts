export interface Committee {
  id: string;
  name: string;
  abbreviation: string;
  topic1: string;
  topic2: string;
  /** All configured agenda/topic strings, in order (topic1/topic2 are kept for back-compat display). */
  agendas?: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  size: number;
  allottedCount?: number;
  logoImageUrl?: string;
  chairs?: OrganizerCommitteeChair[];
  /** International Press / Press Corps style: no named portfolios, delegates are selected directly into the committee. */
  noPortfolio?: boolean;
  /** Whether the public Portfolio Matrix shows allotment status color-coding for this conference. */
  portfolioMatrixVisibility?: "PUBLIC" | "PRIVATE";
  portfolios?: Array<{ id: string; name: string; seatCount: number; taken?: boolean }>;
}

export interface CommitteePricingInfo {
  committeeId: string;
  committeeName: string;
  price: number;
}

export interface OrganizerCommittee {
  id: string;
  name: string;
  /** Primary/first agenda topic. */
  agenda: string;
  /** Additional agenda/topic strings beyond the primary one (organizer can add via "+" in Edit Details). */
  additionalAgendas?: string[];
  description?: string;
  logoImageUrl?: string;
  committeeType?: "UN" | "NON_UN" | "CUSTOM";
  committeeFormat?: string;
  customTypeLabel?: string;
  memberMode?: "UN_COUNTRY" | "CUSTOM_MEMBER";
  metadata?: {
    historicalDate?: string;
    crisisEnabled?: boolean;
    pressBeatRequired?: boolean;
  };
  /** @deprecated Position papers removed — kept optional for legacy blob reads only. */
  positionPaperDeadline?: string;
  // Backward-compatible display type persisted by older records.
  type?: string;
  /** Derived from portfolios' seat counts unless `noPortfolio` is true. */
  seatCount: number;
  allottedCount?: number;
  basePrice?: number;
  chairName?: string;
  chairEmail?: string;
  chairs?: OrganizerCommitteeChair[];
  isPublic?: boolean;
  /** International Press / Press Corps style: no named portfolios — delegates are selected directly into the committee. */
  noPortfolio?: boolean;
  customQuestions?: OrganizerCommitteeQuestion[];
  portfolios?: OrganizerCommitteePortfolio[];
  documents?: OrganizerDocument[];
}

export type OrganizerDocumentCategory = "background-guide" | "guidelines" | "rules" | "other";

export interface OrganizerDocument {
  id: string;
  title: string;
  category: OrganizerDocumentCategory;
  sourceType: "upload" | "url";
  url: string;
  fileName?: string;
  mimeType?: string;
  uploadedAt?: string;
}

export interface OrganizerCommitteeChair {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface OrganizerCommitteeQuestion {
  id: string;
  question: string;
  required: boolean;
}

export interface OrganizerCommitteePortfolio {
  id: string;
  name: string;
  seatCount: number;
  assignedApplicantIds: string[];
}

export type DynamicFieldType = "text" | "textarea" | "select" | "number" | "date" | "checkbox" | "file";

export interface DynamicFormField {
  id: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
  maxFiles?: number;
  maxFileSizeMb?: number;
}

export interface PricingPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  basePrice: number;
  committeePrices: CommitteePricingInfo[];
}

export interface RegistrationCategory {
  id: string;
  name: string;
  description: string;
  applicationType?: "delegate" | "chair" | "delegation" | "organizer" | "press" | "other";
  maxDelegatesPerDelegation?: number;
  isOpen?: boolean;
  deadlineOverride?: string;
  registrationDeadline?: string;
  basePrice: number;
  requiresCommitteeSelection: boolean;
  formFields: DynamicFormField[];
  pricingPhases: PricingPhase[];
}

export interface Conference {
  id: string;
  title: string;
  slug: string;
  location: string;
  city: string;
  country: string;
  region: "Asia" | "Europe" | "Americas" | "Africa" | "Oceania";
  startDate: string;
  endDate: string;
  registrationOpenDate?: string;
  registrationDeadline: string;
  price: number;
  currency: string;
  level: "High School" | "University" | "Elite" | "Open" | "Hybrid";
  committees: Committee[];
  capacity: number;
  registered: number;
  description: string;
  organizer: string;
  organizerEmail: string;
  website: string;
  featured: boolean;
  color: string; // gradient color for card
  logoImageUrl?: string;
  bannerImageUrl?: string;
  tags: string[];
  statusBadgeLabel?: string;
}

/** Extended public fields for delegate conference detail (from organizer preview blob). */
export interface PublicConferenceDetail extends Conference {
  whatIsIncluded?: string[];
  conferenceSchedule?: Array<{
    id: string;
    day: string;
    fromTime: string;
    toTime: string;
    title: string;
  }>;
  termsAndConditions?: string;
  refundPolicy?: string;
  codeOfConduct?: string;
  faqNotes?: string;
  organizerName?: string;
  awards?: Array<{
    id: string;
    category: string;
    prizeTitle?: string;
    description?: string;
    amount?: number;
    participantName?: string;
    /** Only populated once the organizer has assigned a winner (and/or the conference has ended). */
    winnerName?: string;
  }>;
  socialLinks?: {
    website?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
  };
  commonDocuments?: OrganizerDocument[];
  reviews?: Array<{
    id: string;
    userName: string;
    rating: number;
    comment: string;
    featured?: boolean;
    createdAt?: string;
  }>;
  previousEditions?: OrganizerPreviousEdition[];
  partnerConferences?: Array<{ id: string; title: string; status: string }>;
  organizerTeam?: OrganizerTeamMember[];
  registrationOpen?: boolean;
  /** Live pricing-phase chips for the public registration card. */
  pricingPhaseChips?: Array<{ id: string; name: string; status: "Active" | "Upcoming" | "Ended" }>;
  activePricingPhaseName?: string;
  allocationMode?: "PAY_FIRST" | "ALLOT_FIRST";
  /** Section keys the organizer has hidden from the public page. */
  hiddenSections?: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  role?: "delegate" | "organizer" | "admin";
  avatar: string;
  profileImageUrl?: string;
  firstName?: string;
  lastName?: string;
  school: string;
  college?: string;
  fieldOfStudy?: string;
  profileHeadline?: string;
  phone?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  socialMedia?: DelegateSocialMedia;
  invoiceAddress?: DelegateInvoiceAddress;
  country: string;
  munExperienceSummary?: string;
  munAwardsSummary?: string;
  munParticipations?: DelegateMunParticipation[];
  munAwards?: DelegateMunAward[];
  profileVisibility?: "private" | "public";
  registeredConferences: Registration[];
  notifications?: UserNotification[];
}

export interface DelegateSocialMedia {
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  github?: string;
}

export interface DelegateInvoiceAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface DelegateMunParticipation {
  id: string;
  conferenceName: string;
  committee?: string;
  role?: string;
  year?: number;
  countryRepresented?: string;
  notes?: string;
  certificateUrl?: string;
  certificateFileName?: string;
  certificateMimeType?: string;
}

export interface DelegateMunAward {
  id: string;
  title: string;
  conferenceName: string;
  year?: number;
  category?: string;
  committee?: string;
  logoUrl?: string;
}

export interface OrganizerApplicant {
  id: string;
  name: string;
  school: string;
  countryPreference: string;
  countryPreferences?: string[];
  committeePreference: string;
  committeePreferences: string[];
  portfolioPreferencesByCommittee?: Record<string, string[]>;
  categoryId?: string;
  categoryName?: string;
  assignmentStatus?: "Pending" | "Allotted" | "Waitlisted" | "Rejected" | "Invited";
  assignedCommitteeId?: string;
  assignedCommitteeName?: string;
  assignedPortfolioId?: string;
  assignedPortfolioName?: string;
  assignedAt?: string;
  /**
   * Allotment-release workflow: an allotment can exist as a private draft (released=false) that only the
   * organizer can see. The delegate only learns of their committee/portfolio once the organizer explicitly
   * releases it (see `releaseAllotments`).
   */
  released?: boolean;
  releasedAt?: string;
  overrideUsed?: boolean;
  assignmentHistory?: OrganizerAssignmentLog[];
  phone?: string;
  responses?: Record<string, string | number | boolean | string[]>;
  paid: boolean;
  amount?: number;
  paymentIntentStatus?: "PENDING" | "CONFIRMED" | "REFUNDED" | "CANCELLED";
  paymentProvider?: "FREE" | "MANUAL" | "CASHFREE";
  registrationId?: string;
  registeredAt?: string;
  userId?: string;
  userEmail?: string;
  status: "Pending" | "Allotted" | "Rejected" | "Waitlisted" | "Invited";
}

export interface OrganizerAnnouncement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface OrganizerAssignmentLog {
  id: string;
  action: "allotted" | "moved" | "waitlisted" | "unassigned" | "rejected" | "invited";
  committeeId?: string;
  committeeName?: string;
  portfolioId?: string;
  portfolioName?: string;
  overrideUsed?: boolean;
  createdAt: string;
}

export interface OrganizerConference {
  id: string;
  ownerUserId?: string;
  ownerEmail?: string;
  /** ISO 4217 code (from Event.currency). */
  currency?: string;
  title: string;
  city: string;
  country: string;
  organizerName: string;
  contactDetail?: string;
  tags?: string[];
  venue?: string;
  level: "High School" | "University" | "Open";
  capacity: number;
  startDate: string;
  endDate: string;
  whatIsIncluded?: string[];
  conferenceSchedule?: Array<{
    id: string;
    day: string;
    fromTime: string;
    toTime: string;
    title: string;
  }>;
  registrationDeadline?: string;
  logoImageUrl?: string;
  bannerImageUrl?: string;
  bannerSourceType?: "upload" | "url";
  description?: string;
  termsAndConditions?: string;
  refundPolicy?: string;
  codeOfConduct?: string;
  faqNotes?: string;
  socialLinks?: OrganizerSocialLinks;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  bankingDetails?: OrganizerBankingDetails;
  statusEmailTemplates?: OrganizerStatusEmailTemplates;
  status: "Draft" | "Review" | "Published";
  /** Set by platform super-admin when a publish request is rejected (returned to Draft). */
  adminRejectionNote?: string;
  registrationCategories: RegistrationCategory[];
  committees: OrganizerCommittee[];
  commonDocuments?: OrganizerDocument[];
  applicants: OrganizerApplicant[];
  announcements: OrganizerAnnouncement[];
  partnerConferenceIds?: string[];
  partnerLinks?: OrganizerConferencePartnerLink[];
  previousEditions?: OrganizerPreviousEdition[];
  delegationInviteCode?: string;
  organizerTeam?: OrganizerTeamMember[];
  organizerTeamEmails?: string[];
  awards?: OrganizerAwardConfig[];
  reviews?: ConferenceReview[];
  /** Whether delegates see portfolio allotment status color-coding on the public Portfolio Matrix. Names are always visible. */
  portfolioMatrixVisibility?: "PUBLIC" | "PRIVATE";
  /** Set once at conference creation and immutable thereafter. */
  allocationMode?: "PAY_FIRST" | "ALLOT_FIRST";
  /** Allot-first mode only: number of days a delegate has to pay after being allotted before it auto-cancels. */
  paymentDeadlineDays?: number;
  /** Public landing-page section keys the organizer has chosen to hide. */
  hiddenSections?: string[];
}

export type OrganizerConferencePartnerStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export interface OrganizerConferencePartnerLink {
  id: string;
  partnerConferenceId: string;
  partnerConferenceTitle?: string;
  direction: "incoming" | "outgoing";
  status: OrganizerConferencePartnerStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrganizerPreviousEdition {
  id: string;
  year: string;
  title: string;
  delegates: number;
  highlights?: string;
}

export interface OrganizerTeamMember {
  id: string;
  userId?: string;
  name: string;
  email: string;
  role: string;
  permissions: OrganizerPermission[];
  photoUrl?: string;
}

export type OrganizerPermission =
  | "view"
  | "applications"
  | "finance"
  | "settings"
  | "publishing";

export interface OrganizerAwardConfig {
  id: string;
  category: string;
  prizeTitle?: string;
  /** Optional, blank by default. Shown below the award once filled in. */
  amount?: number;
  description?: string;
  participantId?: string;
  participantName?: string;
  participantUserId?: string;
  participantUserEmail?: string;
  recipientDelegationId?: string;
  /** @deprecated sponsor fields removed from UI — kept optional for legacy data reads. */
  presetKey?: string;
  /** @deprecated */
  sponsorName?: string;
  /** @deprecated */
  sponsorLogoUrl?: string;
}

export interface ConferenceReview {
  id: string;
  conferenceId: string;
  userId?: string;
  userName: string;
  rating: number;
  organizationRating?: number;
  committeeRating?: number;
  hospitalityRating?: number;
  comment: string;
  status: "pending" | "approved" | "hidden";
  featured?: boolean;
  createdAt: string;
}

export interface OrganizerSocialLinks {
  website?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
}

export interface OrganizerBankingDetails {
  accountHolderName?: string;
  bankName?: string;
  accountNumber?: string;
  accountType?: "Savings" | "Current" | "Checking" | "Other";
  ifscCode?: string;
  swiftCode?: string;
  iban?: string;
  routingNumber?: string;
  branchName?: string;
  branchAddress?: string;
  upiId?: string;
  payoutNotes?: string;
  verificationStatus?: "Unverified" | "Pending" | "Verified";
  updatedAt?: string;
}

export type OrganizerStatusEmailTemplateKey = "allotted" | "rejected" | "waitlisted" | "invited";

export interface OrganizerStatusEmailTemplate {
  subject: string;
  body: string;
}

export type OrganizerStatusEmailTemplates = Record<
  OrganizerStatusEmailTemplateKey,
  OrganizerStatusEmailTemplate
>;

export interface OrganizerOverviewAnalytics {
  totalRegistrations: number;
  acceptedDelegates: number;
  pendingApplications: number;
  waitlistedApplications: number;
  rejectedApplications: number;
  paymentCompletionRate: number;
  revenueCollected: number;
  committeeFill: Array<{ committeeId: string; committeeName: string; fillPercent: number }>;
  registrationsByCountry: Array<{ country: string; count: number }>;
  registrationsByCity: Array<{ city: string; count: number }>;
  applicationsTrend: Array<{ date: string; count: number }>;
}

export interface OrganizerConferencePreviewConfig {
  eventId: string;
  ownerUserId?: string;
  ownerEmail?: string;
  organizerTeamEmails?: string[];
  title?: string;
  city?: string;
  country?: string;
  organizerName?: string;
  contactDetail?: string;
  tags?: string[];
  capacity?: number;
  level?: "High School" | "University" | "Open";
  venue?: string;
  startDate?: string;
  endDate?: string;
  registrationDeadline?: string;
  description?: string;
  termsAndConditions?: string;
  refundPolicy?: string;
  codeOfConduct?: string;
  faqNotes?: string;
  logoImageUrl?: string;
  bannerImageUrl?: string;
  socialLinks?: OrganizerSocialLinks;
  whatIsIncluded?: string[];
  conferenceSchedule?: Array<{
    id: string;
    day: string;
    fromTime: string;
    toTime: string;
    title: string;
  }>;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
}

export interface Registration {
  id: string;
  conferenceId: string;
  conferenceTitle: string;
  categoryId: string;
  categoryName: string;
  committeeId?: string;
  committeeName?: string;
  committeePreferences?: string[];
  portfolioPreferencesByCommittee?: Record<string, string[]>;
  assignedCommitteeId?: string;
  assignedCommitteeName?: string;
  assignedPortfolioId?: string;
  assignedPortfolioName?: string;
  assignedAt?: string;
  overrideUsed?: boolean;
  country?: string;
  formAnswers: Record<string, string | number | boolean | string[]>;
  pricingPhaseId?: string;
  pricingPhaseName?: string;
  status: "Confirmed" | "Waitlisted" | "Pending";
  registeredAt: string;
  paid: boolean;
  amount: number;
  /** Allot-first: payment must be completed by this time after allotment release. */
  paymentDeadlineAt?: string;
  /** True when an allotment has been released to the delegate (not a draft). */
  allotmentReleased?: boolean;
  userId?: string;
  userEmail?: string;
  organizerStatus?: "Pending" | "Allotted" | "Waitlisted" | "Rejected" | "Invited";
  delegationId?: string;
  isDelegationHead?: boolean;
  delegationSchoolName?: string;
  delegationInviteToken?: string;
}

export interface UserNotification {
  id: string;
  userId?: string;
  userEmail?: string;
  conferenceId: string;
  /** Present when notification relates to a registration row (API-backed). */
  registrationId?: string;
  title: string;
  message: string;
  type: "assignment" | "waitlist" | "status";
  createdAt: string;
  read: boolean;
}

export interface DelegatePassRecord {
  id: string;
  registrationId: string;
  eventId: string;
  releaseAt: string;
  issuedAt: string;
  status: "ISSUED" | "REVOKED";
  qrToken: string;
  qrImageDataUrl?: string;
}

export interface CheckinRecord {
  id: string;
  passId: string;
  registrationId: string;
  eventId: string;
  checkedInAt: string;
  checkedInByEmail?: string;
  deviceMeta?: string;
}

export interface Resolution {
  id: string;
  title: string;
  committee: string;
  topic: string;
  country: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

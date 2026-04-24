export interface Committee {
  id: string;
  name: string;
  abbreviation: string;
  topic1: string;
  topic2: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  size: number;
}

export interface CommitteePricingInfo {
  committeeId: string;
  committeeName: string;
  price: number;
}

export interface OrganizerCommittee {
  id: string;
  name: string;
  agenda: string;
  description?: string;
  logoImageUrl?: string;
  committeeType?: "UN" | "NON_UN" | "CUSTOM";
  customTypeLabel?: string;
  memberMode?: "UN_COUNTRY" | "CUSTOM_MEMBER";
  // Backward-compatible display type persisted by older records.
  type?: string;
  seatCount: number;
  allottedCount?: number;
  basePrice?: number;
  chairName?: string;
  chairEmail?: string;
  chairs?: OrganizerCommitteeChair[];
  isPublic?: boolean;
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

export type DynamicFieldType = "text" | "textarea" | "select" | "number" | "date" | "checkbox";

export interface DynamicFormField {
  id: string;
  label: string;
  type: DynamicFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[];
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
  applicationType?: "delegate" | "chair" | "delegation" | "organizer" | "other";
  maxDelegatesPerDelegation?: number;
  isOpen?: boolean;
  deadlineOverride?: string;
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
}

export interface User {
  id: string;
  name: string;
  email: string;
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
  overrideUsed?: boolean;
  assignmentHistory?: OrganizerAssignmentLog[];
  responses?: Record<string, string | number | boolean>;
  paid: boolean;
  amount?: number;
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
  title: string;
  city: string;
  country: string;
  organizerName: string;
  venue?: string;
  level: "High School" | "University" | "Open";
  capacity: number;
  startDate: string;
  endDate: string;
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
  awards?: OrganizerAwardConfig[];
  reviews?: ConferenceReview[];
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
  name: string;
  email: string;
  role: "Lead Organizer" | "USG" | "Logistics Head" | "Committee Head";
  permissions: OrganizerPermission[];
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
  sponsorName?: string;
  sponsorLogoUrl?: string;
  description?: string;
  participantId?: string;
  participantName?: string;
  participantUserId?: string;
  participantUserEmail?: string;
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
  title?: string;
  city?: string;
  country?: string;
  organizerName?: string;
  venue?: string;
  description?: string;
  termsAndConditions?: string;
  refundPolicy?: string;
  codeOfConduct?: string;
  faqNotes?: string;
  logoImageUrl?: string;
  bannerImageUrl?: string;
  socialLinks?: OrganizerSocialLinks;
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
  formAnswers: Record<string, string | number | boolean>;
  pricingPhaseId?: string;
  pricingPhaseName?: string;
  status: "Confirmed" | "Waitlisted" | "Pending";
  registeredAt: string;
  paid: boolean;
  amount: number;
  userId?: string;
  userEmail?: string;
  organizerStatus?: "Pending" | "Allotted" | "Waitlisted" | "Rejected" | "Invited";
}

export interface UserNotification {
  id: string;
  userId?: string;
  userEmail?: string;
  conferenceId: string;
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

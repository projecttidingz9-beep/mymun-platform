export type AdminSection = "review" | "overview" | "events";

export type AdminStatsPayload = {
  totals: {
    users: number;
    events: number;
    registrations: number;
    signupsLast30Days: number;
  };
  usersByRole: Record<string, number>;
  eventsByStatus: Record<string, number>;
  registrationsByStatus: Record<string, number>;
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: string;
  }>;
};

export type AdminEventListRow = {
  id: string;
  title: string;
  slug: string | null;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  coverImageUrl: string | null;
  city: string;
  country: string;
  submittedAt: string | null;
  committeeCount: number;
  categoryCount: number;
  owner: { email: string | null; name: string } | null;
  _count: { registrations: number };
};

export type AdminReviewDetail = {
  event: {
    id: string;
    title: string;
    status: string;
    slug: string | null;
    startDate: string;
    endDate: string;
    createdAt: string;
    updatedAt: string;
    coverImageUrl: string | null;
    submittedAt: string | null;
  };
  organizer: {
    name: string;
    email: string | null;
    contactDetail?: string;
  };
  summary: {
    city: string;
    country: string;
    venue?: string;
    level: string;
    capacity: number;
    description?: string;
    registrationDeadline?: string;
    committeeCount: number;
    categoryCount: number;
    adminRejectionNote?: string;
  };
  applicationForm: {
    title: string;
    organizerName: string;
    contactDetail?: string;
    ownerEmail?: string;
    city: string;
    country: string;
    venue?: string;
    level: string;
    capacity: number;
    currency?: string;
    startDate: string;
    endDate: string;
    registrationDeadline?: string;
    description?: string;
    termsAndConditions?: string;
    refundPolicy?: string;
    codeOfConduct?: string;
  };
  review: {
    registrationOpen: boolean;
    registeredCount: number;
    paidCount: number;
    revenueCollected: number;
    platformFeeRate: number;
    platformCut: number;
    organizerNetPayout: number;
  };
  bankingDetails: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  } | null;
  invoiceTemplate: {
    url: string | null;
    fileName: string | null;
  };
};

export interface Committee {
  id: string;
  name: string;
  abbreviation: string;
  topic1: string;
  topic2: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  size: number;
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
  tags: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  school: string;
  country: string;
  registeredConferences: Registration[];
}

export interface OrganizerApplicant {
  id: string;
  name: string;
  school: string;
  countryPreference: string;
  committeePreference: string;
  status: "Pending" | "Accepted" | "Rejected" | "Waitlisted";
  paid: boolean;
}

export interface OrganizerAnnouncement {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface OrganizerConference {
  id: string;
  title: string;
  city: string;
  country: string;
  organizerName: string;
  level: "High School" | "University" | "Open";
  registrationFee: number;
  capacity: number;
  startDate: string;
  endDate: string;
  registrationDeadline?: string;
  status: "Draft" | "Review" | "Published";
  committees: Array<{
    id: string;
    name: string;
    topic: string;
    size: number;
  }>;
  applicants: OrganizerApplicant[];
  announcements: OrganizerAnnouncement[];
}

export interface Registration {
  id: string;
  conferenceId: string;
  conferenceTitle: string;
  committeeId: string;
  committeeName: string;
  country: string;
  status: "Confirmed" | "Waitlisted" | "Pending";
  registeredAt: string;
  paid: boolean;
  amount: number;
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

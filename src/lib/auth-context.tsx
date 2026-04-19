"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Registration, OrganizerConference, OrganizerApplicant, OrganizerAnnouncement } from "./types";
import { MOCK_USER, MOCK_ORGANIZER_CONFERENCES } from "./data";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  organizerConferences: OrganizerConference[];
  login: (email: string, name?: string) => void;
  logout: () => void;
  addRegistration: (reg: Registration) => void;
  addOrganizerConference: (
    payload: Omit<OrganizerConference, "id" | "status" | "applicants" | "announcements">
  ) => void;
  updateOrganizerConferenceStatus: (conferenceId: string, status: OrganizerConference["status"]) => void;
  updateApplicantStatus: (conferenceId: string, applicantId: string, status: OrganizerApplicant["status"]) => void;
  toggleApplicantPayment: (conferenceId: string, applicantId: string) => void;
  addAnnouncement: (conferenceId: string, title: string, message: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  organizerConferences: [],
  login: () => {},
  logout: () => {},
  addRegistration: () => {},
  addOrganizerConference: () => {},
  updateOrganizerConferenceStatus: () => {},
  updateApplicantStatus: () => {},
  toggleApplicantPayment: () => {},
  addAnnouncement: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizerConferences, setOrganizerConferences] = useState<OrganizerConference[]>([]);

  useEffect(() => {
    const storedUser = localStorage.getItem("tidingz_user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("tidingz_user");
      }
    }

    const storedOrganizerConferences = localStorage.getItem("tidingz_organizer_conferences");
    if (storedOrganizerConferences) {
      try {
        setOrganizerConferences(JSON.parse(storedOrganizerConferences));
      } catch {
        localStorage.removeItem("tidingz_organizer_conferences");
      }
    }
  }, []);

  const login = (email: string, name?: string) => {
    const loggedInUser: User = {
      ...MOCK_USER,
      email,
      name: name || email.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      avatar: (name || email)[0].toUpperCase(),
    };
    setUser(loggedInUser);
    localStorage.setItem("tidingz_user", JSON.stringify(loggedInUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("tidingz_user");
  };

  const addRegistration = (reg: Registration) => {
    if (!user) return;
    const updated = {
      ...user,
      registeredConferences: [...user.registeredConferences, reg],
    };
    setUser(updated);
    localStorage.setItem("tidingz_user", JSON.stringify(updated));
  };

  const persistOrganizerConferences = (next: OrganizerConference[]) => {
    setOrganizerConferences(next);
    localStorage.setItem("tidingz_organizer_conferences", JSON.stringify(next));
  };

  const ensureOrganizerSeed = (current: OrganizerConference[]) => {
    if (current.length > 0) return current;
    return MOCK_ORGANIZER_CONFERENCES;
  };

  const addOrganizerConference: AuthContextType["addOrganizerConference"] = (payload) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next: OrganizerConference[] = [
      {
        ...payload,
        id: `org-${Date.now()}`,
        status: "Review",
        applicants: [],
        announcements: [],
      },
      ...current,
    ];
    persistOrganizerConferences(next);
  };

  const updateOrganizerConferenceStatus: AuthContextType["updateOrganizerConferenceStatus"] = (conferenceId, status) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next = current.map((conference) =>
      conference.id === conferenceId ? { ...conference, status } : conference
    );
    persistOrganizerConferences(next);
  };

  const updateApplicantStatus: AuthContextType["updateApplicantStatus"] = (conferenceId, applicantId, status) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        applicants: conference.applicants.map((applicant) =>
          applicant.id === applicantId ? { ...applicant, status } : applicant
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const toggleApplicantPayment: AuthContextType["toggleApplicantPayment"] = (conferenceId, applicantId) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        applicants: conference.applicants.map((applicant) =>
          applicant.id === applicantId ? { ...applicant, paid: !applicant.paid } : applicant
        ),
      };
    });
    persistOrganizerConferences(next);
  };

  const addAnnouncement: AuthContextType["addAnnouncement"] = (conferenceId, title, message) => {
    const current = ensureOrganizerSeed(organizerConferences);
    const announcement: OrganizerAnnouncement = {
      id: `an-${Date.now()}`,
      title,
      message,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const next = current.map((conference) => {
      if (conference.id !== conferenceId) return conference;
      return {
        ...conference,
        announcements: [announcement, ...conference.announcements],
      };
    });
    persistOrganizerConferences(next);
  };

  useEffect(() => {
    if (!user) return;
    if (organizerConferences.length > 0) return;
    persistOrganizerConferences(MOCK_ORGANIZER_CONFERENCES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, organizerConferences.length]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        organizerConferences,
        login,
        logout,
        addRegistration,
        addOrganizerConference,
        updateOrganizerConferenceStatus,
        updateApplicantStatus,
        toggleApplicantPayment,
        addAnnouncement,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

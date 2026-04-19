"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Registration } from "./types";
import { MOCK_USER } from "./data";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, name?: string) => void;
  logout: () => void;
  addRegistration: (reg: Registration) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  login: () => {},
  logout: () => {},
  addRegistration: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("tidingz_user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("tidingz_user");
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

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, addRegistration }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

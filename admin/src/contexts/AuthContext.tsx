import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { PlatformAdmin } from "../types/auth";
import { adminAuthApi } from "../api/adminAuth";

interface AuthContextType {
  admin: PlatformAdmin | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = "orvio_admin_session_token";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate existing session token on mount
  const validateCurrentSession = useCallback(async (token: string | null) => {
    if (!token) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    try {
      const result = await adminAuthApi.validateSession(token);
      if (result && result.admin) {
        setAdmin(result.admin);
        // Also touch session to update last active timestamp
        adminAuthApi.touchSession(token).catch(() => {});
      } else {
        // Expired or invalid
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setSessionToken(null);
        setAdmin(null);
      }
    } catch {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setSessionToken(null);
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    validateCurrentSession(sessionToken);
  }, [sessionToken, validateCurrentSession]);

  // Periodic session activity heartbeat (every 5 minutes)
  useEffect(() => {
    if (!sessionToken || !admin) return;

    const interval = setInterval(() => {
      adminAuthApi.touchSession(sessionToken).catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [sessionToken, admin]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      const response = await adminAuthApi.login({
        email: credentials.email,
        password: credentials.password,
        userAgent: navigator.userAgent,
      });

      localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
      setSessionToken(response.token);
      setAdmin(response.admin);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      if (sessionToken) {
        await adminAuthApi.logout(sessionToken).catch(() => {});
      }
    } finally {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setSessionToken(null);
      setAdmin(null);
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    if (!sessionToken) return;
    try {
      const response = await adminAuthApi.refreshSession(sessionToken);
      if (response?.token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        setSessionToken(response.token);
      }
    } catch {
      await logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        sessionToken,
        isAuthenticated: !!admin,
        isLoading,
        login,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};

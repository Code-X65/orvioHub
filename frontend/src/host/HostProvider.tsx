import React, { createContext, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { resolveHost, type HostContext } from "@orviohub/shared";

export const HostReactContext = createContext<HostContext | null>(null);

export interface HostProviderProps {
  initialValue?: HostContext;
  value?: HostContext;
  children: ReactNode;
}

export const HostProvider: React.FC<HostProviderProps> = ({ initialValue, value, children }) => {
  const location = useLocation();

  const currentHost = useMemo((): HostContext => {
    if (value) return value;
    try {
      return resolveHost(window.location.host, location.pathname);
    } catch {
      return initialValue || { environment: "development", application: "home", hostname: window.location.host };
    }
  }, [value, initialValue, location.pathname]);

  return (
    <HostReactContext.Provider value={currentHost}>
      {children}
    </HostReactContext.Provider>
  );
};


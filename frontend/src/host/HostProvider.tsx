import React, { createContext, type ReactNode } from "react";
import type { HostContext } from "@orviohub/shared";

export const HostReactContext = createContext<HostContext | null>(null);

export interface HostProviderProps {
  value: HostContext;
  children: ReactNode;
}

export const HostProvider: React.FC<HostProviderProps> = ({ value, children }) => {
  return (
    <HostReactContext.Provider value={value}>
      {children}
    </HostReactContext.Provider>
  );
};

import { useContext } from "react";
import type { HostContext } from "@orviohub/shared";
import { HostReactContext } from "./HostProvider";

export function useHost(): HostContext {
  const context = useContext(HostReactContext);
  if (!context) {
    throw new Error("useHost must be used within a HostProvider");
  }
  return context;
}

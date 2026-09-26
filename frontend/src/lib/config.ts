import { getApiUrl, type Environment } from "@orviohub/shared";

const defaultEnv: Environment = import.meta.env?.PROD ? "production" : "development";
const rawApiUrl =
  (import.meta.env?.VITE_API_URL as string) ||
  (import.meta.env?.PROD ? getApiUrl(defaultEnv) : "");

export const API_ORIGIN = rawApiUrl.replace(/\/$/, "");
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

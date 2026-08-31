/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_CONVEX_URL?: string;
  readonly VITE_ADMIN_SESSION_EXPIRY?: string;
  readonly VITE_ADMIN_PASSWORD_MIN_LENGTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

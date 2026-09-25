/**
 * Centralized Error-to-UI Mapper
 * Translates backend error codes, validation failures, network issues, and HTTP statuses
 * into clean, user-friendly, actionable messages.
 */

export interface AppErrorShape {
  message?: string;
  code?: string;
  fields?: Record<string, string | string[]>;
  details?: any;
  status?: number;
  statusCode?: number;
  attemptsRemaining?: number;
  error?: {
    message?: string;
    code?: string;
    fields?: Record<string, string | string[]>;
    details?: any;
  };
}

const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Authentication & Credentials
  USER_ALREADY_EXISTS: 'An account with this email address already exists.',
  EMAIL_ALREADY_IN_USE: 'An account with this email address already exists.',
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect. Please check and try again.',
  ACCOUNT_LOCKED: 'Account has been temporarily locked due to multiple failed login attempts. Please try again later or reset your password.',
  UNAUTHORIZED: 'Your session has expired or you are not signed in. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again to continue.',
  TOKEN_EXPIRED: 'Your session token has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
  STEP_UP_AUTHENTICATION_REQUIRED: 'Security verification required. Please enter your verification code.',
  
  // Rate Limiting & Circuit Breakers
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  CIRCUIT_BREAKER_OPEN: 'Service is temporarily degraded. Please try again in a few moments.',
  CIRCUIT_OPEN: 'Service is temporarily degraded. Please try again in a few moments.',
  
  // Quota & Plan Limits
  PLAN_LIMIT_REACHED: 'You have reached the resource limit for your current subscription plan. Upgrade your plan to increase limits.',
  BRANCH_LIMIT_REACHED: 'You have reached the maximum number of branches for your plan. Please upgrade to add more branches.',
  MEMBER_LIMIT_REACHED: 'You have reached the maximum number of team members for your plan. Please upgrade to invite more members.',
  PRODUCT_LIMIT_REACHED: 'You have reached the maximum catalog product limit for your plan.',
  PLAN_UPGRADE_REQUIRED: 'This feature requires a higher subscription tier. Please upgrade your plan to access it.',
  TRIAL_EXPIRED: 'Your free trial has ended. Please upgrade your subscription to continue managing your resources.',

  // Resources & Conflicts
  NOT_FOUND: 'The requested resource could not be found.',
  WORKSPACE_NOT_FOUND: 'Organization or workspace not found.',
  BRANCH_NOT_FOUND: 'Branch not found.',
  INVITATION_NOT_FOUND: 'Invitation not found or has already expired.',
  CONFLICT: 'A conflict occurred with existing data. Please refresh and try again.',
  DUPLICATE_BRANCH_CODE: 'A branch with this location code already exists in your workspace.',
  CANNOT_DELETE_PRIMARY_BRANCH: 'The primary store branch cannot be removed. Set another branch as primary first.',
  CANNOT_ARCHIVE_PRIMARY_BRANCH: 'The primary store branch cannot be archived without another active primary branch.',
  
  // Offline & Network
  OFFLINE: 'You are currently offline. Please check your internet connection.',
  NETWORK_ERROR: 'Unable to reach the server. Please verify your connection.',
  OFFLINE_MUTATION_QUEUED: 'You are offline. Your changes are saved locally and will sync once you reconnect.',
};

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'The request could not be processed due to invalid input.',
  401: 'You are not signed in or your session has expired.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested item was not found.',
  408: 'The request timed out. Please check your connection and try again.',
  409: 'A conflicting record already exists.',
  422: 'The submitted data was incomplete or invalid.',
  429: 'Too many requests. Please slow down and try again shortly.',
  500: 'An unexpected server error occurred. Our team has been notified.',
  502: 'Bad gateway. The upstream service did not respond.',
  503: 'Service temporarily unavailable. Please try again in a few moments.',
  504: 'Gateway timeout. The server took too long to respond.',
};

/**
 * Maps any error object, string, or ApiError instance to a user-friendly UI message.
 */
export function getErrorMessage(error: unknown, fallbackMessage = 'An unexpected error occurred. Please try again.'): string {
  if (!error) return fallbackMessage;

  // Handle string errors
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed ? trimmed : fallbackMessage;
  }

  const err = error as AppErrorShape;

  // 1. Check code mapping
  const code = (err.code || err.error?.code || '').toUpperCase();
  if (code && ERROR_CODE_MESSAGES[code]) {
    return ERROR_CODE_MESSAGES[code];
  }

  // 2. Extract validation field errors if present
  const fields = err.fields || err.error?.fields;
  if (fields && typeof fields === 'object' && Object.keys(fields).length > 0) {
    const firstKey = Object.keys(fields)[0];
    const val = fields[firstKey];
    if (Array.isArray(val) && val[0]) {
      return String(val[0]);
    }
    if (typeof val === 'string' && val) {
      return val;
    }
  }

  // 3. Check for specific message text provided by backend
  const rawMsg = err.error?.message || err.message;
  if (rawMsg && typeof rawMsg === 'string') {
    const trimmed = rawMsg.trim();
    // Filter out technical low-level stack or HTTP wrapper texts
    if (
      trimmed &&
      !trimmed.startsWith('HTTP_') &&
      !trimmed.startsWith('Request failed with status') &&
      !trimmed.includes('FetchError') &&
      !trimmed.includes('Failed to fetch')
    ) {
      return trimmed;
    }
  }

  // 4. Fallback to HTTP status code mapping
  const status = err.status || err.statusCode;
  if (typeof status === 'number' && HTTP_STATUS_MESSAGES[status]) {
    return HTTP_STATUS_MESSAGES[status];
  }

  // 5. If network / offline error message detected
  if (rawMsg && (rawMsg.includes('Failed to fetch') || rawMsg.includes('NetworkError') || rawMsg.includes('offline'))) {
    return ERROR_CODE_MESSAGES.NETWORK_ERROR;
  }

  return fallbackMessage;
}

/**
 * Extracts structured field errors from an API error response for forms.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  if (!error || typeof error !== 'object') return {};

  const err = error as AppErrorShape;
  const rawFields = err.fields || err.error?.fields;
  if (!rawFields || typeof rawFields !== 'object') return {};

  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFields)) {
    if (Array.isArray(v) && v[0]) {
      result[k] = String(v[0]);
    } else if (typeof v === 'string') {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Checks whether an error matches one or more specific error codes.
 */
export function isErrorCode(error: unknown, ...codes: string[]): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as AppErrorShape;
  const actualCode = (err.code || err.error?.code || '').toUpperCase();
  if (!actualCode) return false;
  return codes.map((c) => c.toUpperCase()).includes(actualCode);
}

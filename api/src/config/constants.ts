export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  MEMBER: 'MEMBER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ONBOARDING_STEPS = {
  NOT_STARTED: 'NOT_STARTED',
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  ORGANIZATION_CREATION: 'ORGANIZATION_CREATION',
  ORGANIZATION_CREATED: 'ORGANIZATION_CREATED',
  ORGANIZATION_CONFIGURED: 'ORGANIZATION_CONFIGURED',
  MODULE_SELECTION: 'MODULE_SELECTION',
  MODULES_SELECTED: 'MODULES_SELECTED',
  WORKSPACE_INITIALIZATION: 'WORKSPACE_INITIALIZATION',
  WORKSPACE_READY: 'WORKSPACE_READY',
  TEAM_INVITATION: 'TEAM_INVITATION',
  TEAM_INVITED: 'TEAM_INVITED',
  COMPLETED: 'COMPLETED',
} as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

export const ONBOARDING_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUS)[keyof typeof ONBOARDING_STATUS];

export const AVAILABLE_MODULES = [
  'customers',
  'sales',
  'inventory',
  'finance',
  'hr',
  'projects',
] as const;

export type ModuleId = (typeof AVAILABLE_MODULES)[number];

export const MODULE_METADATA: Record<
  ModuleId,
  { name: string; description: string; defaultSettings: Record<string, unknown> }
> = {
  customers: {
    name: 'Customers',
    description: 'Manage contacts, accounts, and customer lifecycles.',
    defaultSettings: { defaultPipeline: 'Standard', initialStage: 'Lead' },
  },
  sales: {
    name: 'Sales',
    description: 'Track deals, quotes, and revenue pipelines.',
    defaultSettings: { currency: 'USD', taxRate: 0 },
  },
  inventory: {
    name: 'Inventory',
    description: 'Stock tracking, warehouses, and item catalogs.',
    defaultSettings: { defaultWarehouse: 'Main Warehouse' },
  },
  finance: {
    name: 'Finance',
    description: 'Invoicing, billing, expenses, and financial reporting.',
    defaultSettings: { fiscalYearStartMonth: 1 },
  },
  hr: {
    name: 'Human Resources',
    description: 'Employee directory, departments, and onboarding.',
    defaultSettings: { defaultDepartment: 'General' },
  },
  projects: {
    name: 'Projects',
    description: 'Task management, sprints, and project timelines.',
    defaultSettings: { defaultStatus: 'Planning' },
  },
};

export const MODULE_DEPENDENCIES: Record<ModuleId, ModuleId[]> = {
  customers: [],
  sales: ['customers'],
  inventory: [],
  finance: [],
  hr: [],
  projects: [],
};

export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ONBOARDING_NOT_FOUND: 'ONBOARDING_NOT_FOUND',
  ONBOARDING_ALREADY_COMPLETED: 'ONBOARDING_ALREADY_COMPLETED',
  INVALID_ONBOARDING_STEP: 'INVALID_ONBOARDING_STEP',
  ONBOARDING_INCOMPLETE: 'ONBOARDING_INCOMPLETE',

  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  ORGANIZATION_ACCESS_DENIED: 'ORGANIZATION_ACCESS_DENIED',
  ORGANIZATION_ALREADY_EXISTS: 'ORGANIZATION_ALREADY_EXISTS',
  INVALID_ORGANIZATION_NAME: 'INVALID_ORGANIZATION_NAME',
  INVALID_COUNTRY: 'INVALID_COUNTRY',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  CANNOT_REMOVE_LAST_OWNER: 'CANNOT_REMOVE_LAST_OWNER',
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',

  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_SLUG_ALREADY_EXISTS: 'WORKSPACE_SLUG_ALREADY_EXISTS',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',

  INVALID_MODULE: 'INVALID_MODULE',
  INVALID_MODULE_DEPENDENCY: 'INVALID_MODULE_DEPENDENCY',
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  MODULE_ALREADY_ENABLED: 'MODULE_ALREADY_ENABLED',
  MODULE_NOT_ENABLED: 'MODULE_NOT_ENABLED',

  INVITATION_NOT_FOUND: 'INVITATION_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_ALREADY_ACCEPTED: 'INVITATION_ALREADY_ACCEPTED',
  INVITATION_EMAIL_MISMATCH: 'INVITATION_EMAIL_MISMATCH',
  INVITATION_ALREADY_EXISTS: 'INVITATION_ALREADY_EXISTS',
  INVITATION_ACCESS_DENIED: 'INVITATION_ACCESS_DENIED',

  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  ROLE_ASSIGNMENT_DENIED: 'ROLE_ASSIGNMENT_DENIED',

  OAUTH_NOT_CONFIGURED: 'OAUTH_NOT_CONFIGURED',
  OAUTH_STATE_INVALID: 'OAUTH_STATE_INVALID',
  OAUTH_STATE_EXPIRED: 'OAUTH_STATE_EXPIRED',
  OAUTH_ACCESS_DENIED: 'OAUTH_ACCESS_DENIED',
  OAUTH_CODE_INVALID: 'OAUTH_CODE_INVALID',
  OAUTH_PROVIDER_ERROR: 'OAUTH_PROVIDER_ERROR',
  OAUTH_IDENTITY_INVALID: 'OAUTH_IDENTITY_INVALID',
  OAUTH_EMAIL_UNVERIFIED: 'OAUTH_EMAIL_UNVERIFIED',
  OAUTH_ACCOUNT_CONFLICT: 'OAUTH_ACCOUNT_CONFLICT',
  OAUTH_ACCOUNT_LINK_REQUIRED: 'OAUTH_ACCOUNT_LINK_REQUIRED',
  OAUTH_IDENTITY_ALREADY_LINKED: 'OAUTH_IDENTITY_ALREADY_LINKED',

  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_2FA_CODE: 'INVALID_2FA_CODE',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  CANNOT_REMOVE_ONLY_LOGIN_METHOD: 'CANNOT_REMOVE_ONLY_LOGIN_METHOD',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  IDENTITY_NOT_FOUND: 'IDENTITY_NOT_FOUND',
  SOLE_OWNER_CANNOT_LEAVE_WORKSPACE: 'SOLE_OWNER_CANNOT_LEAVE_WORKSPACE',
  NO_ACTIVE_DELETION_REQUEST: 'NO_ACTIVE_DELETION_REQUEST',
  INVALID_PHONE_VERIFICATION_CODE: 'INVALID_PHONE_VERIFICATION_CODE',
  EXPIRED_PHONE_VERIFICATION_CODE: 'EXPIRED_PHONE_VERIFICATION_CODE',
  INVALID_GRANT: 'INVALID_GRANT',
  AUTHORIZATION_CODE_EXPIRED: 'AUTHORIZATION_CODE_EXPIRED',
  AUTHORIZATION_CODE_ALREADY_USED: 'AUTHORIZATION_CODE_ALREADY_USED',
  REDIRECT_URI_MISMATCH: 'REDIRECT_URI_MISMATCH',
  INVALID_CLIENT: 'INVALID_CLIENT',
  UNSUPPORTED_GRANT_TYPE: 'UNSUPPORTED_GRANT_TYPE',
  INVALID_CODE_VERIFIER: 'INVALID_CODE_VERIFIER',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  PRODUCT_NOT_ENTITLED: 'PRODUCT_NOT_ENTITLED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const WORKSPACE_STATUSES = {
  CREATING: 'creating',
  ACTIVE: 'active',
  SETUP_INCOMPLETE: 'setup_incomplete',
  TRIAL: 'trial',
  PAST_DUE: 'past_due',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
  DELETING: 'deleting',
  DELETED: 'deleted',
} as const;

export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[keyof typeof WORKSPACE_STATUSES];

export const WORKSPACE_MEMBERSHIP_STATUSES = {
  INVITED: 'invited',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  REMOVED: 'removed',
  LEFT: 'left',
} as const;

export type WorkspaceMembershipStatus = (typeof WORKSPACE_MEMBERSHIP_STATUSES)[keyof typeof WORKSPACE_MEMBERSHIP_STATUSES];

export const PRODUCT_ENTITLEMENT_STATUSES = {
  AVAILABLE: 'available',
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
} as const;

export type ProductEntitlementStatus = (typeof PRODUCT_ENTITLEMENT_STATUSES)[keyof typeof PRODUCT_ENTITLEMENT_STATUSES];

export const INVITATION_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  CANCELLED: 'cancelled',
} as const;

export type InvitationStatus = (typeof INVITATION_STATUSES)[keyof typeof INVITATION_STATUSES];

export const AUDIT_EVENTS = {
  AUTH_SIGNUP_COMPLETED: 'auth.signup_completed',
  AUTH_LOGIN_SUCCESS: 'auth.login_success',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGOUT_ALL: 'auth.logout_all',
  AUTH_SESSION_REVOKED: 'auth.session_revoked',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  AUTH_PASSWORD_RESET_COMPLETED: 'auth.password_reset_completed',
  AUTH_EMAIL_VERIFIED: 'auth.email_verified',
  AUTH_PROVIDER_LINKED: 'auth.provider_linked',
  AUTH_PROVIDER_UNLINKED: 'auth.provider_unlinked',
  AUTH_OAUTH_CODE_ISSUED: 'auth.oauth.code_issued',
  AUTH_OAUTH_TOKEN_EXCHANGED: 'auth.oauth.token_exchanged',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_EMAIL_CHANGED: 'user.email_changed',
  USER_PHONE_CHANGED: 'user.phone_changed',
  USER_PREFERENCES_UPDATED: 'user.preferences_updated',
  USER_CONSENT_RECORDED: 'user.consent_recorded',
  USER_CONSENT_WITHDRAWN: 'user.consent_withdrawn',
  USER_DATA_EXPORT_REQUESTED: 'user.data_export_requested',
  USER_ACCOUNT_DELETION_REQUESTED: 'user.account_deletion_requested',
  USER_ACCOUNT_DELETION_CANCELLED: 'user.account_deletion_cancelled',
  USER_ACCOUNT_DELETED: 'user.account_deleted',
  USER_WORKSPACE_LEFT: 'user.workspace_left',
  USER_SUSPICIOUS_REPORTED: 'user.suspicious_reported',

  // Workspace Audit Events
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_ARCHIVED: 'workspace.archived',
  WORKSPACE_RESTORED: 'workspace.restored',
  WORKSPACE_DELETION_REQUESTED: 'workspace.deletion_requested',
  WORKSPACE_DELETED: 'workspace.deleted',
  WORKSPACE_OWNERSHIP_TRANSFER_STARTED: 'workspace.ownership_transfer_started',
  WORKSPACE_OWNERSHIP_TRANSFERRED: 'workspace.ownership_transferred',
  WORKSPACE_MEMBER_INVITED: 'workspace.member_invited',
  WORKSPACE_INVITATION_ACCEPTED: 'workspace.invitation_accepted',
  WORKSPACE_INVITATION_DECLINED: 'workspace.invitation_declined',
  WORKSPACE_INVITATION_REVOKED: 'workspace.invitation_revoked',
  WORKSPACE_MEMBER_ROLE_CHANGED: 'workspace.member_role_changed',
  WORKSPACE_MEMBER_SUSPENDED: 'workspace.member_suspended',
  WORKSPACE_MEMBER_RESTORED: 'workspace.member_restored',
  WORKSPACE_MEMBER_REMOVED: 'workspace.member_removed',
  WORKSPACE_PRODUCT_ACTIVATED: 'workspace.product_activated',
  WORKSPACE_PRODUCT_DEACTIVATED: 'workspace.product_deactivated',
  WORKSPACE_BRANCH_CREATED: 'workspace.branch_created',
  WORKSPACE_BRANCH_UPDATED: 'workspace.branch_updated',
  WORKSPACE_BRANCH_ARCHIVED: 'workspace.branch_archived',
  WORKSPACE_WORKSPACE_SELECTED: 'workspace.workspace_selected',
  WORKSPACE_EXPORT_REQUESTED: 'workspace.export_requested',
  WORKSPACE_SUPPORT_ACCESS_GRANTED: 'workspace.support_access_granted',
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

export const PRODUCT_CATALOG = {
  inventory: {
    key: 'inventory',
    name: 'Inventory Management',
    tagline: 'Multi-location inventory, stock control and point of sale',
    color: '#D97706',
    allowedRedirectUris: ['http://localhost:5173', 'https://inventory.orviohub.com'],
  },
  taskmanagement: {
    key: 'taskmanagement',
    name: 'Task Management',
    tagline: 'Projects, tasks and team collaboration',
    color: '#4F46E5',
    allowedRedirectUris: ['http://localhost:5173', 'https://taskmanagement.orviohub.com'],
  },
  hub: {
    key: 'hub',
    name: 'orvioHub',
    tagline: 'Unified Business Operations Platform',
    color: '#4F46E5',
    allowedRedirectUris: ['http://localhost:5173', 'http://localhost:3000', 'https://hub.orvio.com', 'https://app.orviohub.com'],
  },
  finance: {
    key: 'finance',
    name: 'orvioFinance',
    tagline: 'Invoicing, Payments & Financial Accounting',
    color: '#059669',
    allowedRedirectUris: ['http://localhost:5173', 'https://finance.orvio.com'],
  },
  retail: {
    key: 'retail',
    name: 'orvioRetail',
    tagline: 'Point of Sale & Real-time Inventory',
    color: '#D97706',
    allowedRedirectUris: ['http://localhost:5173', 'https://pos.orvio.com', 'https://retail.orvio.com'],
  },
  people: {
    key: 'people',
    name: 'orvioPeople',
    tagline: 'Payroll, HR & Employee Directory',
    color: '#7C3AED',
    allowedRedirectUris: ['http://localhost:5173', 'https://people.orvio.com', 'https://hr.orvio.com'],
  },
} as const;

export type ProductKey = keyof typeof PRODUCT_CATALOG;

export const INVITATION_EXPIRY_DAYS = 7;



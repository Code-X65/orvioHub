export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type OnboardingStep = 
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFICATION'
  | 'ORGANIZATION_CREATION'
  | 'ORGANIZATION_CONFIGURED'
  | 'MODULE_SELECTION'
  | 'WORKSPACE_INITIALIZATION'
  | 'WORKSPACE_READY'
  | 'TEAM_INVITATION'
  | 'COMPLETED';

export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER';

export type ModuleId = 'customers' | 'sales' | 'inventory' | 'finance' | 'hr' | 'projects';

export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredName?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  country?: string;
  state?: string;
  stateCode?: string;
  lga?: string;
  city?: string;
  phone?: string;
  phoneVerifiedAt?: number;
  phoneVisibility?: 'private' | 'workspace';
  emailVerified: boolean;
  avatar?: string;
  avatarUrl?: string;
  timezone?: string;
  language?: string;
  locale?: string;
  dateFormat?: string;
  numberFormat?: string;
  currencyPreference?: string;
  firstDayOfWeek?: 'monday' | 'sunday';
  theme?: 'dark' | 'light' | 'system';
  layoutDensity?: 'compact' | 'comfortable';
  twoFactorEnabled?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string;
  country: string;
  timezone: string;
  website?: string;
  size?: string;
  logo?: string;
}

export interface Membership {
  organization: Pick<Organization, 'id' | 'name' | 'slug'>;
  role: Role;
  status: string;
}

export interface OnboardingState {
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  completedSteps?: string[];
  canSkipCurrentStep?: boolean;
  organization?: any;
  membership?: any;
  workspace?: any;
}

export interface APIError {
  code: string;
  message: string;
  fields?: Record<string, string>;
  details?: any;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  message?: string;
}

// Responses
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
  onboarding: OnboardingState;
  memberships?: Membership[];
}

export interface RefreshResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface MeResponse {
  user: User;
  memberships: Membership[];
  onboarding: OnboardingState;
}

export interface AuditLogItem {
  id: string;
  actorId?: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  } | null;
  organizationId?: string;
  action: string;
  resource: string;
  metadata?: any;
  timestamp: number;
}

export interface InvitationItem {
  id: string;
  email: string;
  role: Role;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: number;
  createdAt: number;
}

// Phase 2: Centralized Auth & SSO Ecosystem Types
export type ProductKey = 'hub' | 'finance' | 'retail' | 'people' | 'accounts';

export interface ProductInfo {
  key: ProductKey;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  accentColor: string;
  gradient: string;
  iconName: string;
}

export interface RememberedAccount {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatarUrl?: string;
  token?: string;
  refreshToken?: string;
  lastLoginAt: number;
}

export interface DeviceSession {
  id: string;
  deviceId?: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
  authenticationMethod?: string;
  createdAt: number;
  lastActiveAt?: number;
  isCurrent?: boolean;
}

export interface LinkedIdentityItem {
  id: string;
  provider: 'password' | 'google' | 'facebook' | 'apple' | 'phone';
  providerEmail?: string;
  providerSubject?: string;
  createdAt: number;
  isPrimary?: boolean;
}

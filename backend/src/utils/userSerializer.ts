import type { UserRecord } from '../services/dataService.js';

export interface PublicUser {
  id: string;
  email: string;
  emailNormalized?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  preferredName?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  avatar?: string;
  avatarUrl?: string;
  phone?: string;
  phoneVerified: boolean;
  phoneVerifiedAt?: number;
  phoneVisibility?: 'private' | 'workspace';
  country?: string;
  state?: string;
  city?: string;
  timezone: string;
  language: string;
  locale?: string;
  dateFormat: string;
  numberFormat: string;
  currencyPreference: string;
  firstDayOfWeek: 'monday' | 'sunday';
  theme: 'dark' | 'light' | 'system';
  layoutDensity: 'compact' | 'comfortable';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  emailVerified: boolean;
  emailVerifiedAt?: number;
  twoFactorEnabled: boolean;
  createdAt?: number;
  updatedAt?: number;
  lastLoginAt?: number;
}

export function toPublicUser(user: any): PublicUser | null {
  if (!user) return null;

  const id = user.id || user._id;
  const avatar = user.avatarUrl || user.avatar || undefined;

  return {
    id: String(id),
    email: user.email,
    emailNormalized: user.emailNormalized || (user.email ? user.email.toLowerCase().trim() : undefined),
    name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    preferredName: user.preferredName,
    jobTitle: user.jobTitle,
    department: user.department,
    bio: user.bio,
    avatar,
    avatarUrl: avatar,
    phone: user.phone,
    phoneVerified: Boolean(user.phoneVerifiedAt),
    phoneVerifiedAt: user.phoneVerifiedAt,
    phoneVisibility: user.phoneVisibility || 'private',
    country: user.country,
    state: user.state,
    city: user.city,
    timezone: user.timezone || 'Africa/Lagos',
    language: user.language || 'en',
    locale: user.locale,
    dateFormat: user.dateFormat || 'DD/MM/YYYY',
    numberFormat: user.numberFormat || '1,234.56',
    currencyPreference: user.currencyPreference || 'NGN',
    firstDayOfWeek: (user.firstDayOfWeek as 'monday' | 'sunday') || 'monday',
    theme: (user.theme as 'dark' | 'light' | 'system') || 'dark',
    layoutDensity: (user.layoutDensity as 'compact' | 'comfortable') || 'comfortable',
    status: user.status || 'ACTIVE',
    emailVerified: Boolean(user.emailVerified),
    emailVerifiedAt: user.emailVerifiedAt,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: number;
  lastLoginIp?: string;
  createdAt?: number;
}

export interface AdminSession {
  token: string;
  admin: PlatformAdmin;
  expiresAt: number;
  lastActiveAt?: number;
}

export interface AdminAuditLog {
  _id: string;
  adminId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}

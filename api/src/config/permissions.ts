export const PLATFORM_ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  VIEWER: 'viewer',
} as const;

export type PlatformRole = (typeof PLATFORM_ROLES)[keyof typeof PLATFORM_ROLES] | 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export const INVENTORY_ROLES = {
  OWNER: 'inventory_owner',
  MANAGER: 'inventory_manager',
  SALES_ATTENDANT: 'sales_attendant',
  STOCK_MANAGER: 'stock_manager',
  ACCOUNTANT: 'accountant',
  VIEWER: 'inventory_viewer',
} as const;

export type InventoryRole = (typeof INVENTORY_ROLES)[keyof typeof INVENTORY_ROLES] | string;

export const TASK_MANAGEMENT_ROLES = {
  OWNER: 'task_owner',
  PROJECT_MANAGER: 'project_manager',
  CONTRIBUTOR: 'contributor',
  VIEWER: 'viewer',
} as const;

export type TaskManagementRole = (typeof TASK_MANAGEMENT_ROLES)[keyof typeof TASK_MANAGEMENT_ROLES] | string;

export const PERMISSIONS = {
  // Platform / Workspace permissions
  WORKSPACE_VIEW: 'workspace.view',
  WORKSPACE_UPDATE: 'workspace.update',
  WORKSPACE_MANAGE_MEMBERS: 'workspace.manage_members',
  WORKSPACE_MANAGE_ROLES: 'workspace.manage_roles',
  WORKSPACE_MANAGE_PRODUCTS: 'workspace.manage_products',
  WORKSPACE_MANAGE_BILLING: 'workspace.manage_billing',
  WORKSPACE_DELETE: 'workspace.delete',
  WORKSPACE_ARCHIVE: 'workspace.archive',

  // Inventory permissions
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_SELL: 'inventory.sell',
  INVENTORY_MANAGE_PRODUCTS: 'inventory.manage_products',
  INVENTORY_RECEIVE_STOCK: 'inventory.receive_stock',
  INVENTORY_ADJUST_STOCK: 'inventory.adjust_stock',
  INVENTORY_VIEW_REPORTS: 'inventory.view_reports',
  INVENTORY_EXPORT_DATA: 'inventory.export_data',

  // Task Management permissions
  TASK_VIEW: 'task.view',
  TASK_CREATE: 'task.create',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',
  TASK_ASSIGN: 'task.assign',
  TASK_MANAGE_PROJECTS: 'task.manage_projects',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS] | string;

export const DEFAULT_PLATFORM_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'],
  OWNER: ['*'],
  admin: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_UPDATE,
    PERMISSIONS.WORKSPACE_MANAGE_MEMBERS,
    PERMISSIONS.WORKSPACE_MANAGE_ROLES,
    PERMISSIONS.WORKSPACE_MANAGE_PRODUCTS,
    PERMISSIONS.WORKSPACE_MANAGE_BILLING,
    PERMISSIONS.WORKSPACE_ARCHIVE,
  ],
  ADMIN: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.WORKSPACE_UPDATE,
    PERMISSIONS.WORKSPACE_MANAGE_MEMBERS,
    PERMISSIONS.WORKSPACE_MANAGE_ROLES,
    PERMISSIONS.WORKSPACE_MANAGE_PRODUCTS,
    PERMISSIONS.WORKSPACE_MANAGE_BILLING,
    PERMISSIONS.WORKSPACE_ARCHIVE,
  ],
  member: [PERMISSIONS.WORKSPACE_VIEW],
  MEMBER: [PERMISSIONS.WORKSPACE_VIEW],
  viewer: [PERMISSIONS.WORKSPACE_VIEW],
  VIEWER: [PERMISSIONS.WORKSPACE_VIEW],
};

export const DEFAULT_PRODUCT_ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  inventory: {
    inventory_owner: ['*'],
    INVENTORY_OWNER: ['*'],
    owner: ['*'],
    OWNER: ['*'],
    inventory_manager: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_SELL,
      PERMISSIONS.INVENTORY_MANAGE_PRODUCTS,
      PERMISSIONS.INVENTORY_RECEIVE_STOCK,
      PERMISSIONS.INVENTORY_ADJUST_STOCK,
      PERMISSIONS.INVENTORY_VIEW_REPORTS,
      PERMISSIONS.INVENTORY_EXPORT_DATA,
    ],
    sales_attendant: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_SELL,
    ],
    stock_manager: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MANAGE_PRODUCTS,
      PERMISSIONS.INVENTORY_RECEIVE_STOCK,
      PERMISSIONS.INVENTORY_ADJUST_STOCK,
    ],
    accountant: [
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_VIEW_REPORTS,
      PERMISSIONS.INVENTORY_EXPORT_DATA,
    ],
    inventory_viewer: [
      PERMISSIONS.INVENTORY_VIEW,
    ],
    viewer: [
      PERMISSIONS.INVENTORY_VIEW,
    ],
  },
  taskmanagement: {
    task_owner: ['*'],
    TASK_OWNER: ['*'],
    owner: ['*'],
    OWNER: ['*'],
    project_manager: [
      PERMISSIONS.TASK_VIEW,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_DELETE,
      PERMISSIONS.TASK_ASSIGN,
      PERMISSIONS.TASK_MANAGE_PROJECTS,
    ],
    contributor: [
      PERMISSIONS.TASK_VIEW,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_UPDATE,
    ],
    viewer: [
      PERMISSIONS.TASK_VIEW,
    ],
  },
};

/**
 * Resolves whether a given set of granted permissions (or roles) includes a target permission.
 */
export function hasPermission(
  grantedPermissions: string[],
  requiredPermission: string,
  isOwnerOrAdmin: boolean = false
): boolean {
  if (isOwnerOrAdmin) return true;
  if (grantedPermissions.includes('*')) return true;
  return grantedPermissions.includes(requiredPermission);
}

/**
 * Returns default permissions for a product role.
 */
export function getProductRoleDefaultPermissions(productKey: string, role: string): string[] {
  const productRoles = DEFAULT_PRODUCT_ROLE_PERMISSIONS[productKey.toLowerCase()];
  if (!productRoles) return [];
  return productRoles[role] || productRoles[role.toLowerCase()] || [];
}

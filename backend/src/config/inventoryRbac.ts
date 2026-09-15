export const INVENTORY_ROLES = {
  INVENTORY_OWNER: 'inventory_owner',
  INVENTORY_MANAGER: 'inventory_manager',
  CASHIER: 'cashier',
  SALES_ATTENDANT: 'sales_attendant',
  STOCK_MANAGER: 'stock_manager',
  ACCOUNTANT: 'accountant',
  INVENTORY_VIEWER: 'inventory_viewer',
} as const;

export type InventoryRole = (typeof INVENTORY_ROLES)[keyof typeof INVENTORY_ROLES];

export const INVENTORY_PERMISSIONS = {
  VIEW_INVENTORY: 'view_inventory',
  MANAGE_PRODUCTS: 'manage_products',
  RECEIVE_PURCHASES: 'receive_purchases',
  ADJUST_STOCK: 'adjust_stock',
  RECORD_SALES: 'record_sales',
  VIEW_SALES: 'view_sales',
  CANCEL_SALES: 'cancel_sales',
  PROCESS_RETURNS: 'process_returns',
  VIEW_COST_PRICES: 'view_cost_prices',
  VIEW_PROFITS: 'view_profits',
  VIEW_REPORTS: 'view_reports',
  EXPORT_DATA: 'export_data',
  MANAGE_MEMBERS: 'manage_members',
  MANAGE_BRANCHES: 'manage_branches',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_BRANCH_MEMBERS: 'manage_branch_members',
  VIEW_PRODUCTS: 'view_products',
  VIEW_SELLING_PRICES: 'view_selling_prices',
  PROCESS_PAYMENTS: 'process_payments',
  ISSUE_RECEIPTS: 'issue_receipts',
  VIEW_OWN_SALES: 'view_own_sales',
  VIEW_STOCK: 'view_stock',
  STOCK_COUNTS: 'stock_counts',
  VIEW_STOCK_HISTORY: 'view_stock_history',
  VIEW_PURCHASES: 'view_purchases',
  VIEW_PAYMENTS: 'view_payments',
  VIEW_CUSTOMER_BALANCES: 'view_customer_balances',
  VIEW_SUPPLIER_BALANCES: 'view_supplier_balances',
  EXPORT_REPORTS: 'export_reports',
  CHANGE_ROLES: 'change_roles',
  SUSPEND_MEMBERS: 'suspend_members',
  REMOVE_MEMBERS: 'remove_members',
  TRANSFER_MEMBERS: 'transfer_members',
} as const;

export type InventoryPermission = (typeof INVENTORY_PERMISSIONS)[keyof typeof INVENTORY_PERMISSIONS];


export const INVENTORY_ROLE_PERMISSIONS: Record<InventoryRole, InventoryPermission[]> = {
  inventory_owner: [
    'view_inventory',
    'manage_products',
    'receive_purchases',
    'adjust_stock',
    'record_sales',
    'cancel_sales',
    'process_returns',
    'view_cost_prices',
    'view_profits',
    'view_reports',
    'export_data',
    'manage_members',
    'manage_branches',
    'manage_settings',
    'manage_branch_members',
    'change_roles',
    'suspend_members',
    'remove_members',
    'transfer_members',
    'view_products',
    'view_selling_prices',
    'process_payments',
    'issue_receipts',
    'view_own_sales',
    'view_stock',
    'stock_counts',
    'view_stock_history',
    'view_purchases',
    'view_payments',
    'view_customer_balances',
    'view_supplier_balances',
    'export_reports',
  ],
  inventory_manager: [
    'view_inventory',
    'manage_products',
    'receive_purchases',
    'adjust_stock',
    'record_sales',
    'process_returns',
    'view_reports',
    'manage_branch_members',
    'change_roles',
    'suspend_members',
    'transfer_members',
    'view_products',
    'view_selling_prices',
    'process_payments',
    'issue_receipts',
    'view_own_sales',
    'view_stock',
    'stock_counts',
    'view_stock_history',
  ],
  cashier: [
    'view_products',
    'view_selling_prices',
    'record_sales',
    'process_payments',
    'issue_receipts',
    'view_own_sales',
  ],
  sales_attendant: [
    'view_products',
    'view_selling_prices',
    'record_sales',
    'process_payments',
    'issue_receipts',
    'view_own_sales',
  ],
  stock_manager: [
    'view_products',
    'view_stock',
    'receive_purchases',
    'stock_counts',
    'adjust_stock',
    'view_stock_history',
  ],
  accountant: [
    'view_sales',
    'view_purchases',
    'view_payments',
    'view_customer_balances',
    'view_supplier_balances',
    'view_reports',
    'export_reports',
  ],
  inventory_viewer: [
    'view_products',
    'view_stock',
    'view_reports',
  ],
};

export const STANDARD_INVENTORY_PERMISSIONS = {
  VIEW: 'inventory.view',
  VIEW_PRODUCTS: 'inventory.view_products',
  MANAGE_PRODUCTS: 'inventory.manage_products',
  VIEW_STOCK: 'inventory.view_stock',
  RECEIVE_STOCK: 'inventory.receive_stock',
  ADJUST_STOCK: 'inventory.adjust_stock',
  RECORD_SALES: 'inventory.record_sales',
  CANCEL_SALES: 'inventory.cancel_sales',
  PROCESS_RETURNS: 'inventory.process_returns',
  VIEW_COST: 'inventory.view_cost',
  VIEW_PROFIT: 'inventory.view_profit',
  VIEW_REPORTS: 'inventory.view_reports',
  EXPORT_DATA: 'inventory.export_data',
  MANAGE_MEMBERS: 'inventory.manage_members',
  MANAGE_BRANCH_ACCESS: 'inventory.manage_branch_access',
  CHANGE_ROLES: 'inventory.change_roles',
  SUSPEND_MEMBERS: 'inventory.suspend_members',
  REMOVE_MEMBERS: 'inventory.remove_members',
  TRANSFER_MEMBERS: 'inventory.transfer_members',
  MANAGE_SETTINGS: 'inventory.manage_settings',
} as const;

export type StandardInventoryPermission =
  (typeof STANDARD_INVENTORY_PERMISSIONS)[keyof typeof STANDARD_INVENTORY_PERMISSIONS];

export const STANDARD_ROLE_PERMISSIONS: Record<InventoryRole, string[]> = {
  inventory_owner: [
    'inventory.view',
    'inventory.view_products',
    'inventory.manage_products',
    'inventory.view_stock',
    'inventory.receive_stock',
    'inventory.adjust_stock',
    'inventory.record_sales',
    'inventory.cancel_sales',
    'inventory.process_returns',
    'inventory.view_cost',
    'inventory.view_profit',
    'inventory.view_reports',
    'inventory.export_data',
    'inventory.manage_members',
    'inventory.manage_branch_access',
    'inventory.change_roles',
    'inventory.suspend_members',
    'inventory.remove_members',
    'inventory.transfer_members',
    'inventory.manage_settings',
  ],
  inventory_manager: [
    'inventory.view',
    'inventory.view_products',
    'inventory.manage_products',
    'inventory.view_stock',
    'inventory.receive_stock',
    'inventory.adjust_stock',
    'inventory.record_sales',
    'inventory.process_returns',
    'inventory.view_reports',
    'inventory.manage_branch_access',
    'inventory.transfer_members',
    'inventory.suspend_members',
  ],
  cashier: [
    'inventory.view',
    'inventory.view_products',
    'inventory.record_sales',
    'inventory.process_returns',
  ],
  sales_attendant: [
    'inventory.view',
    'inventory.view_products',
    'inventory.record_sales',
    'inventory.process_returns',
  ],
  stock_manager: [
    'inventory.view',
    'inventory.view_products',
    'inventory.view_stock',
    'inventory.receive_stock',
    'inventory.adjust_stock',
  ],
  accountant: [
    'inventory.view',
    'inventory.view_cost',
    'inventory.view_profit',
    'inventory.view_reports',
    'inventory.export_data',
  ],
  inventory_viewer: [
    'inventory.view',
    'inventory.view_products',
    'inventory.view_stock',
    'inventory.view_reports',
  ],
};

export function getRolePermissions(role: InventoryRole | string): string[] {
  const standard = STANDARD_ROLE_PERMISSIONS[role as InventoryRole];
  if (standard) return standard;
  const legacy = INVENTORY_ROLE_PERMISSIONS[role as InventoryRole];
  return legacy ? (legacy as unknown as string[]) : [];
}

export function hasInventoryPermission(
  userRole: InventoryRole | string,
  requiredPermission: string,
  customPermissions?: string[]
): boolean {
  if (customPermissions && customPermissions.includes(requiredPermission)) {
    return true;
  }
  const standardPerms = STANDARD_ROLE_PERMISSIONS[userRole as InventoryRole];
  if (standardPerms && standardPerms.includes(requiredPermission)) {
    return true;
  }
  const defaultPerms = INVENTORY_ROLE_PERMISSIONS[userRole as InventoryRole];
  if (!defaultPerms) return false;
  return (defaultPerms as unknown as string[]).includes(requiredPermission);
}


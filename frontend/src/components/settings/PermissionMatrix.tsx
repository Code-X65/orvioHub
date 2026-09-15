import React from 'react';
import { Check, X, Shield, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: 'Organization' | 'Inventory' | 'Branch' | 'Financial';
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Organization
  { key: 'workspace.view', label: 'View Workspace', description: 'Can view general workspace info & dashboard', category: 'Organization' },
  { key: 'workspace.update', label: 'Manage Workspace', description: 'Can update organization general & business settings', category: 'Organization' },
  { key: 'workspace.manage_branding', label: 'Manage Branding', description: 'Can upload & change organization logo & theme', category: 'Organization' },
  { key: 'workspace.manage_members', label: 'Manage Team', description: 'Can invite members & manage workspace memberships', category: 'Organization' },
  { key: 'workspace.manage_billing', label: 'Manage Billing', description: 'Can view invoices, payment methods, & subscription tiers', category: 'Financial' },
  { key: 'workspace.view_audit', label: 'View Audit Logs', description: 'Can inspect security and change audit trails', category: 'Organization' },
  // Inventory
  { key: 'inventory.view', label: 'View Inventory', description: 'Can view stock counts, catalog, and product pricing', category: 'Inventory' },
  { key: 'inventory.create_product', label: 'Create Products', description: 'Can add new catalog items and barcodes', category: 'Inventory' },
  { key: 'inventory.adjust_stock', label: 'Stock Adjustments', description: 'Can record restocks, counts, and loss write-offs', category: 'Inventory' },
  { key: 'inventory.record_sales', label: 'Record POS Sales', description: 'Can issue sales transactions & print receipts', category: 'Inventory' },
  { key: 'inventory.cancel_sales', label: 'Cancel/Void Sales', description: 'Can reverse or cancel posted sales tickets', category: 'Inventory' },
  { key: 'inventory.view_cost', label: 'View Cost & Profit', description: 'Can see cost price margins and gross profit metrics', category: 'Financial' },
  // Branch
  { key: 'branch.view', label: 'View Branch Details', description: 'Can view branch operational status', category: 'Branch' },
  { key: 'branch.manage_hours', label: 'Manage Opening Hours', description: 'Can configure daily branch opening schedule', category: 'Branch' },
  { key: 'branch.manage_members', label: 'Assign Branch Staff', description: 'Can assign staff members to this location', category: 'Branch' },
  { key: 'branch.manage_operations', label: 'Branch Operations', description: 'Can configure branch negative stock & low-stock rules', category: 'Branch' },
];

interface PermissionMatrixProps {
  selectedRole: string;
  assignedPermissions: string[];
  onChangePermissions?: (perms: string[]) => void;
  readOnly?: boolean;
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  selectedRole,
  assignedPermissions,
  onChangePermissions,
  readOnly = false,
}) => {
  const togglePermission = (key: string) => {
    if (readOnly || !onChangePermissions) return;
    if (assignedPermissions.includes(key)) {
      onChangePermissions(assignedPermissions.filter((p) => p !== key));
    } else {
      onChangePermissions([...assignedPermissions, key]);
    }
  };

  const categories = ['Organization', 'Inventory', 'Branch', 'Financial'] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h4 className="text-xs font-bold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#e6a8d6]" />
            Permissions for Role: <span className="text-[#f5c6e8] uppercase">{selectedRole}</span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Fine-grained access rights applied to members with this role.
          </p>
        </div>
        {readOnly && (
          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/10">
            <Lock className="w-3 h-3" />
            System Preset (Read Only)
          </span>
        )}
      </div>

      <div className="space-y-5">
        {categories.map((cat) => {
          const catPerms = SYSTEM_PERMISSIONS.filter((p) => p.category === cat);
          if (catPerms.length === 0) return null;

          return (
            <div key={cat} className="space-y-2">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {cat} Permissions
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {catPerms.map((perm) => {
                  const isGranted = assignedPermissions.includes(perm.key);

                  return (
                    <div
                      key={perm.key}
                      onClick={() => togglePermission(perm.key)}
                      className={cn(
                        'flex items-start justify-between p-3 rounded-xl border transition-all',
                        isGranted
                          ? 'bg-[#714b67]/10 border-[#714b67]/30 text-white'
                          : 'bg-black/30 border-white/5 text-slate-400',
                        !readOnly && 'cursor-pointer hover:border-[#714b67]/50'
                      )}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="text-xs font-semibold">{perm.label}</div>
                        <div className="text-[10px] text-slate-400">{perm.description}</div>
                        <div className="text-[9px] font-mono text-slate-500">{perm.key}</div>
                      </div>

                      <div
                        className={cn(
                          'w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                          isGranted
                            ? 'bg-[#714b67] text-white shadow-md shadow-[#714b67]/40'
                            : 'bg-white/5 text-slate-600 border border-white/10'
                        )}
                      >
                        {isGranted ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

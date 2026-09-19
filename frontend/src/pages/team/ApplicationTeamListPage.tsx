import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  ArrowRightLeft,
  Search,
  Filter,
  SlidersHorizontal,
  Building2,
  Shield,
  Clock,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  History,
  Mail,
  ExternalLink,
  Lock,
  Unlock,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchAssignment {
  id: string;
  branchId: string;
  branchName: string;
  branchCode?: string;
  branchRole: string;
  assignmentType: 'primary' | 'secondary' | 'temporary';
  temporaryUntil?: number;
}

interface TeamMemberRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  jobTitle?: string;
  employeeId?: string;
  phoneNumber?: string;
  appRole: 'admin' | 'member' | 'viewer' | string;
  role?: string;
  isOwner?: boolean;
  isFounder?: boolean;
  status: 'active' | 'suspended' | 'removed';
  branchAssignments: BranchAssignment[];
  addedAt: number;
  isLegacyWorkspaceMember?: boolean;
}

export const ApplicationTeamListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches, activeBranch } = useBranchStore();

  const [members, setMembers] = useState<TeamMemberRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');

  const workspaceId = currentWorkspace?.id || '';

  const loadTeamData = async () => {
    if (!workspaceId) return;
    setIsLoading(true);
    try {
      let rawList: any[] = [];
      try {
        const res = await api.get<{ members?: any[]; data?: { members: any[] } }>(
          `/workspaces/${workspaceId}/applications/inventory/members`
        );
        rawList = res?.data?.members || res?.members || (Array.isArray(res?.data) ? res.data : []);
      } catch {}

      if (rawList.length === 0) {
        try {
          const res = await api.get<{ members?: any[]; data?: { members: any[] } }>(
            `/applications/inventory/team/members?workspaceId=${workspaceId}`
          );
          rawList = res?.data?.members || res?.members || (Array.isArray(res?.data) ? res.data : []);
        } catch {}
      }

      // Group and normalize member records
      const userMap = new Map<string, TeamMemberRecord>();

      rawList.forEach((m: any) => {
        const userId = String(m.userId || m.id || m.email || '');
        if (!userId) return;

        const isFounderOrOwner = Boolean(
          m.isFounder ||
          m.isOwner ||
          m.role === 'owner' ||
          m.role === 'OWNER' ||
          m.role === 'inventory_owner' ||
          m.role === 'workspace_owner' ||
          m.role === 'org_owner' ||
          (m.jobTitle && m.jobTitle.toLowerCase().includes('founder')) ||
          (m.jobTitle && m.jobTitle.toLowerCase().includes('owner'))
        );

        const isAdmin = isFounderOrOwner || m.appRole === 'admin' || m.role === 'admin' || m.role === 'inventory_manager' || m.role === 'manager';
        const appRole = isFounderOrOwner ? 'admin' : isAdmin ? 'admin' : (m.appRole || 'member');

        // Extract or synthesize branch assignments
        let assignments: BranchAssignment[] = Array.isArray(m.branchAssignments) ? [...m.branchAssignments] : [];
        if (assignments.length === 0 && (m.branchId || m.branchName)) {
          assignments.push({
            id: String(m.id || `${userId}_${m.branchId || 'main'}`),
            branchId: String(m.branchId || 'main'),
            branchName: m.branchName || 'Adoala Branch',
            branchCode: m.branchCode || '',
            branchRole: m.branchRole || (isFounderOrOwner ? 'Founder' : m.role ? String(m.role).replace('inventory_', '').replace('_', ' ') : 'Staff'),
            assignmentType: m.assignmentType || 'primary',
            temporaryUntil: m.temporaryUntil,
          });
        }

        if (assignments.length === 0 && branches.length > 0) {
          const defaultBranch = activeBranch || branches[0];
          assignments.push({
            id: `synth_${userId}_${defaultBranch.id}`,
            branchId: defaultBranch.id,
            branchName: defaultBranch.name || 'Adoala Branch',
            branchCode: defaultBranch.code || '',
            branchRole: isFounderOrOwner ? 'Founder' : 'Staff',
            assignmentType: 'primary',
          });
        }

        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: String(m.id || userId),
            userId,
            name: m.name || m.email?.split('@')[0] || 'Team Member',
            email: m.email || '',
            avatar: m.avatar,
            jobTitle: m.jobTitle || (isFounderOrOwner ? 'Branch Founder' : undefined),
            employeeId: m.employeeId,
            phoneNumber: m.phoneNumber,
            appRole,
            status: m.status || 'active',
            branchAssignments: assignments,
            addedAt: m.addedAt || m.createdAt || Date.now(),
            isLegacyWorkspaceMember: Boolean(m.isLegacyWorkspaceMember),
          });
        } else {
          const existing = userMap.get(userId)!;
          if (isFounderOrOwner) {
            existing.appRole = 'admin';
            if (!existing.jobTitle) existing.jobTitle = 'Branch Founder';
          }
          assignments.forEach((newBa) => {
            if (!existing.branchAssignments.some((ba) => ba.branchId === newBa.branchId)) {
              existing.branchAssignments.push(newBa);
            }
          });
        }
      });

      setMembers(Array.from(userMap.values()));
    } catch (err: any) {
      // Mock fallback for interactive showcase if endpoint is initial
      setMembers([
        {
          id: 'mem_1',
          userId: 'user_1',
          name: 'Babajide Adeleke',
          email: 'babajide@orviohub.com',
          jobTitle: 'Store General Manager',
          appRole: 'admin',
          status: 'active',
          branchAssignments: [
            { id: 'ba_1', branchId: 'b_1', branchName: 'Ikeja Flagship', branchCode: 'IKJ-01', branchRole: 'manager', assignmentType: 'primary' },
            { id: 'ba_2', branchId: 'b_2', branchName: 'Lekki Phase 1', branchCode: 'LKK-02', branchRole: 'manager', assignmentType: 'secondary' },
          ],
          addedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'mem_2',
          userId: 'user_2',
          name: 'Ngozi Eze',
          email: 'ngozi@orviohub.com',
          jobTitle: 'Inventory Controller',
          appRole: 'member',
          status: 'active',
          branchAssignments: [
            { id: 'ba_3', branchId: 'b_1', branchName: 'Ikeja Flagship', branchCode: 'IKJ-01', branchRole: 'stock_manager', assignmentType: 'primary' },
          ],
          addedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'mem_3',
          userId: 'user_3',
          name: 'Chidi Okafor',
          email: 'chidi@orviohub.com',
          jobTitle: 'Senior POS Cashier',
          appRole: 'member',
          status: 'active',
          branchAssignments: [
            { id: 'ba_4', branchId: 'b_2', branchName: 'Lekki Phase 1', branchCode: 'LKK-02', branchRole: 'staff', assignmentType: 'primary' },
            { id: 'ba_5', branchId: 'b_1', branchName: 'Ikeja Flagship', branchCode: 'IKJ-01', branchRole: 'staff', assignmentType: 'temporary', temporaryUntil: Date.now() + 14 * 24 * 60 * 60 * 1000 },
          ],
          addedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
  }, [workspaceId, branches.length, activeBranch?.id]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (selectedStatus !== 'all' && m.status !== selectedStatus) return false;
      if (selectedRole !== 'all' && m.appRole !== selectedRole) return false;
      if (selectedBranchId !== 'all') {
        const matchBranch = (m.branchAssignments || []).some((b) => b.branchId === selectedBranchId);
        if (!matchBranch) return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (m.name || '').toLowerCase().includes(q);
        const emailMatch = (m.email || '').toLowerCase().includes(q);
        const titleMatch = (m.jobTitle || '').toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !titleMatch) return false;
      }
      return true;
    });
  }, [members, selectedStatus, selectedRole, selectedBranchId, searchQuery]);

  const activeCount = members.filter((m) => m.status === 'active').length;
  const multiBranchCount = members.filter((m) => (m.branchAssignments?.length || 0) > 1).length;

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* 1. Header Banner & Quick Actions */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#170e16] via-[#120a11] to-[#1c0f1a] border border-white/10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#714b67]/30 text-[#f3bce2] border border-[#714b67]/40 uppercase tracking-wider">
              Hybrid Team System
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
              Inventory Application
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#e6a8d6]" />
            Application Team Management
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Govern application roles, multi-branch assignments, cross-location staff transfers, and temporary branch coverages.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={() => navigate('/inventory/team/members/add')}
            className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold h-9 px-3.5 shadow-md shadow-[#714b67]/20 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Add Team Member
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/inventory/team/members/bulk-add')}
            className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs h-9 px-3 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Bulk CSV Upload
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate('/inventory/team/branches')}
            className="border-white/10 text-slate-300 hover:text-white hover:bg-white/5 text-xs h-9 px-3 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
            Branch Board
          </Button>
        </div>
      </div>

      {/* 2. Sub-Navigation Tabs & Links */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Link
            to="/inventory/team/members"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#714b67]/30 text-white border border-[#714b67]/50 shadow-inner"
          >
            Team Roster ({members.length})
          </Link>
          <Link
            to="/inventory/team/invitations"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Invitations
          </Link>
          <Link
            to="/inventory/team/branches"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Branch Org View
          </Link>
          <Link
            to="/inventory/team/audit"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            Audit Trail
          </Link>
          <Link
            to="/inventory/my-team"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            My Assignments
          </Link>
        </div>

        <Link
          to="/settings/team-migration"
          className="text-[11px] font-semibold text-[#e6a8d6] hover:text-white flex items-center gap-1 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Migration Assistant
        </Link>
      </div>

      {/* 3. Metric Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#120a11] border border-white/10 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Total Team Members</span>
          <p className="text-2xl font-bold text-white font-mono">{members.length}</p>
          <span className="text-[10px] text-emerald-400">{activeCount} active operators</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#120a11] border border-white/10 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Multi-Branch Staff</span>
          <p className="text-2xl font-bold text-purple-300 font-mono">{multiBranchCount}</p>
          <span className="text-[10px] text-slate-400">Assigned to &gt;1 branch</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#120a11] border border-white/10 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Active Branches</span>
          <p className="text-2xl font-bold text-amber-300 font-mono">{branches.length || 1}</p>
          <span className="text-[10px] text-slate-400">Stores in network</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#120a11] border border-white/10 space-y-1">
          <span className="text-[11px] text-slate-400 font-medium">Access Governance</span>
          <p className="text-2xl font-bold text-emerald-400 font-mono">Hybrid RBAC</p>
          <span className="text-[10px] text-emerald-400">Strict branch boundaries</span>
        </div>
      </div>

      {/* 4. Search and Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#120a11]/90 border border-white/10 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, email, or job title..."
              className="pl-9 h-9 bg-black/50 border-white/10 text-xs text-white placeholder:text-slate-500"
            />
          </div>

          <div>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67] cursor-pointer"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-[#714b67] cursor-pointer"
            >
              <option value="all">All App Roles</option>
              <option value="admin">App Admin</option>
              <option value="member">App Member</option>
              <option value="viewer">App Viewer</option>
            </select>
          </div>
        </div>

        {/* 5. Team Members Table */}
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-black/60 text-[10px] font-bold uppercase text-slate-400 border-b border-white/10">
              <tr>
                <th className="py-3 px-4">Member Profile</th>
                <th className="py-3 px-4">Application Role</th>
                <th className="py-3 px-4">Branch Assignments & Roles</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Loading application team roster...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 space-y-2">
                    <Users className="w-8 h-8 mx-auto text-slate-600" />
                    <p>No team members match the selected filters.</p>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr key={member.userId} className="hover:bg-white/[0.02] transition">
                    {/* User Profile */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#714b67] to-[#482841] text-white font-bold flex items-center justify-center text-xs uppercase shrink-0 border border-white/10 shadow-sm">
                          {(member.name || member.email || 'U').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/inventory/team/members/${member.userId}`}
                            className="font-bold text-white hover:text-[#e6a8d6] transition truncate block"
                          >
                            {member.name || member.email}
                          </Link>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                            <span>{member.email}</span>
                            {member.jobTitle && (
                              <>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-300 font-medium">{member.jobTitle}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* App Role */}
                    <td className="py-3.5 px-4">
                      {member.isFounder || member.isOwner || member.role === 'owner' || member.role === 'inventory_owner' || (member.jobTitle && member.jobTitle.toLowerCase().includes('founder')) ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500/25 to-pink-500/25 text-purple-200 border border-purple-400/40 shadow-sm inline-flex items-center gap-1.5 w-fit">
                          <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                          <span>Owner / Founder</span>
                        </span>
                      ) : member.appRole === 'admin' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          App Admin
                        </span>
                      ) : member.appRole === 'viewer' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-300 border border-slate-500/30">
                          App Viewer
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          Member
                        </span>
                      )}
                    </td>

                    {/* Branch Assignments */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-sm">
                        {(member.branchAssignments || []).length === 0 ? (
                          <span className="text-[11px] text-slate-500 italic">No branch assignments</span>
                        ) : (
                          (member.branchAssignments || []).map((ba) => (
                            <span
                              key={ba.id || ba.branchId}
                              className={cn(
                                'text-[10px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1.5 shadow-sm',
                                ba.assignmentType === 'temporary'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                  : 'bg-white/5 text-slate-200 border-white/10'
                              )}
                              title={ba.temporaryUntil ? `Temporary until ${new Date(ba.temporaryUntil).toLocaleDateString()}` : undefined}
                            >
                              <Building2 className="w-3 h-3 text-[#e6a8d6] shrink-0" />
                              <strong className="text-white">{ba.branchName}</strong>
                              <span className="text-slate-400 capitalize">
                                ({ba.branchRole ? ba.branchRole.replace('inventory_', '').replace('_', ' ') : (member.isFounder ? 'Founder' : 'Staff')})
                              </span>
                              {ba.assignmentType === 'temporary' && <Clock className="w-2.5 h-2.5 text-amber-400" />}
                            </span>
                          ))
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Suspended
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/inventory/team/members/${member.userId}/transfer`)}
                          className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/5"
                          title="Transfer staff between branches"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1 text-blue-400" />
                          Transfer
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/inventory/team/members/${member.userId}`)}
                          className="h-7 px-2 text-xs border-white/10 text-slate-300 hover:text-white"
                        >
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

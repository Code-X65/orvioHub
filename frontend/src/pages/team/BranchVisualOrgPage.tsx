import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBranchStore } from '@/stores/useBranchStore';
import { api } from '@/lib/api';
import {
  Building2,
  Users,
  Search,
  Filter,
  ArrowRightLeft,
  UserPlus,
  Mail,
  Shield,
  Clock,
  MapPin,
  ChevronRight,
  RefreshCw,
  MoreVertical,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface MemberBranchAssignment {
  assignmentId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  isPrimaryBranch: boolean;
  branchRole: string;
  assignmentType: 'primary' | 'secondary' | 'temporary';
  temporaryUntil?: number;
}

interface TeamMember {
  userId: string;
  name: string;
  email: string;
  phoneNumber?: string;
  appRole: string;
  status: 'active' | 'invited' | 'suspended' | 'deactivated';
  jobTitle?: string;
  employeeId?: string;
  branchAssignments: MemberBranchAssignment[];
  primaryBranch?: {
    branchId: string;
    branchName: string;
    branchCode: string;
    branchRole: string;
  };
}

export const BranchVisualOrgPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspaceStore();
  const { branches, fetchBranches } = useBranchStore();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Quick Transfer Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedSourceBranchId, setSelectedSourceBranchId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [targetBranchRole, setTargetBranchRole] = useState('operator');
  const [assignmentType, setAssignmentType] = useState<'permanent' | 'temporary'>('permanent');
  const [tempDurationDays, setTempDurationDays] = useState(14);
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

  const loadData = async () => {
    if (!currentWorkspace?.id) return;
    setIsLoading(true);
    try {
      await fetchBranches(currentWorkspace.id);
      let rawMembers: any[] = [];
      try {
        const res = await api.get<{
          success?: boolean;
          data?: { members: TeamMember[] } | TeamMember[];
          members?: TeamMember[];
        }>(`/workspaces/${currentWorkspace.id}/applications/inventory/members`);
        rawMembers = res?.data && Array.isArray((res.data as any).members)
          ? (res.data as any).members
          : Array.isArray(res?.data)
          ? res.data
          : res?.members || [];
      } catch {}

      if (rawMembers.length === 0) {
        try {
          const res = await api.get<{
            success?: boolean;
            data?: { members: TeamMember[] } | TeamMember[];
            members?: TeamMember[];
          }>(`/applications/inventory/team/members?workspaceId=${currentWorkspace.id}`);
          rawMembers = res?.data && Array.isArray((res.data as any).members)
            ? (res.data as any).members
            : Array.isArray(res?.data)
            ? res.data
            : res?.members || [];
        } catch {}
      }

      const normalized = rawMembers.map((m: any) => {
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

        let assignments = Array.isArray(m.branchAssignments) ? [...m.branchAssignments] : [];
        if (assignments.length === 0 && (m.branchId || m.branchName)) {
          assignments.push({
            assignmentId: String(m.id || `${m.userId}_${m.branchId || 'main'}`),
            branchId: String(m.branchId || 'main'),
            branchName: m.branchName || 'Headquarter',
            branchCode: m.branchCode || 'HQ',
            isPrimaryBranch: true,
            branchRole: m.branchRole || (isFounderOrOwner ? 'Founder' : m.role ? String(m.role).replace('inventory_', '').replace('_', ' ') : 'Staff'),
            assignmentType: 'primary',
          });
        }

        return {
          ...m,
          userId: String(m.userId || m.id || m.email),
          name: m.name || m.email?.split('@')[0] || 'Team Member',
          email: m.email || '',
          appRole: isFounderOrOwner ? 'admin' : (m.appRole || 'member'),
          jobTitle: m.jobTitle || (isFounderOrOwner ? 'Branch Founder' : undefined),
          isFounder: isFounderOrOwner,
          isOwner: isFounderOrOwner,
          branchAssignments: assignments,
        };
      });

      setMembers(normalized);
    } catch (err) {
      console.error('Failed to load visual team board data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace?.id]);

  const handleOpenQuickTransfer = (member: TeamMember, branchId: string) => {
    setSelectedMember(member);
    setSelectedSourceBranchId(branchId);
    setTargetBranchId('');
    setTargetBranchRole((member.branchAssignments || []).find(b => b.branchId === branchId)?.branchRole || 'operator');
    setAssignmentType('permanent');
    setTransferError(null);
    setTransferSuccess(null);
    setTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !selectedMember || !targetBranchId) return;

    setIsSubmittingTransfer(true);
    setTransferError(null);

    try {
      const payload: any = {
        workspaceId: currentWorkspace.id,
        applicationKey: 'inventory',
        userId: selectedMember.userId,
        targetBranchId,
        targetBranchRole,
        assignmentType: assignmentType === 'permanent' ? 'primary' : 'temporary',
        sourceBranchId: selectedSourceBranchId,
        removeSourceAssignment: assignmentType === 'permanent',
        notes: transferNotes
      };

      if (assignmentType === 'temporary') {
        payload.temporaryUntil = Date.now() + tempDurationDays * 24 * 60 * 60 * 1000;
      }

      await api.post('/applications/inventory/team/transfer', payload);
      setTransferSuccess(`Successfully transferred ${selectedMember.name}!`);
      setTimeout(() => {
        setTransferModalOpen(false);
        loadData();
      }, 1000);
    } catch (err: any) {
      setTransferError(err?.message || 'Failed to complete staff transfer');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch =
      (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.jobTitle && m.jobTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.employeeId && m.employeeId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole =
      roleFilter === 'ALL' ||
      m.appRole === roleFilter ||
      (m.branchAssignments || []).some(b => b.branchRole === roleFilter);

    return matchesSearch && matchesRole;
  });

  // Deduplicate and normalize active branches
  const displayBranches = React.useMemo(() => {
    const seen = new Set<string>();
    const list = branches.filter(b => {
      const bId = String(b.id || b._id || b.name?.toLowerCase() || '');
      if (!bId || seen.has(bId)) return false;
      seen.add(bId);
      return b.status !== 'archived' && b.status !== 'suspended' && b.status !== 'deleted';
    });
    return list.length > 0 ? list : [{ id: 'main', _id: 'main', name: 'Headquarter', code: 'HQ', isPrimary: true, status: 'active', workspaceId: currentWorkspace?.id || '' }];
  }, [branches, currentWorkspace?.id]);

  // Group members by branch
  const branchStaffMap = React.useMemo(() => {
    const map: Record<string, { branch: any; members: { member: TeamMember; assignment: MemberBranchAssignment }[] }> = {};

    displayBranches.forEach(b => {
      const bId = String(b.id || b._id || 'main');
      map[bId] = { branch: b, members: [] };
    });

    const defaultBranchId = String(displayBranches[0]?.id || displayBranches[0]?._id || 'main');

    filteredMembers.forEach(m => {
      if (!m.branchAssignments || m.branchAssignments.length === 0) {
        if (map[defaultBranchId]) {
          map[defaultBranchId].members.push({
            member: m,
            assignment: {
              assignmentId: `synth_${m.userId}`,
              branchId: defaultBranchId,
              branchName: displayBranches[0]?.name || 'Headquarter',
              branchCode: displayBranches[0]?.code || 'HQ',
              isPrimaryBranch: true,
              branchRole: (m as any).isFounder ? 'Founder' : m.appRole === 'admin' ? 'Manager' : 'Staff',
              assignmentType: 'primary',
            },
          });
        }
      } else {
        m.branchAssignments.forEach(ba => {
          const targetBId = String(ba.branchId || '');
          const matchedBranch = displayBranches.find(b =>
            String(b.id) === targetBId ||
            String(b._id) === targetBId ||
            (b.name && ba.branchName && b.name.toLowerCase().trim() === ba.branchName.toLowerCase().trim())
          );

          const key = matchedBranch ? String(matchedBranch.id || matchedBranch._id) : defaultBranchId;
          if (map[key]) {
            if (!map[key].members.some(item => item.member.userId === m.userId)) {
              map[key].members.push({
                member: m,
                assignment: {
                  ...ba,
                  assignmentId: ba.assignmentId || ba.branchId || `as_${m.userId}_${key}`,
                  branchId: key,
                  branchName: ba.branchName || map[key].branch?.name || 'Headquarter',
                  branchCode: ba.branchCode || map[key].branch?.code || 'HQ',
                  isPrimaryBranch: Boolean(ba.isPrimaryBranch || ba.assignmentType === 'primary'),
                },
              });
            }
          }
        });
      }
    });

    // Ensure all founders / owners are listed in every branch column
    const founders = filteredMembers.filter(
      (m) =>
        (m as any).isFounder ||
        (m as any).isOwner ||
        (m.jobTitle && m.jobTitle.toLowerCase().includes('founder')) ||
        (m.jobTitle && m.jobTitle.toLowerCase().includes('owner'))
    );

    displayBranches.forEach((b) => {
      const bId = String(b.id || b._id || 'main');
      if (map[bId]) {
        founders.forEach((founder) => {
          if (!map[bId].members.some((item) => item.member.userId === founder.userId)) {
            map[bId].members.unshift({
              member: founder,
              assignment: {
                assignmentId: `founder_${founder.userId}_${bId}`,
                branchId: bId,
                branchName: b.name || 'Headquarter',
                branchCode: b.code || 'HQ',
                isPrimaryBranch: Boolean(b.isPrimary),
                branchRole: 'Founder',
                assignmentType: b.isPrimary ? 'primary' : 'secondary',
              },
            });
          }
        });
      }
    });

    return map;
  }, [displayBranches, filteredMembers]);

  const unassignedMembers: TeamMember[] = [];

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6 text-slate-100 selection:bg-[#714b67] selection:text-white">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#e296cb] mb-1">
            <Link to="/inventory/team/members" className="hover:underline flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Team Members
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-500" />
            <span className="text-slate-300">Visual Branch Board</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Branch Organization Board
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#714b67]/30 text-[#f3bce2] border border-[#714b67]/50">
              {displayBranches.length} {displayBranches.length === 1 ? 'Branch' : 'Branches'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visual overview of branch staffing, active role distribution, and cross-branch assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 flex items-center gap-2 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            to="/inventory/team/invitations"
            className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 flex items-center gap-2 transition"
          >
            <Mail className="w-3.5 h-3.5 text-[#e296cb]" />
            Invitations
          </Link>
          <Link
            to="/inventory/team/members/add"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8a4b77] to-[#714b67] hover:from-[#9c5587] hover:to-[#825676] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-[#714b67]/25 transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Add Member
          </Link>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#130b13] border border-white/10 p-3.5 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter staff by name, email, title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#e296cb]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Role:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white/5 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-[#e296cb]"
          >
            <option value="ALL">All Roles</option>
            <option value="app_admin">App Admin</option>
            <option value="branch_manager">Branch Manager</option>
            <option value="shift_supervisor">Supervisor</option>
            <option value="cashier">Cashier</option>
            <option value="inventory_clerk">Inventory Clerk</option>
            <option value="operator">Operator</option>
          </select>
        </div>
      </div>

      {/* Visual Multi-Column Board */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Spinner className="w-8 h-8 text-[#e296cb]" />
          <p className="text-xs text-slate-400 mt-3">Loading branch organizational hierarchy...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start overflow-x-auto pb-6">
          {displayBranches.map((branch) => {
            const branchId = String(branch.id || branch._id || 'main');
            const branchStaff = branchStaffMap[branchId]?.members || [];

            return (
              <div
                key={branchId}
                className="bg-[#120a12] border border-white/10 rounded-2xl flex flex-col min-w-[310px] shadow-xl overflow-hidden"
              >
                {/* Column Header */}
                <div className="p-4 border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#f3bce2] shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-white truncate">{branch.name}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">Code: {branch.code || 'MAIN'}</span>
                      </div>
                    </div>
                    {branch.isPrimary && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        Primary HQ
                      </span>
                    )}
                  </div>

                  {branch.address && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-2.5 truncate">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">{branch.address}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5 text-[11px]">
                    <span className="text-slate-400">Total Staff</span>
                    <span className="font-bold text-white px-2 py-0.5 rounded bg-white/10">
                      {branchStaff.length}
                    </span>
                  </div>
                </div>

                {/* Staff Cards List in this Branch */}
                <div className="p-3 space-y-2.5 flex-1 min-h-[220px] max-h-[600px] overflow-y-auto">
                  {branchStaff.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <Users className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs font-medium text-slate-400">No staff assigned</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Transfer staff here or add a new team member.
                      </p>
                    </div>
                  ) : (
                    branchStaff.map(({ member, assignment }) => {
                      const isFounder = (member as any).isFounder || (member as any).isOwner || assignment.branchRole?.toLowerCase().includes('founder');
                      const isManager = isFounder || assignment.branchRole === 'branch_manager' || assignment.branchRole === 'manager' || assignment.branchRole === 'admin';
                      const isTemp = assignment.assignmentType === 'temporary';

                      return (
                        <div
                          key={`${member.userId}-${assignment.assignmentId || assignment.branchId}`}
                          className={`p-3 rounded-xl border transition-all hover:border-[#714b67]/70 ${
                            isFounder
                              ? 'bg-gradient-to-br from-purple-500/20 via-[#714b67]/15 to-white/[0.02] border-purple-400/40 shadow-sm'
                              : isManager
                              ? 'bg-gradient-to-br from-[#714b67]/20 to-white/[0.02] border-[#714b67]/40'
                              : 'bg-white/[0.03] border-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8a4b77] to-[#512c47] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  to={`/inventory/team/members/${member.userId}`}
                                  className="text-xs font-bold text-white hover:text-[#e296cb] transition truncate block"
                                >
                                  {member.name}
                                </Link>
                                <span className="text-[10px] text-slate-400 truncate block">
                                  {member.jobTitle || member.email}
                                </span>
                              </div>
                            </div>

                            {/* Actions Dropdown / Quick Action */}
                            <button
                              onClick={() => handleOpenQuickTransfer(member, branchId)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition"
                              title="Transfer Branch"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Role & Badge info */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-white/5">
                            {isFounder ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-200 border border-purple-400/40 capitalize">
                                Owner / Founder
                              </span>
                            ) : (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded capitalize ${
                                  isManager
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {assignment.branchRole ? assignment.branchRole.replace('inventory_', '').replace('_', ' ') : 'Staff'}
                              </span>
                            )}

                            {assignment.isPrimaryBranch && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Home Base
                              </span>
                            )}

                            {isTemp && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> Temp
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Column Footer */}
                <div className="p-3 border-t border-white/10 bg-white/[0.02]">
                  <Link
                    to={`/inventory/team/members/add?branchId=${branchId}`}
                    className="w-full py-1.5 rounded-lg border border-dashed border-white/15 hover:border-[#e296cb]/50 hover:bg-[#714b67]/10 text-slate-400 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <UserPlus className="w-3 h-3 text-[#e296cb]" />
                    Add Staff to {branch.name}
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Unassigned / Roaming Members Column if any */}
          {unassignedMembers.length > 0 && (
            <div className="bg-[#120a12] border border-amber-500/30 rounded-2xl flex flex-col min-w-[310px] shadow-xl overflow-hidden">
              <div className="p-4 border-b border-amber-500/20 bg-amber-500/5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-white">Unassigned Staff</h3>
                    <span className="text-[10px] text-amber-300/80">No active branch assignment</span>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2.5 flex-1 min-h-[220px]">
                {unassignedMembers.map((member) => (
                  <div key={member.userId} className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/inventory/team/members/${member.userId}`}
                          className="text-xs font-bold text-white hover:text-[#e296cb] transition truncate block"
                        >
                          {member.name}
                        </Link>
                        <span className="text-[10px] text-slate-400 truncate block">{member.email}</span>
                      </div>
                      <Link
                        to={`/inventory/team/members/${member.userId}/transfer`}
                        className="px-2 py-1 rounded bg-[#714b67] hover:bg-[#86597a] text-[10px] font-bold text-white transition"
                      >
                        Assign
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Transfer Modal */}
      {transferModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#130a13] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#714b67]/20 border border-[#714b67]/40 flex items-center justify-center text-[#f3bce2]">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Quick Staff Transfer</h3>
                  <p className="text-xs text-slate-400">Reassign {selectedMember.name} to another branch</p>
                </div>
              </div>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{transferSuccess}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Destination Branch</label>
                <select
                  required
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#e296cb]"
                >
                  <option value="">Select target branch...</option>
                  {branches
                    .filter((b) => b.id !== selectedSourceBranchId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code || 'MAIN'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Role at Destination Branch</label>
                <select
                  value={targetBranchRole}
                  onChange={(e) => setTargetBranchRole(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#e296cb]"
                >
                  <option value="branch_manager">Branch Manager</option>
                  <option value="shift_supervisor">Shift Supervisor</option>
                  <option value="cashier">Cashier</option>
                  <option value="inventory_clerk">Inventory Clerk</option>
                  <option value="operator">Operator</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAssignmentType('permanent')}
                  className={`p-3 rounded-xl border text-left transition ${
                    assignmentType === 'permanent'
                      ? 'bg-[#714b67]/30 border-[#e296cb] text-white'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-bold block">Permanent Transfer</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Updates primary branch assignment
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAssignmentType('temporary')}
                  className={`p-3 rounded-xl border text-left transition ${
                    assignmentType === 'temporary'
                      ? 'bg-[#714b67]/30 border-[#e296cb] text-white'
                      : 'bg-white/5 border-white/10 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-bold block">Temporary Relocation</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Retains primary, auto-expires
                  </span>
                </button>
              </div>

              {assignmentType === 'temporary' && (
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Temporary Assignment Duration
                  </label>
                  <select
                    value={tempDurationDays}
                    onChange={(e) => setTempDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#e296cb]"
                  >
                    <option value={7}>7 Days (1 Week)</option>
                    <option value={14}>14 Days (2 Weeks)</option>
                    <option value={30}>30 Days (1 Month)</option>
                    <option value={60}>60 Days (2 Months)</option>
                    <option value={90}>90 Days (Quarter)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Transfer Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g., Covering holiday shift, Store opening support..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#e296cb]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-medium text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTransfer || !targetBranchId}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#8a4b77] to-[#714b67] hover:from-[#9c5587] hover:to-[#825676] text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-[#714b67]/25 transition disabled:opacity-50"
                >
                  {isSubmittingTransfer ? <Spinner className="w-3.5 h-3.5" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

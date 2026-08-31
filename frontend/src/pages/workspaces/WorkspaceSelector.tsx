import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { Header } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Search,
  ArrowRight,
} from 'lucide-react';

export const WorkspaceSelector: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productFilterParam = searchParams.get('product') || 'all';

  const {
    currentWorkspace,
    workspaces,
    fetchWorkspaces,
    selectWorkspace,
    isLoading,
  } = useWorkspaceStore();

  const [activeTab] = useState<string>(productFilterParam);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchWorkspaces(activeTab === 'all' ? undefined : activeTab).catch(() => {});
  }, [activeTab, fetchWorkspaces]);

  const filteredWorkspaces = workspaces.filter((w) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.workspace.name.toLowerCase().includes(q) ||
      w.workspace.slug.toLowerCase().includes(q) ||
      w.role.toLowerCase().includes(q) ||
      (w.workspace.type && w.workspace.type.toLowerCase().includes(q))
    );
  });

  const handleSelectWorkspace = async (workspaceId: string, initialProduct?: string) => {
    try {
      await selectWorkspace(workspaceId, initialProduct);
      toast.success('Organization selected');

      if (initialProduct === 'inventory') {
        navigate('/inventory/dashboard', { replace: true });
      } else {
        navigate('/app', { replace: true });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to select organization');
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 selection:bg-[#714b67] selection:text-white flex flex-col justify-between">
      <Header />

      {/* Main Content Area */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        {/* Header Title & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Your Organizations</h1>
            <p className="text-slate-400 text-xs mt-1">
              Select an organization to open your business catalog and apps.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => navigate('/workspaces/new')}
            className="bg-[#714b67] hover:bg-[#86597a] active:bg-[#603f57] text-white text-xs font-semibold rounded-xs px-4 py-2 flex items-center gap-1.5 shadow-md shadow-[#714b67]/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Organization</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search organizations by name or slug..."
            className="pl-9 h-10 bg-[#0e0a0d] border-white/10 text-white rounded-xs text-xs focus-visible:ring-1 focus-visible:ring-[#714b67]"
          />
        </div>

        {/* Organizations List Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" className="text-[#714b67]" />
          </div>
        ) : filteredWorkspaces.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No organizations found matching your search.</p>
            <Button
              onClick={() => navigate('/workspaces/new')}
              className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs rounded-xs font-semibold px-4 py-2"
            >
              Create New Organization
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredWorkspaces.map((item) => {
              const isCurrent = currentWorkspace?.id === item.workspace.id;

              return (
                <div
                  key={item.workspace.id}
                  onClick={() => handleSelectWorkspace(item.workspace.id, 'inventory')}
                  className={`p-4 rounded-xs border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isCurrent
                      ? 'bg-[#714b67]/15 border-[#714b67] ring-1 ring-[#714b67]'
                      : 'bg-[#0e0a0d] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xs bg-[#714b67] text-white flex items-center justify-center font-bold text-xs">
                        {item.workspace.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white">{item.workspace.name}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">{item.workspace.slug}</span>
                      </div>
                    </div>

                    <span className="text-[9px] uppercase font-bold text-[#c79dbd] bg-[#714b67]/20 px-1.5 py-0.2 rounded-xs border border-[#714b67]/30">
                      {item.role}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                    <span className="text-slate-400">
                      {item.workspace.currency || 'NGN'} • {item.workspace.type || 'Business'}
                    </span>

                    <span className="text-[#c79dbd] font-semibold flex items-center gap-1">
                      Open Organization <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <footer className="w-full border-t border-white/5 bg-black py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Orivo Inc. • Single Unified Business Platform
      </footer>
    </div>
  );
};

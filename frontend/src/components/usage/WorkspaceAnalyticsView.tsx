import React, { useState, useEffect } from 'react';

export interface WorkspaceAnalyticsProps {
  workspaceId: string;
}

export const WorkspaceAnalyticsView: React.FC<WorkspaceAnalyticsProps> = ({ workspaceId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`/api/v1/workspaces/${workspaceId}/analytics/usage`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to load workspace analytics.');
        }

        const json = await res.json();
        setData(json.data);
      } catch (err: any) {
        setError(err.message || 'Error loading usage analytics');
      } finally {
        setLoading(false);
      }
    };

    if (workspaceId) {
      fetchUsage();
    }
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="p-6 text-center text-sm text-gray-500">
        Loading organization analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Plan & Trial Overview */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Plan</span>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
            {data?.plan?.key || 'Free Trial'}
          </h3>
        </div>
        {data?.plan?.isTrial && (
          <div className="px-3 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 rounded-full text-xs font-semibold">
            {data?.plan?.trialDaysRemaining || 0} days remaining in trial
          </div>
        )}
      </div>

      {/* Usage Limits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-500 font-semibold">Branches Configured</span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data?.usage?.branches?.current || 0} / {data?.usage?.branches?.limit || 1}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800">
          <span className="text-xs text-gray-500 font-semibold">Team Members</span>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {data?.usage?.members?.current || 0} / {data?.usage?.members?.limit || 2}
          </div>
          <span className="text-xs text-gray-400 mt-1 block">
            Pending invites: {data?.usage?.members?.pendingInvitations || 0}
          </span>
        </div>
      </div>

      {/* Demo Notice */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-xs text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800">
        <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Demo Dashboard Active</p>
        Detailed inventory product and sales telemetry will be enabled when production inventory records are published.
      </div>
    </div>
  );
};

import React, { useState } from 'react';

/**
 * 1. AdminActionModal: Reusable confirmation modal supporting normal, sensitive, and high-risk actions
 */
export interface AdminActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; stepUpToken?: string; totpCode?: string }) => Promise<void>;
  title: string;
  description: string;
  targetName: string;
  sensitivity?: 'normal' | 'sensitive' | 'high_risk';
  confirmLabel?: string;
  isDangerous?: boolean;
}

export const AdminActionModal: React.FC<AdminActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  targetName,
  sensitivity = 'normal',
  confirmLabel = 'Confirm Action',
  isDangerous = false,
}) => {
  const [reason, setReason] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((sensitivity === 'sensitive' || sensitivity === 'high_risk') && !reason.trim()) {
      setError('A mandatory reason is required for this action.');
      return;
    }
    if (sensitivity === 'high_risk' && !totpCode.trim()) {
      setError('Second-factor TOTP verification is required for high-risk actions.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onConfirm({ reason, totpCode });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Action failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h3>
          {sensitivity === 'high_risk' && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
              High Risk
            </span>
          )}
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{description}</p>
        <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg text-xs font-mono text-gray-800 dark:text-gray-200 mb-4">
          Target: {targetName}
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {(sensitivity === 'sensitive' || sensitivity === 'high_risk') && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Reason (Required)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Explain the operational rationale for this administrative action..."
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                required
              />
            </div>
          )}

          {sensitivity === 'high_risk' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Authenticator / TOTP Code (6 Digits)
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="w-full text-sm font-mono tracking-widest text-center rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-sm font-semibold rounded-lg text-white ${
                isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {loading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * 2. SupportNotesList Component
 */
export const SupportNotesList: React.FC<{
  notes: Array<{ id: string; authorName: string; category: string; note: string; createdAt: number }>;
  onAddNote?: (note: string, category: string) => Promise<void>;
}> = ({ notes, onAddNote }) => {
  const [newNote, setNewNote] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !onAddNote) return;
    try {
      setSaving(true);
      await onAddNote(newNote, category);
      setNewNote('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {onAddNote && (
        <form onSubmit={handleAdd} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5"
            >
              <option value="general">General</option>
              <option value="support">Support</option>
              <option value="billing">Billing</option>
              <option value="security">Security</option>
              <option value="onboarding">Onboarding</option>
            </select>
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add internal support note (audited)..."
              className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5"
            />
            <button
              type="submit"
              disabled={saving || !newNote.trim()}
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg"
            >
              {saving ? 'Adding...' : 'Post Note'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-6">No support notes recorded yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-xs">
              <div className="flex items-center justify-between text-gray-500 mb-1">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{n.authorName}</span>
                <span>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-gray-700 dark:text-gray-300">{n.note}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export * from './overrides';

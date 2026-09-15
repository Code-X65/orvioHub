import React, { useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Lock,
  Clock,
  Loader2,
} from "lucide-react";
import { adminUsersApi } from "../../api/adminUsers";
import ConfirmDialog from "../../components/ConfirmDialog";

interface UserSupportNotesTabProps {
  sessionToken: string;
  userId: string;
  notes: any[];
  loading?: boolean;
  onRefresh: () => Promise<void>;
}

export const UserSupportNotesTab: React.FC<UserSupportNotesTabProps> = ({
  sessionToken,
  userId,
  notes,
  loading,
  onRefresh,
}) => {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteCategory, setNoteCategory] = useState<
    "support" | "billing" | "security" | "onboarding" | "general"
  >("support");
  const [noteText, setNoteText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<any>(null);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    setActionLoading(true);
    try {
      await adminUsersApi.addSupportNote(
        sessionToken,
        userId,
        noteCategory,
        noteText.trim()
      );
      setNoteText("");
      setIsAddingNote(false);
      await onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToDelete) return;
    setActionLoading(true);
    try {
      await adminUsersApi.deleteSupportNote(sessionToken, noteToDelete.id);
      setNoteToDelete(null);
      await onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading internal support notes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs text-indigo-300">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-400" />
          <span>
            <strong>Internal Admin Only:</strong> Notes written here are strictly hidden from user accounts and data exports.
          </span>
        </div>

        <button
          onClick={() => setIsAddingNote(true)}
          className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Support Note</span>
        </button>
      </div>

      {/* Add Note Modal Form */}
      {isAddingNote && (
        <form
          onSubmit={handleAddNote}
          className="p-5 rounded-2xl bg-slate-900 border border-brand-500/40 space-y-4 shadow-2xl animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-bold text-white text-sm">Create Internal Administrative Note</h4>
            <button
              type="button"
              onClick={() => setIsAddingNote(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Cancel
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Note Category
              </label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="support">Support & Troubleshooting</option>
                <option value="billing">Billing & Payment Issue</option>
                <option value="security">Security & Abuse Review</option>
                <option value="onboarding">Onboarding Assistance</option>
                <option value="general">General Administrative Note</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Internal Note Content
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Document context, account decisions, customer communication, or internal findings..."
                rows={4}
                required
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-brand-500 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingNote(false)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading || !noteText.trim()}
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Admin Note</span>
            </button>
          </div>
        </form>
      )}

      {/* Support Notes Thread */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Support Notes Thread ({notes.length})</h3>
          </div>
          <span className="text-[10px] text-slate-500">Audited Internal Log</span>
        </div>

        {notes.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">
            No support notes recorded for this user yet. Click 'Add Support Note' above to create one.
          </p>
        ) : (
          <div className="space-y-3">
            {notes.map((n: any) => (
              <div
                key={n.id}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 text-[10px] font-bold uppercase">
                        {n.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        By {n.adminName}
                      </span>
                    </div>

                    <p className="text-slate-200 text-xs leading-relaxed pt-1 whitespace-pre-wrap">
                      {n.note}
                    </p>
                  </div>

                  <button
                    onClick={() => setNoteToDelete(n)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-2 border-t border-slate-800/60">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!noteToDelete}
        title="Delete Support Note"
        message="Permanently remove this internal support note? This action is audited."
        confirmLabel="Delete Note"
        isDestructive={true}
        isLoading={actionLoading}
        onConfirm={handleDeleteNote}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};

export default UserSupportNotesTab;

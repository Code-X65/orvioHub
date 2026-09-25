import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Fingerprint, Plus, Trash2, Loader2, ShieldCheck, Laptop } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { isWebAuthnAvailable, startPasskeyRegistration } from '@/lib/webauthn';

interface PasskeyItem {
  id: string;
  deviceName?: string;
  createdAt: number;
}

export const PasskeyManagementCard: React.FC = () => {
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const fetchPasskeys = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ data: PasskeyItem[] }>('/auth/passkey/credentials');
      if (res && res.data) {
        setPasskeys(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isWebAuthnAvailable().then(setIsSupported);
    fetchPasskeys();
  }, []);

  const handleRegisterPasskey = async () => {
    if (!isSupported) {
      toast.error('WebAuthn / Passkeys are not supported on this browser or platform.');
      return;
    }

    setIsRegistering(true);
    try {
      await startPasskeyRegistration();
      toast.success('Passkey enrolled successfully! You can now use biometric sign-in.');
      await fetchPasskeys();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        toast.error('Passkey registration was cancelled.');
      } else {
        toast.error(err.message || 'Failed to enroll passkey.');
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!window.confirm('Are you sure you want to remove this passkey?')) return;
    setDeletingId(credentialId);
    try {
      await api.delete(`/auth/passkey/credentials/${encodeURIComponent(credentialId)}`);
      toast.success('Passkey removed.');
      setPasskeys((prev) => prev.filter((p) => p.id !== credentialId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete passkey.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-sm p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-indigo-400" />
            <span>Passkeys & Biometrics</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sign in securely using Touch ID, Face ID, Windows Hello, or hardware security keys without entering a password.
          </p>
        </div>

        <Button
          onClick={handleRegisterPasskey}
          disabled={isRegistering || !isSupported}
          size="sm"
          className="bg-[#714b67] hover:bg-[#86597a] text-white text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50"
        >
          {isRegistering ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Passkey
            </>
          )}
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="py-6 text-center text-xs text-slate-500">Loading passkeys...</div>
        ) : passkeys.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center space-y-1">
            <p className="text-xs font-medium text-slate-300">No passkeys enrolled yet</p>
            <p className="text-[11px] text-slate-500">
              Add a passkey for instant, passwordless sign-in across your devices.
            </p>
          </div>
        ) : (
          passkeys.map((passkey) => (
            <div
              key={passkey.id}
              className="flex items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-sm bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">
                    {passkey.deviceName || 'Biometric Security Key'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Enrolled {formatDate(passkey.createdAt)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={deletingId === passkey.id}
                onClick={() => handleDeletePasskey(passkey.id)}
                className="text-xs text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Remove passkey"
              >
                {deletingId === passkey.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

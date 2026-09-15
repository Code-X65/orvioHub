import React from "react";
import {
  User,
  Mail,
  MapPin,
  Globe,
  Shield,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface UserProfileTabProps {
  profile: any;
  loading?: boolean;
}

export const UserProfileTab: React.FC<UserProfileTabProps> = ({ profile, loading }) => {
  if (loading || !profile) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading profile information...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Privacy Notice Alert */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
        <Shield className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-200">NDPA & Platform Privacy Boundary: </span>
          Superadmins can inspect verified identity details for administrative purposes. Personal profile fields cannot be modified casually.
        </div>
      </div>

      {/* User Avatar & Identity Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center font-bold text-3xl text-white shadow-lg shadow-brand-600/30 shrink-0 overflow-hidden border border-slate-700">
          {profile.avatar || profile.avatarUrl ? (
            <img
              src={profile.avatar || profile.avatarUrl}
              alt={profile.name || "User avatar"}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            profile.name?.charAt(0)?.toUpperCase() || "U"
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">{profile.name}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brand-500/10 text-brand-300 border border-brand-500/20">
              {profile.avatar || profile.avatarUrl ? "Custom Avatar" : "Default Letter Avatar"}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">{profile.email}</p>
          <p className="text-[11px] text-slate-500">
            {profile.avatar || profile.avatarUrl ? "Uploaded and synced via user profile settings." : "No custom photo uploaded yet."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Identity Details */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <User className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Identity & Account Info</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Full Name</span>
              <span className="font-semibold text-slate-200">{profile.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Display / Preferred</span>
              <span className="font-semibold text-slate-200">
                {profile.displayName || profile.preferredName || "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">User ID</span>
              <span className="font-mono text-slate-400 text-[11px]">{profile.id}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Platform Role</span>
              <span className="font-semibold text-indigo-300 capitalize">{profile.role || "User"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Job Title</span>
              <span className="font-semibold text-slate-200">{profile.jobTitle || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Department</span>
              <span className="font-semibold text-slate-200">{profile.department || "—"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Biography</span>
              <p className="text-slate-300 text-[11px] mt-0.5 italic">
                {profile.bio || "No biography provided."}
              </p>
            </div>
          </div>
        </div>

        {/* Contact & Verification Details */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Mail className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Contact & Verification State</h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-medium block">Primary Email</span>
                <span className="font-mono text-slate-200 text-[11px]">{profile.email}</span>
              </div>
              <div>
                {profile.emailVerified ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Unverified
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-medium block">Phone Number</span>
                <span className="font-mono text-slate-200 text-[11px]">
                  {profile.phoneNormalized || profile.phone || "No phone number attached"}
                </span>
                {profile.phone && profile.phoneNormalized && profile.phone !== profile.phoneNormalized && (
                  <span className="text-[10px] text-slate-500 block font-mono">
                    Raw: {profile.phone}
                  </span>
                )}
                {profile.phone && (
                  <span className="text-[10px] text-slate-500 block">
                    Visibility: {profile.phoneVisibility || "workspace"}
                    {profile.phoneVerifiedAt && ` • Verified on ${new Date(profile.phoneVerifiedAt).toLocaleDateString()}`}
                  </span>
                )}
              </div>
              <div>
                {profile.phoneStatus === "verified" || profile.phoneVerified ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : profile.phone ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Unverified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold border border-slate-700">
                    Not Set
                  </span>
                )}
              </div>
            </div>

            {profile.additionalPhones && profile.additionalPhones.length > 1 && (
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 uppercase font-bold">Other Phone Numbers</span>
                <div className="space-y-1">
                  {profile.additionalPhones
                    .filter((p: any) => p.phone !== profile.phone)
                    .map((p: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[11px]">
                        <span className="font-mono text-slate-300">{p.phone}</span>
                        <span className={p.isVerified ? "text-emerald-400" : "text-slate-500"}>
                          {p.isVerified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Location Hierarchy (Nigerian Structured) */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <MapPin className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Geographical Location</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Country</span>
              <span className="font-semibold text-slate-200">{profile.country || "Nigeria"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">State</span>
              <span className="font-semibold text-slate-200">
                {profile.state ? `${profile.state} (${profile.stateCode || "NG"})` : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">LGA</span>
              <span className="font-semibold text-slate-200">{profile.lga || "—"}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">City</span>
              <span className="font-semibold text-slate-200">{profile.city || "—"}</span>
            </div>
          </div>
        </div>

        {/* Preferences & System Timestamps */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Globe className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Locale & Timestamps</h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Timezone</span>
              <span className="font-semibold text-slate-200">{profile.timezone}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Currency</span>
              <span className="font-semibold text-slate-200">{profile.currencyPreference}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Language / Locale</span>
              <span className="font-semibold text-slate-200">
                {profile.language} ({profile.locale})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Theme</span>
              <span className="font-semibold text-slate-200 capitalize">{profile.theme}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Account Created</span>
              <span className="font-semibold text-slate-200">
                {profile.createdAt ? new Date(profile.createdAt).toLocaleString() : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Last Profile Update</span>
              <span className="font-semibold text-slate-200">
                {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileTab;

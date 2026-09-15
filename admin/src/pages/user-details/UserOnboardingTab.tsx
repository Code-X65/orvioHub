import React from "react";
import {
  Sparkles,
  FileCheck,
  Building,
  Layers,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

interface UserOnboardingTabProps {
  onboardingData: any;
  loading?: boolean;
}

export const UserOnboardingTab: React.FC<UserOnboardingTabProps> = ({ onboardingData, loading }) => {
  if (loading || !onboardingData) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading onboarding answers and history...
      </div>
    );
  }

  const { registrationMetadata, personalAnswers, organizations, applications, timelineEvents } =
    onboardingData;

  return (
    <div className="space-y-6">
      {/* 1. Registration Metadata */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <FileCheck className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">Registration & Consent Metadata</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Signup Method</span>
            <span className="font-semibold text-slate-200 capitalize">
              {registrationMetadata.signupMethod?.replace(/_/g, " ")}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Discovery Source</span>
            <span className="font-semibold text-slate-200 capitalize">
              {registrationMetadata.acquisitionSource || "Direct / Web"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Terms Accepted</span>
            <span className="font-semibold text-slate-200">
              {registrationMetadata.termsAcceptedAt
                ? new Date(registrationMetadata.termsAcceptedAt).toLocaleString()
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Privacy Policy Accepted</span>
            <span className="font-semibold text-slate-200">
              {registrationMetadata.privacyPolicyAcceptedAt
                ? new Date(registrationMetadata.privacyPolicyAcceptedAt).toLocaleString()
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Marketing Consent</span>
            {registrationMetadata.marketingConsent?.granted ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Subscribed
              </span>
            ) : (
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Not Subscribed
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Email Verified</span>
            <span className="font-semibold text-slate-200">
              {registrationMetadata.emailVerifiedAt
                ? new Date(registrationMetadata.emailVerifiedAt).toLocaleString()
                : "Unverified"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">First Sign-in</span>
            <span className="font-semibold text-slate-200">
              {registrationMetadata.firstLoginAt
                ? new Date(registrationMetadata.firstLoginAt).toLocaleString()
                : "—"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">Registered At</span>
            <span className="font-semibold text-slate-200">
              {registrationMetadata.registeredAt
                ? new Date(registrationMetadata.registeredAt).toLocaleString()
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Personal Onboarding Answers */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <h3 className="text-sm font-bold text-white">Global Personal Onboarding Answers</h3>
          </div>
          <div className="flex items-center gap-2">
            {!personalAnswers.completed && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-500/10 text-brand-300 border border-brand-500/20">
                Stopped at Step {personalAnswers.currentStep || 1} of 4
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                personalAnswers.completed
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {personalAnswers.completed ? "Completed" : "Incomplete (Draft)"}
            </span>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-bold">1. Intended Use of OrvioHub (Step 1)</span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {personalAnswers.intendedUse && personalAnswers.intendedUse.length > 0 ? (
                personalAnswers.intendedUse.map((use: string, i: number) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-200 font-medium text-[11px]"
                  >
                    {use}
                  </span>
                ))
              ) : (
                <span className="text-slate-500 italic">No specific use case chosen yet</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">2. User Role (Step 2)</span>
              <span className="font-semibold text-slate-200 capitalize">
                {personalAnswers.role || "Not answered yet"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">3. Manages Business? (Step 3)</span>
              <span className="font-semibold text-slate-200">
                {personalAnswers.managesBusiness !== undefined
                  ? personalAnswers.managesBusiness
                    ? "Yes, actively manages"
                    : "No / In Planning"
                  : "Not answered yet"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">4. Discovery Source (Step 4)</span>
              <span className="font-semibold text-slate-200 capitalize">
                {personalAnswers.acquisitionSource || "Direct / Unknown"}
                {personalAnswers.acquisitionSourceOther ? ` (${personalAnswers.acquisitionSourceOther})` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">
                {personalAnswers.completed ? "Completed On" : "Last Draft Update"}
              </span>
              <span className="font-semibold text-slate-200">
                {personalAnswers.completedAt
                  ? new Date(personalAnswers.completedAt).toLocaleString()
                  : personalAnswers.updatedAt
                  ? new Date(personalAnswers.updatedAt).toLocaleString()
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Organization Onboarding Answers */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Building className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">
            Organization Onboarding Profiles ({organizations.length})
          </h3>
        </div>

        {organizations.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No organizations onboarded by this user.</p>
        ) : (
          <div className="space-y-4">
            {organizations.map((org: any) => (
              <div
                key={org.workspaceId}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/organizations/${org.workspaceId}`}
                      className="font-bold text-white hover:text-brand-400 transition flex items-center gap-1.5 text-sm"
                    >
                      <span>{org.organizationName}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </Link>
                    <span className="font-mono text-[11px] text-slate-500">slug: {org.slug}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      org.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}
                  >
                    {org.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] font-bold">Business Type</span>
                    <span className="font-semibold text-slate-200 capitalize">{org.businessType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] font-bold">Branches Range</span>
                    <span className="font-semibold text-slate-200">{org.branchCountRange} locations</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] font-bold">Products Range</span>
                    <span className="font-semibold text-slate-200">{org.productCountRange} items</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase text-[9px] font-bold">Location & Currency</span>
                    <span className="font-semibold text-slate-200">
                      {org.country} • {org.currency}
                    </span>
                  </div>
                </div>

                {org.completedSteps && org.completedSteps.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                    <span className="text-slate-500 text-[10px] uppercase font-bold">Completed Steps:</span>
                    <div className="flex flex-wrap gap-1">
                      {org.completedSteps.map((step: string, i: number) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px] font-medium"
                        >
                          ✓ {step}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Application Onboarding Answers (Inventory) */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">
            Application Onboarding (Inventory Responses)
          </h3>
        </div>

        {applications.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No application onboarding responses recorded.
          </p>
        ) : (
          <div className="space-y-4">
            {applications.map((app: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{app.organizationName} — Inventory Setup</span>
                  <span className="text-[11px] text-slate-400">
                    Completed: {app.completedAt ? new Date(app.completedAt).toLocaleDateString() : "—"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-500 block uppercase text-[10px] font-bold">Previous Tools</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.previousTools?.length > 0 ? (
                        app.previousTools.map((t: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-[10px]">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">None specified</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block uppercase text-[10px] font-bold">Current Pain Points</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.painPoints?.length > 0 ? (
                        app.painPoints.map((p: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px]">
                            {p}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">None specified</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block uppercase text-[10px] font-bold">Priority Features</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.priorityFeatures?.length > 0 ? (
                        app.priorityFeatures.map((f: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
                            {f}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 italic">None specified</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Onboarding Timeline Events */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <History className="w-4 h-4 text-brand-400" />
          <h3 className="text-sm font-bold text-white">Onboarding Step Activity Trail</h3>
        </div>

        {timelineEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">No step event timeline recorded.</p>
        ) : (
          <div className="space-y-2">
            {timelineEvents.map((event: any) => (
              <div
                key={event.id}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white capitalize">{event.eventType?.replace(/_/g, " ")}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                      {event.step}
                    </span>
                  </div>
                  {event.productKey && (
                    <span className="text-[10px] text-indigo-400">App: {event.productKey}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserOnboardingTab;

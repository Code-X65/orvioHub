import React from "react";
import { applications, DEV_ROOT, PROD_ROOT } from "@orviohub/shared";
import { AlertTriangle, Globe, ArrowRight } from "lucide-react";

interface UnknownHostScreenProps {
  hostname: string;
}

export const UnknownHostScreen: React.FC<UnknownHostScreenProps> = ({ hostname }) => {
  const isDev = hostname.includes("localhost");
  const rootDomain = isDev ? DEV_ROOT : PROD_ROOT;
  const rootUrl = isDev ? `http://${DEV_ROOT}:5173` : `https://${PROD_ROOT}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="flex items-center space-x-3 text-amber-400">
          <div className="p-3 bg-amber-400/10 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Unrecognized Host Surface</h1>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-mono">Status: 400 Bad Request</p>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2">
          <div className="text-xs text-slate-400 font-medium">Requested Hostname:</div>
          <div className="font-mono text-sm text-red-400 break-all bg-red-950/20 px-3 py-1.5 rounded-lg border border-red-900/30">
            {hostname}
          </div>
          <p className="text-xs text-slate-400 pt-1 leading-relaxed">
            This hostname is not recognized as a registered Orviohub application surface. 
            Orviohub does not use subdomains for workspaces or organizations.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Valid Orviohub Surfaces:</span>
            <span className="font-mono text-[11px] text-slate-500">{rootDomain}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.values(applications)
              .filter((app) => app.enabled)
              .map((app) => {
                const targetUrl = isDev ? app.developmentUrl : app.productionUrl;
                return (
                  <a
                    key={app.key}
                    href={targetUrl}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-800/60 hover:border-indigo-500/50 transition-all group"
                  >
                    <span className="font-medium text-slate-300 group-hover:text-white truncate">
                      {app.name}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5 ml-1 shrink-0" />
                  </a>
                );
              })}
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <a
            href={rootUrl}
            className="inline-flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>Return to {applications.marketing.name}</span>
          </a>
          <span className="text-[11px] text-slate-600 font-mono">Orviohub Security Guard</span>
        </div>
      </div>
    </div>
  );
};

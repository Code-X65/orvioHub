import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export const AuthGuard: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 rounded-full border-2 border-brand-500/20 border-t-brand-500 animate-spin" />
          <div className="absolute w-8 h-8 rounded-full bg-brand-500/10 backdrop-blur flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-400 tracking-wider uppercase">
          Verifying Admin Credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default AuthGuard;

import { Routes, Route, Navigate } from "react-router-dom";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { ComingSoonPage } from "../../pages/ComingSoonPage";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";

export default function TaskManagementApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />
      <Route path="/" element={<AppProductLanding />} />
      <Route path="/onboarding" element={<ComingSoonPage appName="Task Management" />} />
      <Route path="/dashboard" element={<ComingSoonPage appName="Task Management" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


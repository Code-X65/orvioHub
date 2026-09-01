import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "../../components/auth/AuthGuard";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { Dashboard } from "../../pages/Dashboard";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";
import { TasksOnboarding } from "../../pages/tasks/TasksOnboarding";

export default function TaskManagementApp() {
  return (
    <Routes>
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />
      <Route path="/" element={<AppProductLanding />} />
      <Route
        path="/onboarding"
        element={
          <AuthGuard>
            <TasksOnboarding />
          </AuthGuard>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

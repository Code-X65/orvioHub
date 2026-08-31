import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthGuard from "./components/AuthGuard";
import AdminLayout from "./layouts/AdminLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import UserDetails from "./pages/UserDetails";
import Organizations from "./pages/Organizations";
import OrganizationDetails from "./pages/OrganizationDetails";
import Invitations from "./pages/Invitations";
import Onboarding from "./pages/Onboarding";
import Products from "./pages/Products";
import Plans from "./pages/Plans";
import { Subscriptions } from "./pages/Subscriptions";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Protected Admin Routes */}
      <Route element={<AuthGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:id" element={<UserDetails />} />
          <Route path="/organizations" element={<Organizations />} />
          <Route path="/organizations/:id" element={<OrganizationDetails />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/invitations" element={<Invitations />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/products" element={<Products />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;

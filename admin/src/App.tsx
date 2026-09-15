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
import ApplicationWorkspaces from "./pages/ApplicationWorkspaces";
import InventoryTeamExplorer from "./pages/InventoryTeamExplorer";
import Plans from "./pages/Plans";
import { Subscriptions } from "./pages/Subscriptions";
import { SubscriptionDetails } from "./pages/SubscriptionDetails";
import AuditLogs from "./pages/AuditLogs";
import PhoneChallenges from "./pages/PhoneChallenges";
import Settings from "./pages/Settings";
import DeletionQueue from "./pages/DeletionQueue";

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
          
          {/* Billing & Subscriptions Routes */}
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/subscriptions/:id" element={<SubscriptionDetails />} />
          <Route path="/billing/subscriptions" element={<Subscriptions />} />
          <Route path="/billing/subscriptions/:id" element={<SubscriptionDetails />} />
          
          <Route path="/plans" element={<Plans />} />
          <Route path="/plans/new" element={<Plans />} />
          <Route path="/plans/:id/edit" element={<Plans />} />
          <Route path="/billing/plans" element={<Plans />} />
          <Route path="/billing/plans/new" element={<Plans />} />
          <Route path="/billing/plans/:id/edit" element={<Plans />} />

          <Route path="/invitations" element={<Invitations />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/products" element={<Products />} />
          <Route path="/applications/inventory/team" element={<InventoryTeamExplorer />} />
          <Route path="/admin/inventory/team" element={<InventoryTeamExplorer />} />
          <Route path="/applications/:appKey" element={<ApplicationWorkspaces />} />
          <Route path="/applications/inventory" element={<ApplicationWorkspaces />} />
          <Route path="/admin/applications/inventory" element={<ApplicationWorkspaces />} />
          <Route path="/phone-challenges" element={<PhoneChallenges />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/deletions" element={<DeletionQueue />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};


export default App;

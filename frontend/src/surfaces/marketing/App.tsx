import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "../../pages/LandingPage";
import { PricingPage } from "../../pages/pricing/PricingPage";
import { BillingCallbackPage } from "../../pages/billing/BillingCallbackPage";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { AcceptInvite } from "../../pages/auth/AcceptInvite";
import { VerifyEmail } from "../../pages/auth/VerifyEmail";

export default function MarketingApp() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/billing/callback" element={<BillingCallbackPage />} />
      <Route path="/products" element={<AppProductLanding />} />
      <Route path="/features" element={<AppProductLanding />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/invitations/:token" element={<AcceptInvite />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

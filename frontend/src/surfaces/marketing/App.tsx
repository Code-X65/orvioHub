import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { LandingPage } from "../../pages/LandingPage";
import { PricingPage } from "../../pages/pricing/PricingPage";
import { BillingCallbackPage } from "../../pages/billing/BillingCallbackPage";
import { PaymentPage } from "../../pages/billing/PaymentPage";
import { AppProductLanding } from "../../pages/products/AppProductLanding";
import { InventoryMarketingPage } from "../../pages/marketing/InventoryMarketingPage";
import { InventoryPricingPage } from "../../pages/marketing/InventoryPricingPage";
import { InventoryInteractiveDemoPage } from "../../pages/marketing/InventoryInteractiveDemoPage";
import { getLoginUrl, getSignupUrl, getAccountsUrl } from "@/lib/domain";
import { crossSubdomainNavigate } from "@/lib/crossSubdomainNavigate";

function RedirectToLogin() {
  useEffect(() => {
    crossSubdomainNavigate(getLoginUrl(window.location.origin));
  }, []);
  return null;
}

function RedirectToSignup() {
  useEffect(() => {
    crossSubdomainNavigate(getSignupUrl(window.location.origin));
  }, []);
  return null;
}

function RedirectToAccounts() {
  useEffect(() => {
    crossSubdomainNavigate(`${getAccountsUrl()}${window.location.pathname}${window.location.search}`);
  }, []);
  return null;
}

export default function MarketingApp() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/inventory" element={<InventoryMarketingPage />} />
      <Route path="/inventory/pricing" element={<InventoryPricingPage />} />
      <Route path="/inventory/demo" element={<InventoryInteractiveDemoPage />} />
      <Route path="/inventory/features" element={<InventoryMarketingPage />} />
      <Route path="/inventory/faqs" element={<InventoryMarketingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/payment" element={<PaymentPage />} />
      <Route path="/billing/callback" element={<BillingCallbackPage />} />
      <Route path="/products" element={<AppProductLanding />} />
      <Route path="/products/:productId" element={<AppProductLanding />} />
      <Route path="/features" element={<AppProductLanding />} />
      <Route path="/login" element={<RedirectToLogin />} />
      <Route path="/signup" element={<RedirectToSignup />} />
      <Route path="/verify-email" element={<RedirectToAccounts />} />
      <Route path="/verify-email/:token" element={<RedirectToAccounts />} />
      <Route path="/reset-password" element={<RedirectToAccounts />} />
      <Route path="/invite/:token" element={<RedirectToAccounts />} />
      <Route path="/invitations/:token" element={<RedirectToAccounts />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


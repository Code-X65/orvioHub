import React, { useState } from 'react';
import { api } from '@/lib/api';
import { OtpVerificationModal } from './OtpVerificationModal';
import { toast } from 'sonner';

export interface BranchPhoneVerificationProps {
  isOpen: boolean;
  phone: string;
  branchName?: string;
  organizationId?: string;
  branchId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Handles phone verification challenge and OTP verification for branches,
 * supporting both pre-creation (organization-level challenge) and existing branches.
 */
export const BranchPhoneVerification: React.FC<BranchPhoneVerificationProps> = ({
  isOpen,
  phone,
  branchName = 'branch',
  organizationId,
  branchId,
  onClose,
  onSuccess,
}) => {
  const [isStarting, setIsStarting] = useState(false);

  // Determine endpoint base depending on whether branchId is available
  const getEndpoints = () => {
    const org = organizationId || 'current';
    if (branchId) {
      return {
        start: `/organizations/${org}/branches/${branchId}/phone/verification/start`,
        verify: `/organizations/${org}/branches/${branchId}/phone/verification/verify`,
        resend: `/organizations/${org}/branches/${branchId}/phone/verification/resend`,
      };
    }
    return {
      start: `/organizations/${org}/settings/phone/verification/start`,
      verify: `/organizations/${org}/settings/phone/verification/verify`,
      resend: `/organizations/${org}/settings/phone/verification/resend`,
    };
  };

  const handleVerify = async (otp: string) => {
    const endpoints = getEndpoints();
    try {
      await api.post(endpoints.verify, {
        code: otp.trim(),
        purpose: 'branch_phone_verification',
      });
      toast.success('Branch phone number verified successfully!');
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Verification failed. Please check the code.';
      throw new Error(msg);
    }
  };

  const handleResend = async () => {
    const endpoints = getEndpoints();
    try {
      await api.post(endpoints.resend, {
        purpose: 'branch_phone_verification',
      });
      toast.success(`Verification code resent to ${phone}`);
    } catch (err: any) {
      const msg = err?.message || err?.error?.message || 'Failed to resend code.';
      toast.error(msg);
    }
  };

  return (
    <OtpVerificationModal
      isOpen={isOpen}
      phone={phone}
      title="Verify Branch Phone"
      subtitle={`We sent a 6-digit SMS verification code to confirm ${branchName}'s contact phone.`}
      onClose={onClose}
      onSuccess={onSuccess}
      onVerifyOverride={handleVerify}
      onResendOverride={handleResend}
    />
  );
};

export default BranchPhoneVerification;

import { anyApi } from 'convex/server';
import type { ConvexHttpClient } from 'convex/browser';
import { env } from '../config/env.js';

type OutboxMessage = {
  _id?: string;
  to: string;
  template: 'verification' | 'invitation' | 'onboardingCompleted' | 'passwordReset' | 'emailChange' | 'twoFactorStatus' | 'securityAlert';
  payload: Record<string, string>;
};

function buildHtmlTemplate({
  title,
  preheader,
  contentHtml,
  buttonText,
  buttonUrl,
  footerNote,
}: {
  title: string;
  preheader?: string;
  contentHtml: string;
  buttonText?: string;
  buttonUrl?: string;
  footerNote?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0c080b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; -webkit-font-smoothing: antialiased; }
    .container { max-width: 580px; margin: 40px auto; background-color: #140e13; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 4px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { padding: 28px 32px; background: linear-gradient(180deg, #1c131a 0%, #140e13 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.06); text-align: left; }
    .brand { font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; text-decoration: none; }
    .brand-accent { color: #c79dbd; }
    .body { padding: 32px; font-size: 14px; line-height: 1.6; color: #cbd5e1; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; letter-spacing: -0.3px; }
    .button-container { margin: 28px 0; text-align: left; }
    .button { display: inline-block; background-color: #714b67; color: #ffffff !important; padding: 12px 28px; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 3px; box-shadow: 0 4px 12px rgba(113, 75, 103, 0.35); }
    .fallback-url { margin-top: 24px; padding: 14px; background-color: #0b070a; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 3px; font-size: 11px; word-break: break-all; color: #94a3b8; font-family: monospace; }
    .footer { padding: 24px 32px; background-color: #0e0a0d; border-top: 1px solid rgba(255, 255, 255, 0.05); font-size: 11px; color: #64748b; text-align: left; line-height: 1.5; }
    .footer a { color: #c79dbd; text-decoration: none; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>` : ''}
  <div class="container">
    <div class="header">
      <div class="brand">Orvio<span class="brand-accent">Hub</span></div>
    </div>
    <div class="body">
      <h1 class="title">${title}</h1>
      ${contentHtml}
      ${
        buttonText && buttonUrl
          ? `<div class="button-container">
              <a href="${buttonUrl}" class="button" target="_blank">${buttonText}</a>
            </div>
            <div class="fallback-url">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${buttonUrl}" style="color: #c79dbd; text-decoration: underline;">${buttonUrl}</a>
            </div>`
          : ''
      }
      ${footerNote ? `<p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">${footerNote}</p>` : ''}
    </div>
    <div class="footer">
      <div><strong>Orvio Technologies Nigeria</strong> • Multi-Workspace Business Platform</div>
      <div>Operating in Nigeria (West Africa) • Timezone: Africa/Lagos (GMT+1)</div>
      <div style="margin-top: 8px;">Need help? Contact support at <a href="mailto:support@orviohub.com">support@orviohub.com</a></div>
    </div>
  </div>
</body>
</html>`;
}

function renderEmail(message: { template: string; payload: Record<string, string> }) {
  switch (message.template) {
    case 'verification':
      return {
        subject: 'Verify your email address - Orviohub',
        html: buildHtmlTemplate({
          title: 'Verify your email address',
          preheader: message.payload.code ? `Your Orviohub verification code is ${message.payload.code}.` : 'Complete your Orviohub registration by confirming your email address.',
          contentHtml: `<p>Hello ${message.payload.name || 'there'},</p>
          <p>Thank you for choosing Orviohub! Please use the 6-digit verification code below to confirm your email and activate your account:</p>
          ${
            message.payload.code
              ? `<div style="margin: 24px 0; text-align: center;">
                  <div style="display: inline-block; background-color: #1a1118; border: 1.5px solid #FDB02F; border-radius: 6px; padding: 16px 36px; box-shadow: 0 4px 16px rgba(253, 176, 47, 0.15);">
                    <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #FDB02F; font-family: monospace;">${message.payload.code}</span>
                  </div>
                  <p style="margin-top: 10px; font-size: 12px; color: #94a3b8;">This code expires in <strong style="color: #cbd5e1;">10 minutes</strong>.</p>
                </div>`
              : ''
          }
          <p>Or click the button below to verify your email directly in your browser:</p>`,
          buttonText: 'Verify Email Address',
          buttonUrl: message.payload.url,
          footerNote: 'This link is valid for 24 hours. If you did not request this verification, you can safely ignore this message.',
        }),
      };

    case 'invitation':
      return {
        subject: `You've been invited to join ${message.payload.organizationName || message.payload.workspaceName || 'an organization'} on OrvioHub`,
        html: buildHtmlTemplate({
          title: 'Workspace Invitation',
          preheader: `Join ${message.payload.organizationName || message.payload.workspaceName} on OrvioHub.`,
          contentHtml: `<p>Hello,</p>
          <p><strong>${message.payload.inviterName || 'A teammate'}</strong> has invited you to collaborate in <strong>${message.payload.organizationName || message.payload.workspaceName || 'their workspace'}</strong> as a <strong>${message.payload.role || 'Member'}</strong>.</p>
          <p>Click below to accept your invitation and start collaborating:</p>`,
          buttonText: 'Accept Invitation',
          buttonUrl: message.payload.url,
          footerNote: 'This invitation is tied to your email address and is valid for 7 days.',
        }),
      };

    case 'onboardingCompleted':
      return {
        subject: `Welcome to ${message.payload.organizationName || 'OrvioHub'}!`,
        html: buildHtmlTemplate({
          title: 'Welcome to OrvioHub!',
          preheader: 'Your workspace is ready for business.',
          contentHtml: `<p>Hello ${message.payload.name || 'there'},</p>
          <p>Congratulations! Your organization <strong>${message.payload.organizationName || 'Workspace'}</strong> has been successfully configured.</p>
          <p>You can now access your product suites including Inventory, POS, CRM, and Multi-Branch Management.</p>`,
          buttonText: 'Open Workspace Dashboard',
          buttonUrl: message.payload.url || `${env.BASE_URL_INVENTORY || env.APP_URL}/dashboard`,
        }),
      };

    case 'passwordReset':
      return {
        subject: 'Reset your OrvioHub password',
        html: buildHtmlTemplate({
          title: 'Password Reset Request',
          preheader: 'Reset your account password.',
          contentHtml: `<p>Hello ${message.payload.name || 'there'},</p>
          <p>We received a request to reset your password for your OrvioHub account.</p>
          <p>Click the button below to choose a new password:</p>`,
          buttonText: 'Reset Password',
          buttonUrl: message.payload.url,
          footerNote: 'For security reasons, this link will expire in 1 hour. If you did not make this request, please contact your security admin immediately.',
        }),
      };

    case 'emailChange':
      return {
        subject: 'Confirm your new email address - OrvioHub',
        html: buildHtmlTemplate({
          title: 'Confirm Email Address Change',
          preheader: 'Confirm change of email address for your OrvioHub account.',
          contentHtml: `<p>Hello ${message.payload.name || 'there'},</p>
          <p>You recently requested to update your login email address on OrvioHub.</p>
          <p>Click below to verify and activate your new email address:</p>`,
          buttonText: 'Confirm Email Change',
          buttonUrl: message.payload.url,
          footerNote: 'This link expires in 24 hours. If you did not request this change, please contact support immediately.',
        }),
      };

    case 'trial_started':
      return {
        subject: 'Your Orviohub Free Trial Has Started! 🎉',
        html: buildHtmlTemplate({
          title: 'Your 14-Day Free Trial Has Started!',
          preheader: `Welcome to OrvioHub. Your trial for ${message.payload.orgName || 'your organization'} is active.`,
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>Your 14-day free trial for <strong>${message.payload.orgName || 'your organization'}</strong> is now officially active with full access to the Standard Plan suite (3 organizations, 3 applications, 10 team members, 3 branches, 5,000 products, and 5,000 transactions/mo).</p>
          <p>Your trial ends on <strong>${message.payload.trialEndsAt || '14 days from now'}</strong>. No payment details are required during the trial.</p>`,
          buttonText: 'Launch Workspace Apps',
          buttonUrl: message.payload.url || `${env.BASE_URL_INVENTORY || env.APP_URL}/dashboard`,
        }),
      };

    case 'trial_reminder_7days':
      return {
        subject: '7 Days Left in Your Orviohub Trial ⏰',
        html: buildHtmlTemplate({
          title: '7 Days Remaining on Your Trial',
          preheader: 'Halfway through your OrvioHub trial. Upgrade anytime to continue.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>You have <strong>7 days remaining</strong> on your free trial for <strong>${message.payload.orgName || 'your organization'}</strong> (ends on ${message.payload.trialEndsAt}).</p>
          <p>Upgrade to the Standard Plan (₦7,500/month or ₦75,000/year) today to lock in uninterrupted business operations for your stores.</p>`,
          buttonText: 'Upgrade to Standard Plan',
          buttonUrl: message.payload.url || `${env.BASE_URL_HOME || env.APP_URL}/settings/billing`,
        }),
      };

    case 'trial_reminder_2days':
      return {
        subject: '2 Days Left - Upgrade Now to Keep Access ⚠️',
        html: buildHtmlTemplate({
          title: '2 Days Remaining - Action Required',
          preheader: 'Your trial expires in 48 hours.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>Your OrvioHub trial for <strong>${message.payload.orgName || 'your organization'}</strong> will expire in <strong>2 days</strong> on ${message.payload.trialEndsAt}.</p>
          <p>To avoid account suspension or interruption to your branches and catalog inventory, please upgrade to Standard plan.</p>`,
          buttonText: 'Upgrade to Standard',
          buttonUrl: message.payload.url || `${env.BASE_URL_HOME || env.APP_URL}/settings/billing`,
        }),
      };

    case 'trial_reminder_today':
      return {
        subject: 'Your Orviohub Trial Expires Today 🔒',
        html: buildHtmlTemplate({
          title: 'Your Free Trial Expires Today',
          preheader: 'Upgrade today to keep your workspace active.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>Today is the final day of your free trial for <strong>${message.payload.orgName || 'your organization'}</strong>.</p>
          <p>Upgrade to the Standard Plan right now via Paystack or Bank Transfer to keep your products, sales, and members active.</p>`,
          buttonText: 'Upgrade Now',
          buttonUrl: message.payload.url || `${env.BASE_URL_HOME || env.APP_URL}/settings/billing`,
        }),
      };

    case 'trial_expired':
      return {
        subject: 'Your Orviohub Trial Has Expired 🔒',
        html: buildHtmlTemplate({
          title: 'Your Trial Has Ended',
          preheader: 'Your workspace has entered read-only mode.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>The 14-day free trial for <strong>${message.payload.orgName || 'your organization'}</strong> has expired, and your workspace has been temporarily suspended into read-only mode.</p>
          <p>All your data, branches, products, and configurations are securely preserved. Simply upgrade to reactivate full workspace capabilities instantly.</p>`,
          buttonText: 'Reactivate with Standard Plan',
          buttonUrl: message.payload.url || `${env.BASE_URL_HOME || env.APP_URL}/settings/billing`,
        }),
      };

    case 'payment_success':
      return {
        subject: 'Payment Confirmed - Orviohub Standard Activated ✅',
        html: buildHtmlTemplate({
          title: 'Payment Confirmed!',
          preheader: 'Your Standard subscription is active.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>We've received your payment of <strong>₦${message.payload.amount || '7,500'}</strong> for <strong>${message.payload.orgName || 'your organization'}</strong>.</p>
          <p>Your <strong>Standard Plan</strong> is now active. All features, apps, and higher transaction quotas have been unlocked.</p>
          ${message.payload.nextPayment ? `<p>Next renewal date: <strong>${message.payload.nextPayment}</strong></p>` : ''}`,
          buttonText: 'Go to Workspace Dashboard',
          buttonUrl: message.payload.url || `${env.BASE_URL_INVENTORY || env.APP_URL}/dashboard`,
        }),
      };

    case 'payment_failed':
      return {
        subject: 'Payment Failed - Action Required ⚠️',
        html: buildHtmlTemplate({
          title: 'Payment / Verification Issue',
          preheader: 'Action required regarding your subscription payment.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>We encountered an issue processing or verifying your subscription payment for <strong>${message.payload.orgName || 'your organization'}</strong>.</p>
          <p>${message.payload.reason || 'Please check your payment method or contact support for assistance.'}</p>`,
          buttonText: 'Update Payment Method',
          buttonUrl: message.payload.url || `${env.BASE_URL_HOME || env.APP_URL}/settings/billing`,
        }),
      };

    case 'renewal_reminder':
      return {
        subject: 'Your Orviohub Subscription Renews in 7 Days',
        html: buildHtmlTemplate({
          title: 'Upcoming Subscription Renewal',
          preheader: 'Your subscription will renew soon.',
          contentHtml: `<p>Hello ${message.payload.firstName || message.payload.name || 'there'},</p>
          <p>This is a quick notice that your Standard plan subscription for <strong>${message.payload.orgName || 'your organization'}</strong> is scheduled to renew on <strong>${message.payload.renewalDate || 'soon'}</strong> for <strong>₦${message.payload.amount || '7,500'}</strong>.</p>`,
          buttonText: 'Manage Billing & Invoices',
          buttonUrl: message.payload.url || `${env.BASE_URL_HOME || env.APP_URL}/settings/billing`,
        }),
      };


    default:
      return {
        subject: 'Notification from OrvioHub',
        html: buildHtmlTemplate({
          title: 'Account Notification',
          contentHtml: `<p>${message.payload.message || 'You have a new notification from OrvioHub.'}</p>`,
          buttonText: message.payload.url ? 'View in OrvioHub' : undefined,
          buttonUrl: message.payload.url,
        }),
      };
  }
}

export class EmailService {
  private timer: NodeJS.Timeout | undefined;
  private isProcessing = false;
  private sentEmails: Array<{
    to: string;
    event?: string;
    template?: string;
    payload: any;
  }> = [];

  public clearSentEmails() {
    this.sentEmails = [];
  }

  public getSentEmails() {
    return this.sentEmails;
  }

  public recordSentEmail(to: string, template: string, payload: Record<string, string>) {
    let event = 'EMAIL_DISPATCHED';
    let token = '';
    if (template === 'verification') {
      event = 'USER_VERIFICATION_REQUESTED';
      token = payload.url?.split('verify-email/')[1]?.split('?')[0] || payload.url?.split('token=')[1] || payload.token || '';
    } else if (template === 'passwordReset') {
      event = 'PASSWORD_RESET_REQUESTED';
      token = payload.url?.split('reset-password/')[1]?.split('?')[0] || payload.url?.split('token=')[1] || payload.token || '';
    } else if (template === 'invitation') {
      event = 'ORGANIZATION_INVITATION_CREATED';
      token = payload.url?.split('invitations/')[1]?.split('?')[0] || payload.url?.split('invite/')[1]?.split('?')[0] || payload.url?.split('token=')[1] || payload.token || '';
    } else if (template === 'emailChange') {
      event = 'EMAIL_CHANGE_REQUESTED';
      token = payload.url?.split('confirm-email/')[1]?.split('?')[0] || payload.url?.split('token=')[1] || payload.token || '';
    }

    this.sentEmails.push({
      to,
      event,
      template,
      payload: {
        to,
        template,
        data: {
          ...payload,
          token,
        },
      },
    });
  }

  /**
   * Directly dispatches an email via Brevo/Resend immediately upon trigger.
   */
  public async sendDirect(to: string, template: OutboxMessage['template'], payload: Record<string, string>): Promise<{ success: boolean; providerId?: string; error?: string }> {
    this.recordSentEmail(to, template, payload);
    const rendered = renderEmail({ template, payload });

    // Always log the direct verification / action URL for development visibility
    console.log('\n=============================================================');
    console.log(`📧 [EMAIL DISPATCH] To: ${to} | Subject: ${rendered.subject}`);
    if (payload.url) {
      console.log(`🔗 [DIRECT ACTION LINK]: ${payload.url}`);
    }
    console.log('=============================================================\n');

    if (!env.BREVO_API_KEY && !env.RESEND_API_KEY) {
      console.warn(`[EmailService] No Brevo/Resend API key configured. Email recorded locally.`);
      return { success: true, providerId: 'dev-local-mock' };
    }

    try {
      if (env.BREVO_API_KEY) {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': env.BREVO_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            sender: {
              name: env.EMAIL_FROM_NAME || 'OrvioHub',
              email: env.EMAIL_FROM || 'no-reply@orviohub.com',
            },
            to: [{ email: to }],
            subject: rendered.subject,
            htmlContent: rendered.html,
          }),
        });

        const result = (await response.json()) as { messageId?: string; message?: string; code?: string };
        if (!response.ok) {
          console.error(`[EmailService] Brevo API error (${response.status}):`, result);
          return { success: false, error: result.message || `Brevo returned ${response.status}` };
        }

        console.log(`[EmailService] Brevo email dispatched successfully to ${to} (MessageId: ${result.messageId})`);
        return { success: true, providerId: result.messageId };
      } else if (env.RESEND_API_KEY) {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], ...rendered }),
        });

        const result = (await response.json()) as { id?: string; message?: string };
        if (!response.ok) {
          console.error(`[EmailService] Resend API error (${response.status}):`, result);
          return { success: false, error: result.message || `Resend returned ${response.status}` };
        }

        console.log(`[EmailService] Resend email dispatched successfully to ${to} (Id: ${result.id})`);
        return { success: true, providerId: result.id };
      }
    } catch (err: any) {
      console.error('[EmailService] Delivery error:', err.message || err);
      return { success: false, error: err.message || 'Network error' };
    }

    return { success: true };
  }

  public start(client: ConvexHttpClient) {
    if (this.timer || (!env.BREVO_API_KEY && !env.RESEND_API_KEY) || !env.EMAIL_FROM) return;
    this.timer = setInterval(() => void this.flush(client), 10_000);
    void this.flush(client);
  }

  public stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async flush(client: ConvexHttpClient) {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      let messages: OutboxMessage[] = [];
      try {
        messages = ((await client.query((anyApi as any).emailOutbox.ready, { limit: 20 })) || []) as OutboxMessage[];
      } catch (err: any) {
        if (env.NODE_ENV !== 'test') {
          console.warn(`[EmailService] Outbox poll skipped: ${err.message || err}`);
        }
        return;
      }

      for (const queued of messages) {
        if (!queued._id) continue;
        const message = ((await client.mutation((anyApi as any).emailOutbox.claim, { id: queued._id })) as OutboxMessage | null);
        if (!message || !message._id) continue;
        try {
          const directRes = await this.sendDirect(message.to, message.template, message.payload);
          if (directRes.success) {
            await client.mutation((anyApi as any).emailOutbox.markSent, { id: message._id, providerMessageId: directRes.providerId || 'sent' });
          } else {
            await client.mutation((anyApi as any).emailOutbox.markFailed, {
              id: message._id,
              error: directRes.error || 'Delivery failed',
            });
          }
        } catch (error) {
          await client.mutation((anyApi as any).emailOutbox.markFailed, {
            id: message._id,
            error: error instanceof Error ? error.message : 'Unknown email delivery failure',
          });
        }
      }
    } catch (err: any) {
      if (env.NODE_ENV !== 'test') {
        console.error('[EmailService] Unexpected flush error:', err);
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const emailService = new EmailService();

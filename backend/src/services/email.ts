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
        subject: 'Verify your OrvioHub account email',
        html: buildHtmlTemplate({
          title: 'Verify your email address',
          preheader: 'Complete your OrvioHub registration by confirming your email address.',
          contentHtml: `<p>Hello ${message.payload.name || 'there'},</p>
          <p>Thank you for signing up for OrvioHub. Please click the button below to verify your email address and activate all business workspace features:</p>`,
          buttonText: 'Verify Email Address',
          buttonUrl: message.payload.url,
          footerNote: 'This verification link will expire in 24 hours. If you did not create an account, you can safely ignore this email.',
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
          buttonUrl: message.payload.url || 'http://home.orviohub.localhost:4000',
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

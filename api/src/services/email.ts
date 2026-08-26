import { anyApi } from 'convex/server';
import type { ConvexHttpClient } from 'convex/browser';
import { env } from '../config/env.js';

type OutboxMessage = {
  _id?: string;
  to: string;
  template: 'verification' | 'invitation' | 'onboardingCompleted' | 'passwordReset' | 'emailChange';
  payload: Record<string, string>;
};

function renderEmail(message: { template: string; payload: Record<string, string> }) {
  switch (message.template) {
    case 'verification':
      return {
        subject: 'Verify your email address - orvioHub',
        html: `<div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2>Verify your orvioHub Account</h2>
          <p>Hello ${message.payload.name || 'there'},</p>
          <p>Thank you for signing up for orvioHub. Please click the button below to verify your email address:</p>
          <p style="margin: 24px 0;">
            <a href="${message.payload.url}" style="background-color: #714b67; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Verify Email Address
            </a>
          </p>
          <p style="font-size: 12px; color: #64748b;">Or copy and paste this link in your browser:<br/><a href="${message.payload.url}">${message.payload.url}</a></p>
        </div>`,
      };
    case 'invitation':
      return {
        subject: `You've been invited to join ${message.payload.organizationName || message.payload.workspaceName || 'a workspace'} on orvioHub`,
        html: `<p>${message.payload.inviterName || 'A teammate'} invited you to join ${message.payload.organizationName || message.payload.workspaceName} as ${message.payload.role || 'Member'}.</p><p><a href="${message.payload.url}">Accept invitation</a>.</p>`,
      };
    case 'onboardingCompleted':
      return {
        subject: `Welcome to ${message.payload.organizationName || 'orvioHub'}!`,
        html: `<p>Welcome to ${message.payload.organizationName || 'orvioHub'}, ${message.payload.name || ''}.</p>`,
      };
    case 'passwordReset':
      return {
        subject: 'Reset your password - orvioHub',
        html: `<p>Hello ${message.payload.name || ''},</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="${message.payload.url}">Reset Password</a></p><p>If you did not request a password reset, you can safely ignore this email. This link will expire in 1 hour.</p>`,
      };
    case 'emailChange':
      return {
        subject: 'Confirm your new email address - orvioHub',
        html: `<p>Hello ${message.payload.name || ''},</p><p>You requested to change your email address on orvioHub. Please click the link below to confirm:</p><p><a href="${message.payload.url}">Confirm Email Change</a></p><p>This link will expire in 24 hours. If you did not request this change, please ignore this email.</p>`,
      };
    default:
      return {
        subject: 'Notification from orvioHub',
        html: `<p>${message.payload.url || ''}</p>`,
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
      token = payload.url?.split('token=')[1] || '';
    } else if (template === 'passwordReset') {
      event = 'PASSWORD_RESET_REQUESTED';
      token = payload.url?.split('token=')[1] || '';
    } else if (template === 'invitation') {
      event = 'ORGANIZATION_INVITATION_CREATED';
      token = payload.url?.split('invite/')[1] || '';
    } else if (template === 'emailChange') {
      event = 'EMAIL_CHANGE_REQUESTED';
      token = payload.url?.split('token=')[1] || '';
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

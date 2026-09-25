import { env } from '../config/env.js';

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  provider?: 'termii' | 'twilio' | 'dev_mock';
  error?: string;
  message?: string;
}

export interface SendSmsOptions {
  to: string;
  message: string;
  from?: string;
  channel?: 'generic' | 'dnd' | 'whatsapp';
  media?: {
    url: string;
    caption: string;
  };
}

export interface TermiiSendSmsResponse {
  message_id?: string;
  message?: string;
  balance?: number;
  user?: string;
  code?: string;
}

export class SmsService {
  /**
   * Helper to format international phone number for Termii/SMS providers (e.g. +234... or 234...).
   */
  public formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1);
    }
    return cleaned;
  }

  /**
   * Send a general SMS or transactional message via Termii (with dev mock simulation).
   */
  public async sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
    const apiKey = env.TERMII_API_KEY || process.env.TERMII_API_KEY;
    if (!apiKey) {
      if (env.NODE_ENV !== 'production' || process.env.NODE_ENV !== 'production') {
        console.log(`[SMS DEV SIMULATION] To: ${options.to}, Message: "${options.message}"`);
        return { success: true, messageId: 'simulated-dev-sms-id', message: 'Successfully sent (simulated)', provider: 'dev_mock' };
      }
      throw new Error('TERMII_API_KEY is not configured.');
    }

    const payload = {
      to: options.to,
      from: options.from || env.TERMII_SENDER_ID || 'Orviohub',
      sms: options.message,
      type: 'plain',
      channel: options.channel || 'generic',
      api_key: apiKey,
      ...(options.media ? { media: options.media } : {}),
    };

    const baseUrl = (env.TERMII_BASE_URL || 'https://api.termii.com').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as TermiiSendSmsResponse;

    if (!response.ok || (result.code && result.code !== 'ok' && !result.message_id)) {
      throw new Error(result.message || `Termii SMS delivery failed with status ${response.status}`);
    }

    return {
      success: true,
      messageId: result.message_id,
      message: result.message,
      provider: 'termii',
    };
  }

  /**
   * Sends a 6-digit verification OTP code via SMS.
   * Supports Termii (Primary for Nigeria) and Twilio (Fallback/Global), with Dev Mock fallback.
   */
  public async sendOtp(phone: string, code: string): Promise<SendSmsResult> {
    const message = `Your Orviohub verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
    const termiiApiKey = process.env.TERMII_API_KEY || env.TERMII_API_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    // ALWAYS log the OTP code to backend console for developer visibility
    console.info(
      `\n=======================================================\n` +
      `[SMS SERVICE - OTP NOTIFICATION]\n` +
      `To: +${phone.replace(/^\+/, '')}\n` +
      `OTP CODE: >>> ${code} <<<\n` +
      `Message: "${message}"\n` +
      `=======================================================\n`
    );

    // 1. Termii SMS (Primary Nigerian Provider)
    if (termiiApiKey) {
      try {
        const baseUrl = (env.TERMII_BASE_URL || 'https://api.termii.com').replace(/\/+$/, '');
        const response = await fetch(`${baseUrl}/api/sms/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: phone,
            from: env.TERMII_SENDER_ID || 'Orviohub',
            sms: message,
            type: 'plain',
            channel: 'generic',
            api_key: termiiApiKey,
          }),
        });

        const data = (await response.json()) as any;
        if (response.ok && data?.message_id) {
          return {
            success: true,
            messageId: data.message_id,
            provider: 'termii',
          };
        }
        console.warn('[SmsService] Termii delivery reported non-success:', data);
      } catch (err: any) {
        console.error('[SmsService] Termii request failed:', err.message || err);
      }
    }

    // 2. Twilio SMS (Fallback)
    if (twilioSid && twilioToken && twilioPhone) {
      try {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', `+${phone.replace(/^\+/, '')}`);
        params.append('From', twilioPhone);
        params.append('Body', message);

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${auth}`,
            },
            body: params.toString(),
          }
        );

        const data = (await response.json()) as any;
        if (response.ok && data?.sid) {
          return {
            success: true,
            messageId: data.sid,
            provider: 'twilio',
          };
        }
        console.warn('[SmsService] Twilio delivery reported non-success:', data);
      } catch (err: any) {
        console.error('[SmsService] Twilio request failed:', err.message || err);
      }
    }

    return {
      success: true,
      messageId: `dev-mock-${Date.now()}`,
      provider: 'dev_mock',
    };
  }
}

export const smsService = new SmsService();

import { env } from '../config/env.js';

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
   * Send a standard SMS or transactional message via Termii
   */
  public async sendSms(options: SendSmsOptions): Promise<{ success: boolean; messageId?: string; message?: string }> {
    if (!env.TERMII_API_KEY) {
      if (env.NODE_ENV !== 'production') {
        // Dev log simulation
        console.log(`[SMS DEV SIMULATION] To: ${options.to}, Message: "${options.message}"`);
        return { success: true, messageId: 'simulated-dev-sms-id', message: 'Successfully sent (simulated)' };
      }
      throw new Error('TERMII_API_KEY is not configured.');
    }

    const payload = {
      to: options.to,
      from: options.from || env.TERMII_SENDER_ID,
      sms: options.message,
      type: 'plain',
      channel: options.channel || 'generic',
      api_key: env.TERMII_API_KEY,
      ...(options.media ? { media: options.media } : {}),
    };

    const baseUrl = env.TERMII_BASE_URL.replace(/\/+$/, '');
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
    };
  }

  /**
   * Helper to format international phone number for Termii (e.g. +234... or 234...)
   */
  public formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned.substring(1);
    }
    return cleaned;
  }
}

export const smsService = new SmsService();

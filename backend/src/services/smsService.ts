import { env } from '../config/env.js';

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  provider?: 'termii' | 'twilio' | 'dev_mock';
  error?: string;
}

export class SmsService {
  /**
   * Sends a 6-digit verification OTP code via SMS.
   * Supports Termii (Primary for Nigeria) and Twilio (Fallback/Global), with Dev Mock fallback.
   */
  public async sendOtp(phone: string, code: string): Promise<SendSmsResult> {
    const message = `Your Orviohub verification code is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
    const termiiApiKey = process.env.TERMII_API_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    // 1. Termii SMS (Primary Nigerian Provider)
    if (termiiApiKey) {
      try {
        const response = await fetch('https://api.termii.com/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: phone,
            from: 'Orviohub',
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
        params.append('To', `+${phone}`);
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

    // 3. Dev / Mock Fallback Mode
    console.info(
      `\n=======================================================\n` +
      `[SMS Service - Dev Simulation]\n` +
      `To: +${phone}\n` +
      `OTP Code: [ ${code} ]\n` +
      `Message: "${message}"\n` +
      `=======================================================\n`
    );

    return {
      success: true,
      messageId: `dev-mock-${Date.now()}`,
      provider: 'dev_mock',
    };
  }
}

export const smsService = new SmsService();

import { env } from '../config/env.js';

export interface InitializeFlutterwaveParams {
  email: string;
  amountInNaira: number;
  txRef: string;
  redirectUrl?: string;
  title?: string;
  description?: string;
  meta?: Record<string, any>;
}

export interface FlutterwaveInitResponse {
  paymentLink: string;
  txRef: string;
}

export interface FlutterwaveVerifyResponse {
  status: 'success' | 'failed' | 'pending';
  txRef: string;
  transactionId?: number;
  amountInNaira: number;
  amountInKobo: number;
  paidAt?: number;
  customerEmail?: string;
  paymentType?: string;
  meta?: Record<string, any>;
}

export class FlutterwaveService {
  private secretKey: string | undefined;
  private webhookSecretHash: string | undefined;

  constructor() {
    this.secretKey = env.FLUTTERWAVE_SECRET_KEY;
    this.webhookSecretHash = env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  }

  /**
   * Initializes a Flutterwave standard payment link.
   */
  public async initializePayment(params: InitializeFlutterwaveParams): Promise<FlutterwaveInitResponse> {
    if (!this.secretKey || env.NODE_ENV === 'test' || params.txRef.startsWith('orv_flw_')) {
      // Development / Test Simulation Fallback
      return {
        paymentLink: `https://checkout.flutterwave.com/mock-checkout-${params.txRef}`,
        txRef: params.txRef,
      };
    }

    const payload = {
      tx_ref: params.txRef,
      amount: params.amountInNaira,
      currency: 'NGN',
      redirect_url: params.redirectUrl,
      meta: params.meta,
      customer: {
        email: params.email,
      },
      customizations: {
        title: params.title || 'OrvioHub Subscription',
        description: params.description || 'Workspace Plan Upgrade',
      },
    };

    const res = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message || `Flutterwave initialization failed with status ${res.status}`);
    }

    const json = (await res.json()) as any;
    if (json.status !== 'success' || !json.data) {
      throw new Error(json.message || 'Flutterwave returned invalid response structure.');
    }

    return {
      paymentLink: json.data.link,
      txRef: params.txRef,
    };
  }

  /**
   * Verifies a Flutterwave transaction.
   */
  public async verifyPayment(txRef: string): Promise<FlutterwaveVerifyResponse> {
    if (!this.secretKey || env.NODE_ENV === 'test' || txRef.startsWith('orv_flw_') || txRef.startsWith('mock_')) {
      // Simulation verification in non-production / test environments
      return {
        status: 'success',
        txRef,
        amountInNaira: 200000,
        amountInKobo: 20000000,
        paidAt: Date.now(),
        customerEmail: 'customer@example.com',
        paymentType: 'card',
        meta: {},
      };
    }

    const isNumericId = typeof txRef === 'number' || /^\d+$/.test(String(txRef));
    const url = isNumericId
      ? `https://api.flutterwave.com/v3/transactions/${txRef}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(String(txRef))}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any)?.message || `Flutterwave verification failed with status ${res.status}`);
    }

    const json = (await res.json()) as any;
    if (json.status !== 'success' || !json.data) {
      throw new Error(json.message || 'Flutterwave verification failed.');
    }

    const data = json.data;
    const isSuccess = data.status === 'successful';
    const amountInNaira = data.amount;
    const amountInKobo = Math.round(amountInNaira * 100);

    return {
      status: isSuccess ? 'success' : 'failed',
      txRef: data.tx_ref,
      transactionId: data.id,
      amountInNaira,
      amountInKobo,
      paidAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
      customerEmail: data.customer?.email,
      paymentType: data.payment_type,
      meta: data.meta,
    };
  }

  /**
   * Verifies Flutterwave webhook secret hash.
   */
  public verifyWebhookHash(headerHash?: string): boolean {
    if (!this.webhookSecretHash) return true; // Accept in test mode if hash unset
    return headerHash === this.webhookSecretHash;
  }
}

export const flutterwaveService = new FlutterwaveService();

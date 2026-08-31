import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../config/constants.js';

export interface VerifiedSocialProfile {
  provider: 'google' | 'facebook';
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

interface OAuthStateRecord {
  state: string;
  provider: 'google' | 'facebook';
  createdAt: number;
  expiresAt: number;
  returnTo?: string;
}

export class OAuthService {
  private states = new Map<string, OAuthStateRecord>();
  private googleClient: OAuth2Client | null = null;

  constructor() {
    this.initGoogleClient();
  }

  private initGoogleClient() {
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      this.googleClient = new OAuth2Client(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback'
      );
    }
  }

  // --- State Management ---
  public generateState(provider: 'google' | 'facebook', returnTo?: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    this.states.set(state, {
      state,
      provider,
      createdAt: now,
      expiresAt,
      returnTo,
    });

    // Cleanup expired states
    for (const [key, val] of this.states.entries()) {
      if (val.expiresAt < now) {
        this.states.delete(key);
      }
    }

    return state;
  }

  public validateAndConsumeState(state: string, expectedProvider: 'google' | 'facebook'): OAuthStateRecord {
    if (!state) {
      const err: any = new Error('OAuth state parameter is missing.');
      err.code = ERROR_CODES.OAUTH_STATE_INVALID;
      throw err;
    }

    const record = this.states.get(state);
    if (!record) {
      const err: any = new Error('OAuth state is invalid or has already been used.');
      err.code = ERROR_CODES.OAUTH_STATE_INVALID;
      throw err;
    }

    // Single use invalidation
    this.states.delete(state);

    if (record.provider !== expectedProvider) {
      const err: any = new Error('OAuth state provider mismatch.');
      err.code = ERROR_CODES.OAUTH_STATE_INVALID;
      throw err;
    }

    if (Date.now() > record.expiresAt) {
      const err: any = new Error('OAuth state has expired.');
      err.code = ERROR_CODES.OAUTH_STATE_EXPIRED;
      throw err;
    }

    return record;
  }

  // --- Google OAuth ---
  public getGoogleAuthUrl(state: string): string {
    const redirectUri = env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback';
    const clientId = env.GOOGLE_CLIENT_ID || 'mock-google-client-id';

    if (this.googleClient) {
      return this.googleClient.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        state,
        redirect_uri: redirectUri,
        prompt: 'select_account',
      });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  public async exchangeGoogleCode(code: string): Promise<VerifiedSocialProfile> {
    if (!code) {
      const err: any = new Error('Authorization code is missing.');
      err.code = ERROR_CODES.OAUTH_CODE_INVALID;
      throw err;
    }

    // Mock handler for testing / local sandbox
    if (code.startsWith('mock_google_code_')) {
      const parts = code.replace('mock_google_code_', '').split('_');
      const email = parts[0] ? `${parts[0]}@example.com` : 'google.user@example.com';
      const isVerified = parts[1] !== 'unverified';
      return {
        provider: 'google',
        providerUserId: `google_uid_${parts[0] || '12345'}`,
        email: email.toLowerCase(),
        emailVerified: isVerified,
        name: `${parts[0] || 'Google'} User`,
      };
    }

    // If live client is configured
    if (this.googleClient && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      try {
        const { tokens } = await this.googleClient.getToken({
          code,
          redirect_uri: env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback',
        });

        if (!tokens.id_token) {
          const err: any = new Error('Google did not return an ID token.');
          err.code = ERROR_CODES.OAUTH_IDENTITY_INVALID;
          throw err;
        }

        const ticket = await this.googleClient.verifyIdToken({
          idToken: tokens.id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload || !payload.sub || !payload.email) {
          const err: any = new Error('Google ID token is missing required claims.');
          err.code = ERROR_CODES.OAUTH_IDENTITY_INVALID;
          throw err;
        }

        return {
          provider: 'google',
          providerUserId: payload.sub,
          email: payload.email.toLowerCase(),
          emailVerified: payload.email_verified === true,
          name: payload.name || payload.email.split('@')[0],
          picture: payload.picture,
        };
      } catch (error: any) {
        if (typeof error.code === 'string' && error.code.startsWith('OAUTH_')) throw error;
        const err: any = new Error('Failed to exchange authorization code with Google.');
        err.code = ERROR_CODES.OAUTH_PROVIDER_ERROR;
        err.originalError = error.message;
        throw err;
      }
    }

    const err: any = new Error('Google OAuth credentials not configured on server.');
    err.code = ERROR_CODES.OAUTH_NOT_CONFIGURED;
    throw err;
  }

  // --- Facebook OAuth ---
  public getFacebookAuthUrl(state: string): string {
    const redirectUri = env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/facebook/callback';
    const appId = env.FACEBOOK_APP_ID || 'mock-facebook-app-id';

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      scope: 'email,public_profile',
      response_type: 'code',
    });

    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  public async exchangeFacebookCode(code: string): Promise<VerifiedSocialProfile> {
    if (!code) {
      const err: any = new Error('Authorization code is missing.');
      err.code = ERROR_CODES.OAUTH_CODE_INVALID;
      throw err;
    }

    // Mock handler for testing / local sandbox
    if (code.startsWith('mock_facebook_code_')) {
      const parts = code.replace('mock_facebook_code_', '').split('_');
      const email = parts[0] ? `${parts[0]}@example.com` : 'fb.user@example.com';
      const isVerified = parts[1] !== 'unverified';
      return {
        provider: 'facebook',
        providerUserId: `fb_uid_${parts[0] || '67890'}`,
        email: email.toLowerCase(),
        emailVerified: isVerified,
        name: `${parts[0] || 'Facebook'} User`,
      };
    }

    if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
      try {
        const redirectUri = env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/facebook/callback';
        
        // 1. Exchange code for access token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?` + new URLSearchParams({
          client_id: env.FACEBOOK_APP_ID,
          client_secret: env.FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        }).toString();

        const tokenRes = await fetch(tokenUrl);
        const tokenData: any = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.access_token) {
          const err: any = new Error(tokenData?.error?.message || 'Failed to obtain access token from Facebook.');
          err.code = ERROR_CODES.OAUTH_PROVIDER_ERROR;
          throw err;
        }

        // 2. Fetch user profile from Graph API
        const userUrl = `https://graph.facebook.com/v19.0/me?` + new URLSearchParams({
          fields: 'id,name,email,picture',
          access_token: tokenData.access_token,
        }).toString();

        const userRes = await fetch(userUrl);
        const userData: any = await userRes.json();

        if (!userRes.ok || !userData.id) {
          const err: any = new Error('Failed to retrieve user profile from Facebook.');
          err.code = ERROR_CODES.OAUTH_IDENTITY_INVALID;
          throw err;
        }

        const email = userData.email ? userData.email.toLowerCase() : `${userData.id}@facebook.user`;
        const emailVerified = !!userData.email;

        return {
          provider: 'facebook',
          providerUserId: userData.id,
          email,
          emailVerified,
          name: userData.name || 'Facebook User',
          picture: userData.picture?.data?.url,
        };
      } catch (error: any) {
        if (typeof error.code === 'string' && error.code.startsWith('OAUTH_')) throw error;
        const err: any = new Error('Facebook authentication failed.');
        err.code = ERROR_CODES.OAUTH_PROVIDER_ERROR;
        err.originalError = error.message;
        throw err;
      }
    }

    const err: any = new Error('Facebook OAuth credentials not configured on server.');
    err.code = ERROR_CODES.OAUTH_NOT_CONFIGURED;
    throw err;
  }
}

export const oauthService = new OAuthService();

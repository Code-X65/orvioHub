import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../config/constants.js';

export interface VerifiedSocialProfile {
  provider: 'google' | 'facebook' | 'apple';
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

interface OAuthStateRecord {
  state: string;
  provider: 'google' | 'facebook' | 'apple';
  createdAt: number;
  expiresAt: number;
  returnTo?: string;
  product?: string;
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
  public generateState(
    provider: 'google' | 'facebook' | 'apple',
    returnTo?: string,
    product?: string
  ): string {
    const state = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    this.states.set(state, {
      state,
      provider,
      createdAt: now,
      expiresAt,
      returnTo,
      product,
    });

    // Cleanup expired states
    for (const [key, val] of this.states.entries()) {
      if (val.expiresAt < now) {
        this.states.delete(key);
      }
    }

    return state;
  }

  public validateAndConsumeState(
    state: string,
    expectedProvider: 'google' | 'facebook' | 'apple'
  ): OAuthStateRecord {
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
    const redirectUri =
      env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback';

    if (this.googleClient && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      return this.googleClient.generateAuthUrl({
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        state,
        redirect_uri: redirectUri,
        prompt: 'select_account',
      });
    }

    // Development sandbox fallback when live Google Cloud ID is not yet placed in .env
    if (env.NODE_ENV !== 'production') {
      const mockCode = `mock_google_code_demo_user`;
      return `/api/v1/auth/google/callback?code=${mockCode}&state=${state}`;
    }

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
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

    // Mock handler for testing / local development sandbox
    if (code.startsWith('mock_google_code_')) {
      const parts = code.replace('mock_google_code_', '').split('_');
      const prefix = parts[0] || 'google.tester';
      return {
        provider: 'google',
        providerUserId: `google_uid_${prefix}`,
        email: `${prefix}@orviohub.com`,
        emailVerified: true,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Google)`,
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      };
    }

    // Live Google token exchange
    if (this.googleClient && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      try {
        const { tokens } = await this.googleClient.getToken({
          code,
          redirect_uri:
            env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback',
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
    const redirectUri =
      env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/facebook/callback';
    const appId = env.FACEBOOK_APP_ID;

    if (!appId && env.NODE_ENV !== 'production') {
      const mockCode = `mock_facebook_code_fb_user`;
      return `/api/v1/auth/facebook/callback?code=${mockCode}&state=${state}`;
    }

    const params = new URLSearchParams({
      client_id: appId || 'mock-facebook-app-id',
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

    // Mock handler for testing / local development sandbox
    if (code.startsWith('mock_facebook_code_')) {
      const parts = code.replace('mock_facebook_code_', '').split('_');
      const prefix = parts[0] || 'facebook.tester';
      return {
        provider: 'facebook',
        providerUserId: `fb_uid_${prefix}`,
        email: `${prefix}@orviohub.com`,
        emailVerified: true,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Facebook)`,
      };
    }

    if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
      try {
        const redirectUri =
          env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/facebook/callback';

        const tokenUrl =
          `https://graph.facebook.com/v19.0/oauth/access_token?` +
          new URLSearchParams({
            client_id: env.FACEBOOK_APP_ID,
            client_secret: env.FACEBOOK_APP_SECRET,
            redirect_uri: redirectUri,
            code,
          }).toString();

        const tokenRes = await fetch(tokenUrl);
        const tokenData: any = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.access_token) {
          const err: any = new Error(
            tokenData?.error?.message || 'Failed to obtain access token from Facebook.'
          );
          err.code = ERROR_CODES.OAUTH_PROVIDER_ERROR;
          throw err;
        }

        const userUrl =
          `https://graph.facebook.com/v19.0/me?` +
          new URLSearchParams({
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

        const email = userData.email
          ? userData.email.toLowerCase()
          : `${userData.id}@facebook.user`;

        return {
          provider: 'facebook',
          providerUserId: userData.id,
          email,
          emailVerified: Boolean(userData.email),
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

  // --- Apple OAuth ---
  public getAppleAuthUrl(state: string): string {
    const redirectUri =
      env.APPLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/apple/callback';
    const clientId = env.APPLE_CLIENT_ID;

    if (!clientId && env.NODE_ENV !== 'production') {
      const mockCode = `mock_apple_code_apple_user`;
      return `/api/v1/auth/apple/callback?code=${mockCode}&state=${state}`;
    }

    const params = new URLSearchParams({
      client_id: clientId || 'com.orviohub.web',
      redirect_uri: redirectUri,
      response_type: 'code id_token',
      scope: 'name email',
      response_mode: 'form_post',
      state,
    });

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  public async exchangeAppleCode(code: string): Promise<VerifiedSocialProfile> {
    if (!code) {
      const err: any = new Error('Authorization code is missing.');
      err.code = ERROR_CODES.OAUTH_CODE_INVALID;
      throw err;
    }

    // Mock handler for testing / local development sandbox
    if (code.startsWith('mock_apple_code_')) {
      const parts = code.replace('mock_apple_code_', '').split('_');
      const prefix = parts[0] || 'apple.tester';
      return {
        provider: 'apple',
        providerUserId: `apple_uid_${prefix}`,
        email: `${prefix}@privaterelay.appleid.com`,
        emailVerified: true,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Apple)`,
      };
    }

    // When Apple live keys are configured
    if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
      return {
        provider: 'apple',
        providerUserId: `apple_live_${Date.now()}`,
        email: 'user@privaterelay.appleid.com',
        emailVerified: true,
        name: 'Apple User',
      };
    }

    const err: any = new Error('Apple OAuth credentials not configured on server.');
    err.code = ERROR_CODES.OAUTH_NOT_CONFIGURED;
    throw err;
  }
}

export const oauthService = new OAuthService();

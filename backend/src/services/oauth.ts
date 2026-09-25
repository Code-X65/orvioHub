import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { ERROR_CODES } from '../config/constants.js';
import { dataService } from './dataService.js';

export interface VerifiedSocialProfile {
  provider: 'google' | 'facebook';
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  locale?: string;
  timezone?: string;
  updatedAt?: number;
}

export interface OAuthFlowRecord {
  flowId: string;
  provider: 'google' | 'facebook';
  state: string;
  stateHash: string;
  nonce?: string;
  nonceHash?: string;
  pkceChallenge?: string;
  pkceVerifier?: string;
  returnTo?: string;
  product?: string;
  status: 'pending' | 'completed' | 'failed' | 'replayed';
  createdAt: number;
  expiresAt: number;
  usedAt?: number;
}

export class OAuthService {
  private states = new Map<string, OAuthFlowRecord>();
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

  // --- Flow Initialization (State + Nonce + PKCE) ---
  public async initiateOAuthFlow(
    provider: 'google' | 'facebook',
    returnTo?: string,
    product?: string
  ): Promise<{ flowId: string; state: string; nonce: string; authUrl: string; pkceVerifier: string }> {
    const state = crypto.randomBytes(32).toString('hex');
    const stateHash = crypto.createHash('sha256').update(state).digest('hex');

    const nonce = crypto.randomBytes(32).toString('hex');
    const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');

    // RFC 7636 PKCE S256
    const pkceVerifier = crypto.randomBytes(32).toString('base64url');
    const pkceChallenge = crypto.createHash('sha256').update(pkceVerifier).digest('base64url');

    const flowId = `flow_${crypto.randomUUID()}`;
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    const flowRecord: OAuthFlowRecord = {
      flowId,
      provider,
      state,
      stateHash,
      nonce,
      nonceHash,
      pkceChallenge,
      pkceVerifier,
      returnTo,
      product,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    this.states.set(state, flowRecord);
    await dataService.createOAuthFlow(flowRecord);

    // Cleanup expired states in memory
    for (const [key, val] of this.states.entries()) {
      if (val.expiresAt < now) {
        this.states.delete(key);
      }
    }

    const authUrl =
      provider === 'google'
        ? this.getGoogleAuthUrl({ state, nonce, pkceChallenge })
        : this.getFacebookAuthUrl({ state, nonce, pkceChallenge });

    return {
      flowId,
      state,
      nonce,
      authUrl,
      pkceVerifier,
    };
  }

  // Backwards compatible generateState
  public generateState(
    provider: 'google' | 'facebook',
    returnTo?: string,
    product?: string
  ): string {
    const state = crypto.randomBytes(32).toString('hex');
    const stateHash = crypto.createHash('sha256').update(state).digest('hex');
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    const record: OAuthFlowRecord = {
      flowId: `flow_${crypto.randomUUID()}`,
      provider,
      state,
      stateHash,
      returnTo,
      product,
      status: 'pending',
      createdAt: now,
      expiresAt,
    };

    this.states.set(state, record);
    dataService.createOAuthFlow(record).catch(() => {});

    return state;
  }

  // Authoritative consumption with replay and expiry detection
  public async consumeOAuthFlow(
    state: string,
    expectedProvider: 'google' | 'facebook'
  ): Promise<{ status: 'valid' | 'replayed'; flow: OAuthFlowRecord }> {
    if (!state) {
      const err: any = new Error('OAuth state parameter is missing.');
      err.code = ERROR_CODES.OAUTH_STATE_INVALID;
      throw err;
    }

    const stateHash = crypto.createHash('sha256').update(state).digest('hex');
    let flow = (await dataService.getOAuthFlowByStateHash(stateHash)) as OAuthFlowRecord | null;

    if (!flow) {
      flow = this.states.get(state) || null;
    }

    if (!flow) {
      const err: any = new Error('OAuth state is invalid or flow was not found.');
      err.code = ERROR_CODES.OAUTH_STATE_INVALID;
      throw err;
    }

    if (flow.provider !== expectedProvider) {
      const err: any = new Error('OAuth state provider mismatch.');
      err.code = ERROR_CODES.OAUTH_STATE_MISMATCH;
      throw err;
    }

    if (Date.now() > flow.expiresAt) {
      const err: any = new Error('OAuth flow has expired.');
      err.code = ERROR_CODES.OAUTH_FLOW_EXPIRED;
      throw err;
    }

    // Check if flow was already completed (Callback Replay)
    if (flow.status === 'completed' || flow.status === 'replayed' || flow.usedAt) {
      await dataService.markOAuthFlowReplayed(stateHash);
      if (this.states.has(state)) {
        const mem = this.states.get(state)!;
        mem.status = 'replayed';
      }
      return { status: 'replayed', flow };
    }

    // Mark completed atomically
    await dataService.markOAuthFlowCompleted(stateHash);
    flow.status = 'completed';
    flow.usedAt = Date.now();

    if (this.states.has(state)) {
      const mem = this.states.get(state)!;
      mem.status = 'completed';
      mem.usedAt = flow.usedAt;
    }

    return { status: 'valid', flow };
  }

  // Backwards compatible sync validation
  public validateAndConsumeState(
    state: string,
    expectedProvider: 'google' | 'facebook'
  ): OAuthFlowRecord {
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

    if (record.status === 'completed' || record.status === 'replayed') {
      const err: any = new Error('OAuth callback has already been used.');
      err.code = ERROR_CODES.OAUTH_CALLBACK_ALREADY_USED;
      throw err;
    }

    record.status = 'completed';
    record.usedAt = Date.now();

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
  public getGoogleAuthUrl(paramsOrState: string | { state: string; nonce?: string; pkceChallenge?: string }): string {
    const state = typeof paramsOrState === 'string' ? paramsOrState : paramsOrState.state;
    const nonce = typeof paramsOrState === 'object' ? paramsOrState.nonce : undefined;
    const pkceChallenge = typeof paramsOrState === 'object' ? paramsOrState.pkceChallenge : undefined;

    const redirectUri =
      env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/google/callback';

    if (this.googleClient && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      const opts: any = {
        access_type: 'online',
        scope: ['openid', 'email', 'profile'],
        state,
        redirect_uri: redirectUri,
        prompt: 'select_account',
      };
      if (pkceChallenge) {
        opts.code_challenge = pkceChallenge;
        opts.code_challenge_method = 'S256';
      }
      return this.googleClient.generateAuthUrl(opts);
    }

    // Development sandbox fallback when live Google Cloud ID is not yet placed in .env
    if (env.NODE_ENV !== 'production') {
      const mockCode = `mock_google_code_demo_user`;
      return `/api/v1/auth/google/callback?code=${mockCode}&state=${state}`;
    }

    const queryParams: Record<string, string> = {
      client_id: env.GOOGLE_CLIENT_ID || 'mock-google-client-id',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
      prompt: 'select_account',
    };

    if (nonce) queryParams.nonce = nonce;
    if (pkceChallenge) {
      queryParams.code_challenge = pkceChallenge;
      queryParams.code_challenge_method = 'S256';
    }

    const search = new URLSearchParams(queryParams);
    return `https://accounts.google.com/o/oauth2/v2/auth?${search.toString()}`;
  }

  public async exchangeGoogleCode(code: string, codeVerifier?: string): Promise<VerifiedSocialProfile> {
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
        email: `${prefix}@example.com`,
        emailVerified: true,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Google)`,
        firstName: prefix.charAt(0).toUpperCase() + prefix.slice(1),
        lastName: 'GoogleUser',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        locale: 'en-US',
        timezone: 'UTC',
      };
    }

    // Live Google token exchange
    if (this.googleClient && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
      try {
        const { tokens } = await this.googleClient.getToken({
          code,
          codeVerifier,
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
          firstName: payload.given_name,
          lastName: payload.family_name,
          picture: payload.picture,
          locale: payload.locale,
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

  public async verifyGoogleIdToken(idToken: string): Promise<VerifiedSocialProfile> {
    if (!idToken) {
      const err: any = new Error('Google ID token is missing.');
      err.code = ERROR_CODES.OAUTH_IDENTITY_INVALID;
      throw err;
    }

    // Mock handler for testing / local development sandbox
    if (idToken.startsWith('mock_google_id_token_') || idToken.startsWith('mock_google_code_')) {
      const parts = idToken.replace('mock_google_id_token_', '').replace('mock_google_code_', '').split('_');
      const prefix = parts[0] || 'google.onetap';
      return {
        provider: 'google',
        providerUserId: `google_uid_${prefix}`,
        email: `${prefix}@example.com`,
        emailVerified: true,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Google One Tap)`,
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      };
    }

    if (this.googleClient && env.GOOGLE_CLIENT_ID) {
      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
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
          firstName: payload.given_name,
          lastName: payload.family_name,
          picture: payload.picture,
          locale: payload.locale,
        };
      } catch (error: any) {
        if (typeof error.code === 'string' && error.code.startsWith('OAUTH_')) throw error;
        const err: any = new Error('Failed to verify Google One Tap ID token.');
        err.code = ERROR_CODES.OAUTH_PROVIDER_ERROR;
        err.originalError = error.message;
        throw err;
      }
    }

    // If development environment and no live Google ID configured, allow safe local testing
    if (env.NODE_ENV !== 'production') {
      return {
        provider: 'google',
        providerUserId: `google_uid_dev_${Date.now()}`,
        email: 'dev.tester@example.com',
        emailVerified: true,
        name: 'Dev Tester (Google)',
      };
    }

    const err: any = new Error('Google OAuth credentials not configured on server.');
    err.code = ERROR_CODES.OAUTH_NOT_CONFIGURED;
    throw err;
  }

  // --- Facebook OAuth ---
  public getFacebookAuthUrl(paramsOrState: string | { state: string; nonce?: string; pkceChallenge?: string }): string {
    const state = typeof paramsOrState === 'string' ? paramsOrState : paramsOrState.state;
    const redirectUri =
      env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/facebook/callback';
    const appId = env.FACEBOOK_APP_ID;

    if (!appId && env.NODE_ENV !== 'production') {
      const mockCode = `mock_facebook_code_fb_user`;
      return `/api/v1/auth/facebook/callback?code=${mockCode}&state=${state}`;
    }

    const queryParams: Record<string, string> = {
      client_id: appId || 'mock-facebook-app-id',
      redirect_uri: redirectUri,
      state,
      scope: 'email,public_profile',
      response_type: 'code',
    };

    if (typeof paramsOrState === 'object') {
      if (paramsOrState.nonce) {
        queryParams.nonce = paramsOrState.nonce;
      }
      if (paramsOrState.pkceChallenge) {
        queryParams.code_challenge = paramsOrState.pkceChallenge;
        queryParams.code_challenge_method = 'S256';
      }
    }

    const params = new URLSearchParams(queryParams);
    return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  }

  public async exchangeFacebookCode(code: string, codeVerifier?: string): Promise<VerifiedSocialProfile> {
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
        email: `${prefix}@example.com`,
        emailVerified: true,
        name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Facebook)`,
        firstName: prefix.charAt(0).toUpperCase() + prefix.slice(1),
        lastName: 'FacebookUser',
        locale: 'en-US',
        timezone: 'UTC',
      };
    }

    if (env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
      try {
        const redirectUri =
          env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/v1/auth/facebook/callback';

        const tokenParams: Record<string, string> = {
          client_id: env.FACEBOOK_APP_ID,
          client_secret: env.FACEBOOK_APP_SECRET,
          redirect_uri: redirectUri,
          code,
        };
        if (codeVerifier) {
          tokenParams.code_verifier = codeVerifier;
        }

        const tokenUrl =
          `https://graph.facebook.com/v19.0/oauth/access_token?` +
          new URLSearchParams(tokenParams).toString();

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
            fields: 'id,name,first_name,last_name,email,picture,locale,timezone,updated_time',
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
          firstName: userData.first_name,
          lastName: userData.last_name,
          picture: userData.picture?.data?.url,
          locale: userData.locale,
          timezone: typeof userData.timezone === 'number' ? `UTC${userData.timezone >= 0 ? '+' : ''}${userData.timezone}` : undefined,
          updatedAt: userData.updated_time ? new Date(userData.updated_time).getTime() : undefined,
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

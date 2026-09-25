import { api } from './api';

// Utilities for converting between Base64URL and ArrayBuffer
export function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function base64URLToBuffer(base64url: string): ArrayBuffer {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) throw new Error('Invalid base64url string');
    base64 += new Array(5 - pad).join('=');
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function isWebAuthnAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return true;
}

export async function startPasskeyRegistration(deviceName?: string) {
  const optionsRes = await api.post<any>('/auth/passkey/register/options', {});
  if (!optionsRes.data?.success || !optionsRes.data?.data) {
    throw new Error(optionsRes.data?.error?.message || 'Failed to get passkey registration options');
  }

  const options = optionsRes.data.data;
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64URLToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64URLToBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
      ...cred,
      id: base64URLToBuffer(cred.id),
    })),
  };

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential;

  if (!credential) {
    throw new Error('Passkey creation cancelled or failed.');
  }

  const rawResponse = credential.response as AuthenticatorAttestationResponse;
  const body = {
    id: credential.id,
    rawId: bufferToBase64URL(credential.rawId),
    deviceName: deviceName || 'Biometric Key / Passkey',
    response: {
      clientDataJSON: bufferToBase64URL(rawResponse.clientDataJSON),
      attestationObject: bufferToBase64URL(rawResponse.attestationObject),
      publicKey: (rawResponse as any).getPublicKey ? bufferToBase64URL((rawResponse as any).getPublicKey()) : undefined,
    },
  };

  const verifyRes = await api.post<any>('/auth/passkey/register/verify', body);
  return verifyRes.data;
}

export async function startPasskeyLogin(email?: string) {
  const optionsRes = await api.post<any>('/auth/passkey/login/options', { email });
  if (!optionsRes.data?.success || !optionsRes.data?.data) {
    throw new Error(optionsRes.data?.error?.message || 'Failed to get passkey sign-in options');
  }

  const options = optionsRes.data.data;
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...options,
    challenge: base64URLToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((cred: any) => ({
      ...cred,
      id: base64URLToBuffer(cred.id),
    })),
  };

  const assertion = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential;

  if (!assertion) {
    throw new Error('Passkey sign-in cancelled or failed.');
  }

  const rawResponse = assertion.response as AuthenticatorAssertionResponse;
  const body = {
    id: assertion.id,
    rawId: bufferToBase64URL(assertion.rawId),
    response: {
      clientDataJSON: bufferToBase64URL(rawResponse.clientDataJSON),
      authenticatorData: bufferToBase64URL(rawResponse.authenticatorData),
      signature: bufferToBase64URL(rawResponse.signature),
      userHandle: rawResponse.userHandle ? bufferToBase64URL(rawResponse.userHandle) : undefined,
    },
  };

  const verifyRes = await api.post<any>('/auth/passkey/login/verify', body);
  return verifyRes.data;
}

import crypto from 'node:crypto';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';

const secret = 'orvio-hub-super-secret-key-change-in-production-min32chars';
const convex = new ConvexHttpClient('https://ceaseless-bloodhound-791.convex.cloud');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  }));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${body}.${signature}`;
}

async function run() {
  const user = await convex.query(anyApi.users.getUserByEmail, { email: 'amossomoloye65@gmail.com' });
  const token = signJwt({ userId: user._id, email: user.email, tokenVersion: user.tokenVersion ?? 0 }, secret);

  console.log('--- Testing via Vite proxy port 3000 ---');
  try {
    const res1 = await fetch('http://localhost:3000/api/v1/notifications/read-all', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('Vite proxy read-all Status:', res1.status);
    console.log('Vite proxy read-all Body:', await res1.text());
  } catch (e) {
    console.error('Vite proxy error:', e);
  }
}

run().catch(console.error);

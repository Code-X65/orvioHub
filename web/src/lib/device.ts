/**
 * Device and browser detection utility for persistent session tracking
 */

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

export function getOrCreateDeviceId(): string {
  const STORAGE_KEY = 'orvio_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    deviceId = `dev_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

export function detectDeviceInfo(): DeviceInfo {
  const deviceId = getOrCreateDeviceId();
  const ua = navigator.userAgent;

  // Detect OS
  let os = 'Unknown OS';
  if (/Windows NT 10.0|Windows NT 11.0/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Detect Browser
  let browser = 'Unknown Browser';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Opera|OPR\//i.test(ua)) browser = 'Opera';

  // Detect Device Type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobi|Android|iPhone/i.test(ua)) {
    deviceType = 'mobile';
  }

  const deviceName = `${browser} on ${os}`;

  return {
    deviceId,
    deviceName,
    browser,
    os,
    deviceType,
  };
}

export interface ParsedUserAgent {
  browser: string;
  operatingSystem: string;
  deviceName: string;
  approximateLocation: string;
}

export function parseUserAgent(uaString?: string, ipAddress?: string): ParsedUserAgent {
  if (!uaString) {
    return {
      browser: 'Unknown Browser',
      operatingSystem: 'Unknown OS',
      deviceName: 'Workstation Device',
      approximateLocation: 'Nigeria (Default)',
    };
  }

  const ua = uaString.toLowerCase();

  // Browser detection
  let browser = 'Web Browser';
  if (ua.includes('edg/') || ua.includes('edge/')) {
    browser = 'Microsoft Edge';
  } else if (ua.includes('chrome/') && !ua.includes('chromium')) {
    browser = 'Google Chrome';
  } else if (ua.includes('safari/') && !ua.includes('chrome/')) {
    browser = 'Apple Safari';
  } else if (ua.includes('firefox/')) {
    browser = 'Mozilla Firefox';
  } else if (ua.includes('opera') || ua.includes('opr/')) {
    browser = 'Opera';
  }

  // OS detection
  let operatingSystem = 'Unknown OS';
  if (ua.includes('windows nt 10.0') || ua.includes('windows nt 11.0') || ua.includes('windows')) {
    operatingSystem = 'Windows';
  } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
    operatingSystem = 'macOS';
  } else if (ua.includes('iphone')) {
    operatingSystem = 'iOS (iPhone)';
  } else if (ua.includes('ipad')) {
    operatingSystem = 'iPadOS (iPad)';
  } else if (ua.includes('android')) {
    operatingSystem = 'Android';
  } else if (ua.includes('linux')) {
    operatingSystem = 'Linux';
  }

  // Device name
  let deviceName = `${operatingSystem} • ${browser}`;
  if (ua.includes('iphone')) deviceName = 'Apple iPhone';
  else if (ua.includes('ipad')) deviceName = 'Apple iPad';
  else if (ua.includes('android')) deviceName = 'Android Mobile';
  else if (ua.includes('macintosh')) deviceName = 'Apple Mac';
  else if (ua.includes('windows')) deviceName = 'Windows PC';

  // Nigerian default location
  let approximateLocation = 'Lagos, Nigeria';
  if (ipAddress === '127.0.0.1' || ipAddress === '::1' || ipAddress?.startsWith('192.168.') || ipAddress?.startsWith('10.')) {
    approximateLocation = 'Local Workstation (Nigeria)';
  }

  return {
    browser,
    operatingSystem,
    deviceName,
    approximateLocation,
  };
}

/**
 * IP-based geolocation hint for initial state selection in Nigerian SMB platform
 */

export interface GeolocationHint {
  countryCode?: string;
  countryName?: string;
  region?: string;
  city?: string;
}

const NIGERIAN_STATE_NAME_MAPPINGS: Record<string, string> = {
  'lagos': 'Lagos',
  'abuja': 'FCT (Abuja)',
  'federal capital territory': 'FCT (Abuja)',
  'fct': 'FCT (Abuja)',
  'rivers': 'Rivers',
  'port harcourt': 'Rivers',
  'kano': 'Kano',
  'oyo': 'Oyo',
  'ibadan': 'Oyo',
  'ogun': 'Ogun',
  'abeokuta': 'Ogun',
  'delta': 'Delta',
  'warri': 'Delta',
  'asaba': 'Delta',
  'enugu': 'Enugu',
  'kaduna': 'Kaduna',
  'anambra': 'Anambra',
  'onitsha': 'Anambra',
  'awka': 'Anambra',
  'edo': 'Edo',
  'benin': 'Edo',
  'akwa ibom': 'Akwa Ibom',
  'uyo': 'Akwa Ibom',
  'cross river': 'Cross River',
  'calabar': 'Cross River',
  'imo': 'Imo',
  'owerri': 'Imo',
  'plateau': 'Plateau',
  'jos': 'Plateau',
  'kwara': 'Kwara',
  'ilorin': 'Kwara',
  'abia': 'Abia',
  'aba': 'Abia',
  'umuahia': 'Abia',
  'benue': 'Benue',
  'makurdi': 'Benue',
  'borno': 'Borno',
  'maiduguri': 'Borno',
  'bayelsa': 'Bayelsa',
  'yenagoa': 'Bayelsa',
  'adamawa': 'Adamawa',
  'yola': 'Adamawa',
  'bauchi': 'Bauchi',
  'ebonyi': 'Ebonyi',
  'abakaliki': 'Ebonyi',
  'ekiti': 'Ekiti',
  'ado-ekiti': 'Ekiti',
  'gombe': 'Gombe',
  'jigawa': 'Jigawa',
  'dutse': 'Jigawa',
  'katsina': 'Katsina',
  'kebbi': 'Kebbi',
  'birnin kebbi': 'Kebbi',
  'kogi': 'Kogi',
  'lokoja': 'Kogi',
  'nasarawa': 'Nasarawa',
  'lafia': 'Nasarawa',
  'niger': 'Niger',
  'minna': 'Niger',
  'ondo': 'Ondo',
  'akure': 'Ondo',
  'osun': 'Osun',
  'osogbo': 'Osun',
  'sokoto': 'Sokoto',
  'taraba': 'Taraba',
  'jalingo': 'Taraba',
  'yobe': 'Yobe',
  'damaturu': 'Yobe',
  'zamfara': 'Zamfara',
  'gusau': 'Zamfara',
};

const GEO_CACHE_KEY = 'orvio_geo_state_hint';

export async function detectNigerianStateHint(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) return cached;
  } catch {}

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    // Lightweight, free geolocation lookup
    const res = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const data = await res.json();

    const countryCode = data?.country_code || data?.country;
    if (countryCode && countryCode.toUpperCase() !== 'NG') {
      return null;
    }

    const region = (data?.region || data?.region_name || data?.city || '').toLowerCase();
    for (const [key, stateName] of Object.entries(NIGERIAN_STATE_NAME_MAPPINGS)) {
      if (region.includes(key)) {
        try {
          sessionStorage.setItem(GEO_CACHE_KEY, stateName);
        } catch {}
        return stateName;
      }
    }

    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

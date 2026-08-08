// location.js — Geolocation + Reverse Geocoding via Nominatim

const LocationService = (() => {
  let cachedLocation = null;

  const COUNTRY_FLAGS = {
    IN: '🇮🇳', US: '🇺🇸', GB: '🇬🇧', AU: '🇦🇺', CA: '🇨🇦',
    DE: '🇩🇪', FR: '🇫🇷', JP: '🇯🇵', CN: '🇨🇳', BR: '🇧🇷',
    RU: '🇷🇺', KR: '🇰🇷', IT: '🇮🇹', ES: '🇪🇸', MX: '🇲🇽',
    PK: '🇵🇰', BD: '🇧🇩', NG: '🇳🇬', ID: '🇮🇩', SA: '🇸🇦',
    AR: '🇦🇷', ZA: '🇿🇦', EG: '🇪🇬', TR: '🇹🇷', PH: '🇵🇭',
    TH: '🇹🇭', VN: '🇻🇳', MY: '🇲🇾', SG: '🇸🇬', NL: '🇳🇱',
    SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', PL: '🇵🇱',
    UA: '🇺🇦', NZ: '🇳🇿', PT: '🇵🇹', BE: '🇧🇪', CH: '🇨🇭',
    AT: '🇦🇹', GR: '🇬🇷', CZ: '🇨🇿', HU: '🇭🇺', RO: '🇷🇴',
  };

  function getFlagEmoji(countryCode) {
    if (!countryCode) return '🌍';
    return COUNTRY_FLAGS[countryCode.toUpperCase()] || '🌍';
  }

  /**
   * Get coordinates from browser geolocation API
   * @returns {Promise<{lat, lng}|null>}
   */
  function getCoordinates() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: 300000 }
      );
    });
  }

  /**
   * Reverse geocode using Nominatim (OpenStreetMap) — free, no key
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<{city, country, countryCode, flag}>}
   */
  async function reverseGeocode(lat, lng) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county || 'Unknown';
      const country = addr.country || '';
      const countryCode = addr.country_code ? addr.country_code.toUpperCase() : '';
      const flag = getFlagEmoji(countryCode);
      return { city, country, countryCode, flag };
    } catch {
      return { city: 'Unknown', country: '', countryCode: '', flag: '🌍' };
    }
  }

  /**
   * Full location resolution: geo → reverse geocode
   * Never rejects — always returns something
   */
  async function resolve() {
    if (cachedLocation) return cachedLocation;

    const coords = await getCoordinates();
    if (!coords) {
      cachedLocation = { city: 'Unknown', country: '', countryCode: '', flag: '🌍' };
      return cachedLocation;
    }

    const geo = await reverseGeocode(coords.lat, coords.lng);
    cachedLocation = geo;
    return cachedLocation;
  }

  function getCached() {
    return cachedLocation || { city: 'Unknown', country: '', countryCode: '', flag: '🌍' };
  }

  return { resolve, getCached, getFlagEmoji };
})();

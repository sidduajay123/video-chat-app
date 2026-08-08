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
   * Fetch location silently via IP-based Geolocation API
   */
  async function resolveIPLocation() {
    try {
      // Primary: internal /api/location endpoint
      const res = await fetch('/api/location');
      const data = await res.json();
      if (data && data.city) {
        const country = data.country || '';
        const countryCode = data.countryCode ? data.countryCode.toUpperCase() : '';
        const flag = getFlagEmoji(countryCode);
        return { city: data.city, country, countryCode, flag };
      }
    } catch (e) {
      console.log('Primary geo IP failed, trying fallback...');
    }

    try {
      // Fallback: geojs.io (supports CORS)
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const data = await res.json();
      if (data && data.city) {
        const country = data.country || '';
        const countryCode = data.country_code ? data.country_code.toUpperCase() : '';
        const flag = getFlagEmoji(countryCode);
        return { city: data.city, country, countryCode, flag };
      }
    } catch (e) {
      console.log('Fallback geo IP failed');
    }

    return { city: 'Unknown', country: '', countryCode: '', flag: '🌍' };
  }

  /**
   * Full location resolution: silent IP lookup
   */
  async function resolve() {
    if (cachedLocation) return cachedLocation;
    const geo = await resolveIPLocation();
    cachedLocation = geo;
    return cachedLocation;
  }

  function getCached() {
    return cachedLocation || { city: 'Unknown', country: '', countryCode: '', flag: '🌍' };
  }

  return { resolve, getCached, getFlagEmoji };
})();

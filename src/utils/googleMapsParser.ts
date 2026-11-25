export interface ParsedMapLocation {
  lat: number;
  lng: number;
  address: string;
  originalNumber: number;
  rawText: string;
}

const DEFAULT_CR_LAT = 9.9281;
const DEFAULT_CR_LNG = -84.0907;

const OLC_ALPHABET = '23456789CFGHJMPQRVWX';
const OLC_PAIR_RESOLUTIONS = [20.0, 1.0, 0.05, 0.0025, 0.000125];

function decodePlusCode(codeInput: string, refLat = DEFAULT_CR_LAT, refLng = DEFAULT_CR_LNG): { lat: number; lng: number } | null {
  const clean = codeInput.toUpperCase().replace(/\s+/g, '');
  const plusIdx = clean.indexOf('+');
  if (plusIdx < 2 || plusIdx > 8 || plusIdx % 2 !== 0) return null;

  let fullCode = clean;
  // Recover short Plus Code (e.g., WWH5+6P -> 4 or 6 chars before '+') using reference coordinates
  if (plusIdx < 8) {
    const paddedRef = encodePlusCodeArea(refLat, refLng, 8 - plusIdx);
    if (!paddedRef) return null;
    fullCode = paddedRef + clean;
  }

  const stripped = fullCode.replace('+', '');
  if (stripped.length < 8) return null;

  for (const ch of stripped) {
    if (ch !== '0' && !OLC_ALPHABET.includes(ch)) return null;
  }

  let lat = 0;
  let lng = 0;

  for (let i = 0; i < Math.min(10, stripped.length); i += 2) {
    const latChar = stripped[i];
    const lngChar = stripped[i + 1];
    if (!latChar || !lngChar || latChar === '0' || lngChar === '0') break;
    const res = OLC_PAIR_RESOLUTIONS[i / 2];
    lat += OLC_ALPHABET.indexOf(latChar) * res;
    lng += OLC_ALPHABET.indexOf(lngChar) * res;
  }

  let latRes = OLC_PAIR_RESOLUTIONS[Math.min(4, Math.floor((Math.min(10, stripped.length) - 1) / 2))];
  let lngRes = latRes;

  if (stripped.length > 10) {
    for (let i = 10; i < Math.min(15, stripped.length); i++) {
      const idx = OLC_ALPHABET.indexOf(stripped[i]);
      if (idx < 0) break;
      latRes /= 5;
      lngRes /= 4;
      lat += Math.floor(idx / 4) * latRes;
      lng += (idx % 4) * lngRes;
    }
  }

  const finalLat = lat - 90 + latRes / 2;
  const finalLng = lng - 180 + lngRes / 2;

  if (finalLat < -90 || finalLat > 90 || finalLng < -180 || finalLng > 180) {
    return null;
  }

  return { lat: Number(finalLat.toFixed(6)), lng: Number(finalLng.toFixed(6)) };
}

function encodePlusCodeArea(lat: number, lng: number, prefixLength: number): string | null {
  if (prefixLength <= 0 || prefixLength % 2 !== 0) return null;
  let latVal = Math.min(Math.max(lat + 90, 0), 179.999999);
  let lngVal = ((lng + 180) % 360 + 360) % 360;
  let code = '';
  for (let i = 0; i < prefixLength / 2; i++) {
    const res = OLC_PAIR_RESOLUTIONS[i];
    const latDigit = Math.floor(latVal / res);
    const lngDigit = Math.floor(lngVal / res);
    latVal -= latDigit * res;
    lngVal -= lngDigit * res;
    code += OLC_ALPHABET[latDigit] + OLC_ALPHABET[lngDigit];
  }
  return code;
}

function extractDmsCoords(text: string): { lat: number; lng: number } | null {
  const dmsRegex = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([NS])\s*[,;\s]+\s*(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]?\s*([EW])/i;
  const m = text.match(dmsRegex);
  if (!m) return null;

  let lat = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600;
  let lng = parseFloat(m[5]) + parseFloat(m[6]) / 60 + parseFloat(m[7]) / 3600;
  if (m[4].toUpperCase() === 'S') lat = -lat;
  if (m[8].toUpperCase() === 'W') lng = -lng;

  if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
  }
  return null;
}

export function extractPackageNumber(text: string, defaultNum: number): number {
  let originalNumber = defaultNum;
  const numMatch = text.match(/(?:paquete|pedido|item|n[º°]|#)\s*(\d+)/i) || text.match(/^(\d+)[\.\)]\s+/);
  if (numMatch && numMatch[1]) {
    const parsedNum = parseInt(numMatch[1], 10);
    if (!isNaN(parsedNum)) {
      originalNumber = parsedNum;
    }
  } else {
    const startNumMatch = text.match(/^(\d+)\s*[-–:]/);
    if (startNumMatch && startNumMatch[1]) {
      const parsedNum = parseInt(startNumMatch[1], 10);
      if (!isNaN(parsedNum)) {
        originalNumber = parsedNum;
      }
    }
  }
  return originalNumber;
}

export function extractGoogleMapsUrlFromText(text: string): string | null {
  const fullUrlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (fullUrlMatch) return fullUrlMatch[0];

  const bareShortMatch = text.match(/\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/maps|maps\.google\.com|www\.google\.com\/maps)\/[^\s"'<>]+/i);
  if (bareShortMatch) return `https://${bareShortMatch[0]}`;

  return null;
}

function isGoogleMapsUrl(urlStr: string): boolean {
  const lower = urlStr.toLowerCase();
  return (
    lower.includes('maps.app.goo.gl') ||
    lower.includes('goo.gl/maps') ||
    lower.includes('g.co/') ||
    lower.includes('maps.google.') ||
    lower.includes('google.com/maps') ||
    lower.includes('google.co.cr/maps')
  );
}

function extractReadableAddress(rawText: string, lat: number, lng: number, resolvedPlaceName?: string | null): string {
  // Check if URL has /maps/place/Place+Name/...
  const placeFromUrl = rawText.match(/\/maps\/place\/([^/@?]+)/i)?.[1];
  let urlPlaceName = '';
  if (placeFromUrl) {
    try {
      const decoded = decodeURIComponent(placeFromUrl.replace(/\+/g, ' ')).trim();
      if (decoded && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(decoded)) {
        urlPlaceName = decoded;
      }
    } catch {
      // ignore
    }
  }

  const textWithoutUrls = rawText
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/\b(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co)\/[^\s]+/gi, '')
    .replace(/lat(?:itud)?\s*[:=]?\s*-?\d+\.\d+/gi, '')
    .replace(/(?:lng|lon(?:gitud)?)\s*[:=]?\s*-?\d+\.\d+/gi, '')
    .replace(/[-+]?\d{1,2}\.\d+\s*,\s*[-+]?\d{1,3}\.\d+/g, '')
    .replace(/^[\s,•\-–:]+|[\s,•\-–:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (resolvedPlaceName && textWithoutUrls && !resolvedPlaceName.toLowerCase().includes(textWithoutUrls.toLowerCase())) {
    return `${textWithoutUrls} (${resolvedPlaceName})`;
  }
  if (textWithoutUrls.length >= 4) return textWithoutUrls;
  if (resolvedPlaceName) return resolvedPlaceName;
  if (urlPlaceName) return urlPlaceName;
  return `Ubicación (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

export function parseGoogleMapsUrl(rawInput: string, defaultNum: number): { location: ParsedMapLocation | null; error?: string } {
  const text = rawInput.trim();
  if (!text) {
    return { location: null, error: 'Texto vacío' };
  }

  let decodedText = text;
  try {
    decodedText = decodeURIComponent(text);
  } catch {
    // Keep original if raw text contains standalone % signs
  }

  const originalNumber = extractPackageNumber(text, defaultNum);

  let lat: number | null = null;
  let lng: number | null = null;

  // Pattern A: WhatsApp / explicit Lat/Lng labels
  const labelledLatMatch = text.match(/(?:lat(?:itud)?)\s*[:=]?\s*(-?\d+\.\d+)/i);
  const labelledLngMatch = text.match(/(?:lng|lon(?:gitud)?)\s*[:=]?\s*(-?\d+\.\d+)/i);
  if (labelledLatMatch && labelledLngMatch) {
    lat = parseFloat(labelledLatMatch[1]);
    lng = parseFloat(labelledLngMatch[1]);
  }

  // Pattern B: Exact pin Google Maps !3d<lat>!4d<lng> (more accurate than @lat,lng!)
  if (lat === null || lng === null) {
    const data3d4dMatch = decodedText.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (data3d4dMatch) {
      lat = parseFloat(data3d4dMatch[1]);
      lng = parseFloat(data3d4dMatch[2]);
    }
  }

  // Pattern C: Google Maps query params (q=, query=, ll=, sll=, center=, viewpoint=, destination=, daddr=, loc:)
  if (lat === null || lng === null) {
    const queryCoordMatch = decodedText.match(
      /[?&](?:q|query|ll|sll|center|viewpoint|destination|daddr)=(?:loc:)?(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i
    );
    if (queryCoordMatch) {
      lat = parseFloat(queryCoordMatch[1]);
      lng = parseFloat(queryCoordMatch[2]);
    }
  }

  // Pattern D: /maps/dir//lat,lng or /maps/search/lat,lng or geo:lat,lng
  if (lat === null || lng === null) {
    const pathOrGeoMatch =
      decodedText.match(/\/maps\/(?:dir\/\/|search\/|place\/)(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i) ||
      decodedText.match(/\bgeo:(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i);
    if (pathOrGeoMatch) {
      lat = parseFloat(pathOrGeoMatch[1]);
      lng = parseFloat(pathOrGeoMatch[2]);
    }
  }

  // Pattern E: Google Maps @lat,lng
  if (lat === null || lng === null) {
    const atMatch = decodedText.match(/@(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    }
  }

  // Pattern F: DMS coordinates (e.g. 9°55'41.2"N 84°05'26.5"W)
  if (lat === null || lng === null) {
    const dms = extractDmsCoords(text);
    if (dms) {
      lat = dms.lat;
      lng = dms.lng;
    }
  }

  // Pattern G: Generic decimal coordinate pair (e.g. "9.9281, -84.0907")
  if (lat === null || lng === null) {
    const genericCoordMatch = decodedText.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
    if (genericCoordMatch) {
      const p1 = parseFloat(genericCoordMatch[1]);
      const p2 = parseFloat(genericCoordMatch[2]);
      if (p1 >= -90 && p1 <= 90 && p2 >= -180 && p2 <= 180) {
        lat = p1;
        lng = p2;
      }
    }
  }

  // Pattern H: Full 8+ character Plus Code (offline deterministic decode)
  if (lat === null || lng === null) {
    const fullPlusMatch = text.match(/\b([23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,5})\b/i);
    if (fullPlusMatch) {
      const decoded = decodePlusCode(fullPlusMatch[1]);
      if (decoded) {
        lat = decoded.lat;
        lng = decoded.lng;
      }
    }
  }

  // Validate coordinates reliability
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    if (text.includes('maps.app.goo.gl') || text.includes('goo.gl/maps') || text.includes('g.co/')) {
      return {
        location: null,
        error: 'Enlace corto de Google Maps detectado. Usa "Verificar" o "Guardar" para obtener sus coordenadas automáticamente.'
      };
    }
    return {
      location: null,
      error: 'No se pudieron extraer coordenadas geográficas válidas de Google Maps o WhatsApp.'
    };
  }

  return {
    location: {
      lat,
      lng,
      address: extractReadableAddress(text, lat, lng),
      originalNumber,
      rawText: text
    }
  };
}

export async function resolveSharedLocationAsync(
  rawInput: string,
  defaultNum: number
): Promise<{ location: ParsedMapLocation | null; error?: string }> {
  const text = rawInput.trim();
  if (!text) {
    return { location: null, error: 'Texto vacío' };
  }

  // 1. Try instant local parsing first
  const syncResult = parseGoogleMapsUrl(text, defaultNum);
  if (syncResult.location) {
    return syncResult;
  }

  const originalNumber = extractPackageNumber(text, defaultNum);
  const urlInText = extractGoogleMapsUrlFromText(text);

  // 2. If there's a Google Maps link (including maps.app.goo.gl / goo.gl/maps / g.co / place link), resolve via backend proxy
  if (urlInText && isGoogleMapsUrl(urlInText)) {
    try {
      const resp = await fetch('/api/resolve-map-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInText })
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && typeof data.lat === 'number' && typeof data.lng === 'number') {
        return {
          location: {
            lat: data.lat,
            lng: data.lng,
            address: extractReadableAddress(text, data.lat, data.lng, data.address),
            originalNumber,
            rawText: text
          }
        };
      }

      // If resolvedUrl exists, try client-side parser on resolvedUrl too
      if (typeof data.resolvedUrl === 'string') {
        const retryParsed = parseGoogleMapsUrl(data.resolvedUrl, originalNumber);
        if (retryParsed.location) {
          return {
            location: {
              ...retryParsed.location,
              address: extractReadableAddress(text, retryParsed.location.lat, retryParsed.location.lng, data.address),
              rawText: text
            }
          };
        }
      }

      if (data.error) {
        return { location: null, error: data.error };
      }
    } catch {
      return {
        location: null,
        error: 'No se pudo conectar al servidor para leer el enlace corto de Google Maps. Verifica tu conexión.'
      };
    }
  }

  // 3. Check short Plus Code (e.g., "WWH5+6P San José" or "WWH5+6P")
  const shortPlusMatch = text.match(/\b([23456789CFGHJMPQRVWX]{4,6}\+[23456789CFGHJMPQRVWX]{2,4})\b/i);
  if (shortPlusMatch) {
    const locality = text.replace(shortPlusMatch[0], '').trim();
    let refLat = DEFAULT_CR_LAT;
    let refLng = DEFAULT_CR_LNG;

    if (locality.length >= 3) {
      try {
        const geoResp = await fetch('/api/geocode-place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: locality })
        });
        if (geoResp.ok) {
          const geoData = await geoResp.json();
          if (typeof geoData.lat === 'number' && typeof geoData.lng === 'number') {
            refLat = geoData.lat;
            refLng = geoData.lng;
          }
        }
      } catch {
        // Fallback to Costa Rica default reference
      }
    }

    const decoded = decodePlusCode(shortPlusMatch[1], refLat, refLng);
    if (decoded) {
      return {
        location: {
          lat: decoded.lat,
          lng: decoded.lng,
          address: extractReadableAddress(text, decoded.lat, decoded.lng),
          originalNumber,
          rawText: text
        }
      };
    }
  }

  // 4. Fallback: plain text shared from Google Maps (place name / address without URL)
  if (!urlInText && text.length >= 5) {
    try {
      const geoResp = await fetch('/api/geocode-place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      });
      if (geoResp.ok) {
        const geoData = await geoResp.json();
        if (typeof geoData.lat === 'number' && typeof geoData.lng === 'number') {
          return {
            location: {
              lat: geoData.lat,
              lng: geoData.lng,
              address: extractReadableAddress(text, geoData.lat, geoData.lng, geoData.address),
              originalNumber,
              rawText: text
            }
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return syncResult;
}

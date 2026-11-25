import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ALLOWED_MAPS_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'g.co',
  'maps.google.com',
  'www.google.com',
  'google.com',
  'maps.google.co.cr',
  'www.google.co.cr',
]);

function isPrivateOrDisallowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  // Reject IPv4 literals
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    return true;
  }
  // Reject IPv6 literals
  if (lower.includes(':')) {
    return true;
  }
  return !ALLOWED_MAPS_HOSTS.has(lower);
}

function parseAllowedGoogleMapsUrl(rawUrl: string): URL | null {
  try {
    let candidate = rawUrl.trim();
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = `https://${candidate}`;
    }
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (isPrivateOrDisallowedHost(parsed.hostname)) {
      return null;
    }
    // Force HTTPS for outbound fetch
    parsed.protocol = 'https:';
    return parsed;
  } catch {
    return null;
  }
}

function extractCoordsFromTextOrUrl(text: string): { lat: number; lng: number } | null {
  if (!text) return null;
  let decoded = text;
  try {
    decoded = decodeURIComponent(text);
  } catch {
    // keep raw text if malformed URI sequence
  }

  const patterns: RegExp[] = [
    // Exact pin in Google Maps data parameter
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    // Query params (q=, query=, ll=, sll=, center=, viewpoint=, destination=, daddr=)
    /[?&](?:q|query|ll|sll|center|viewpoint|destination|daddr)=(?:loc:)?(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
    // Viewport center @lat,lng
    /@(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    // Path /maps/dir//lat,lng or /maps/search/lat,lng
    /\/maps\/(?:dir\/\/|search\/|place\/)(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
    // Static map center in og:image meta tags: center=9.9281%2C-84.0907
    /center=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i,
  ];

  for (const source of [decoded, text]) {
    for (const pattern of patterns) {
      const m = source.match(pattern);
      if (m && m[1] && m[2]) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        if (
          !isNaN(lat) &&
          !isNaN(lng) &&
          lat >= -90 &&
          lat <= 90 &&
          lng >= -180 &&
          lng <= 180 &&
          !(lat === 0 && lng === 0)
        ) {
          return { lat, lng };
        }
      }
    }
  }

  // Google Maps APP_INITIALIZATION_STATE fallback: [[[scale, lng, lat]
  const appStateMatch = text.match(/\[\[\[[\d.]+,\s*(-?\d{1,3}\.\d+),\s*(-?\d{1,2}\.\d+)\]/);
  if (appStateMatch) {
    const lng = parseFloat(appStateMatch[1]);
    const lat = parseFloat(appStateMatch[2]);
    if (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      !(lat === 0 && lng === 0)
    ) {
      return { lat, lng };
    }
  }

  return null;
}

function extractPlaceNameFromUrlOrHtml(urlStr: string, html: string): string | null {
  // 1. From /maps/place/Place+Name/@...
  const placeMatch = urlStr.match(/\/maps\/place\/([^/@?]+)/i);
  if (placeMatch && placeMatch[1]) {
    try {
      const decoded = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')).trim();
      if (decoded && !/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(decoded)) {
        return decoded;
      }
    } catch {
      // ignore decode error
    }
  }

  // 2. From ?q=Place+Name (if not coordinates)
  try {
    const u = new URL(urlStr);
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    if (q && !/^(?:loc:)?-?\d+\.\d+,\s*-?\d+\.\d+$/.test(q.trim())) {
      return q.trim();
    }
  } catch {
    // ignore
  }

  // 3. From HTML og:title or <title>
  if (html) {
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    if (ogTitle) {
      const cleaned = ogTitle.replace(/\s*[-·]\s*Google Maps$/i, '').trim();
      if (cleaned && cleaned.toLowerCase() !== 'google maps') {
        return cleaned;
      }
    }
  }

  return null;
}

async function geocodeViaNominatim(query: string): Promise<{ lat: number; lng: number; address: string } | null> {
  const cleanQuery = query.trim().slice(0, 250);
  if (!cleanQuery) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=cr&q=${encodeURIComponent(cleanQuery)}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        'User-Agent': 'RuteoDeliveryApp/1.0',
        'Accept-Language': 'es-CR,es;q=0.9',
      },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          lat,
          lng,
          address: data[0].display_name || cleanQuery,
        };
      }
    }
  } catch {
    // ignore geocoding network errors
  }
  return null;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.post('/api/resolve-map-link', async (req: Request, res: Response) => {
    try {
      const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!rawUrl || rawUrl.length > 2000) {
        res.status(400).json({ error: 'URL inválida o demasiado larga.' });
        return;
      }

      const initialUrl = parseAllowedGoogleMapsUrl(rawUrl);
      if (!initialUrl) {
        res.status(400).json({ error: 'Solo se permiten enlaces válidos de Google Maps.' });
        return;
      }

      let currentUrl = initialUrl;
      let html = '';
      let coords = extractCoordsFromTextOrUrl(currentUrl.toString());

      if (!coords) {
        for (let hop = 0; hop < 6; hop++) {
          const response = await fetch(currentUrl.toString(), {
            method: 'GET',
            redirect: 'manual',
            signal: AbortSignal.timeout(8000),
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              'Accept-Language': 'es-CR,es;q=0.9,en;q=0.8',
            },
          });

          if (response.status >= 300 && response.status < 400) {
            const locationHeader = response.headers.get('location');
            if (!locationHeader) break;
            let resolvedHop: URL;
            try {
              resolvedHop = new URL(locationHeader, currentUrl);
            } catch {
              break;
            }
            if (isPrivateOrDisallowedHost(resolvedHop.hostname)) {
              break;
            }
            resolvedHop.protocol = 'https:';
            currentUrl = resolvedHop;

            // Check if the redirected URL already carries coordinates
            coords = extractCoordsFromTextOrUrl(currentUrl.toString());
            if (coords) {
              break;
            }
            continue;
          }

          if (response.ok) {
            const text = await response.text();
            html = text.slice(0, 300000);
            coords = extractCoordsFromTextOrUrl(html);
          }
          break;
        }
      }

      const finalUrlStr = currentUrl.toString();
      const placeName = extractPlaceNameFromUrlOrHtml(finalUrlStr, html);

      if (!coords && placeName) {
        const geocoded = await geocodeViaNominatim(placeName);
        if (geocoded) {
          coords = { lat: geocoded.lat, lng: geocoded.lng };
        }
      }

      if (!coords) {
        res.status(422).json({
          error: 'No se pudieron obtener coordenadas desde ese enlace de Google Maps.',
          resolvedUrl: finalUrlStr,
          placeName,
        });
        return;
      }

      res.json({
        lat: coords.lat,
        lng: coords.lng,
        address: placeName || null,
        resolvedUrl: finalUrlStr,
      });
    } catch (error) {
      console.error('Error resolving Google Maps link:', error);
      res.status(500).json({ error: 'No se pudo consultar el enlace de Google Maps.' });
    }
  });

  app.post('/api/geocode-place', async (req: Request, res: Response) => {
    try {
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      if (!query || query.length > 300) {
        res.status(400).json({ error: 'Consulta de ubicación inválida.' });
        return;
      }

      const geocoded = await geocodeViaNominatim(query);
      if (!geocoded) {
        res.status(404).json({ error: 'No se encontró esa ubicación.' });
        return;
      }

      res.json(geocoded);
    } catch (error) {
      console.error('Error geocoding place:', error);
      res.status(500).json({ error: 'Error buscando la ubicación.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RUTEO server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

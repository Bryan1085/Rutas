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
  'waze.com',
  'www.waze.com',
  'ul.waze.com',
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
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(lower)) {
    return true;
  }
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
    if (parsed.username || parsed.password) {
      return null;
    }
    if (isPrivateOrDisallowedHost(parsed.hostname)) {
      return null;
    }
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
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|latlng|sll|center|viewpoint|destination|daddr)=(?:loc:|ll\.)?(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
    /[?&](?:to|from)=ll\.(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
    /@(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/,
    /\/maps\/(?:dir\/\/|search\/|place\/)(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/i,
    /center=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i,
    /"latLng"\s*:\s*\{\s*"lat"\s*:\s*(-?\d{1,2}\.\d+)\s*,\s*"lng"\s*:\s*(-?\d{1,3}\.\d+)/i,
    /"lat"\s*:\s*(-?\d{1,2}\.\d+)\s*,\s*"lo?ng?"\s*:\s*(-?\d{1,3}\.\d+)/i,
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

  try {
    const u = new URL(urlStr);
    const q = u.searchParams.get('q') || u.searchParams.get('query');
    if (q && !/^(?:loc:)?-?\d+\.\d+,\s*-?\d+\.\d+$/.test(q.trim())) {
      return q.trim();
    }
  } catch {
    // ignore
  }

  if (html) {
    const ogTitle =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1];
    if (ogTitle) {
      const cleaned = ogTitle
        .replace(/\s*[-·|]\s*(?:Google Maps|Waze)$/i, '')
        .trim();
      if (cleaned && cleaned.toLowerCase() !== 'google maps' && cleaned.toLowerCase() !== 'waze') {
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

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkApiRateLimit(req: Request, maxRequests = 30, windowMs = 60_000): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req: Request, res: Response, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.post('/api/resolve-map-link', async (req: Request, res: Response) => {
    if (!checkApiRateLimit(req, 30, 60_000)) {
      res.status(429).json({ error: 'Demasiadas consultas seguidas. Intenta en un minuto.' });
      return;
    }
    try {
      const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      if (!rawUrl || rawUrl.length > 2000) {
        res.status(400).json({ error: 'URL inválida o demasiado larga.' });
        return;
      }

      const initialUrl = parseAllowedGoogleMapsUrl(rawUrl);
      if (!initialUrl) {
        res.status(400).json({ error: 'Solo se permiten enlaces válidos de Google Maps o Waze.' });
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
            if (resolvedHop.username || resolvedHop.password || isPrivateOrDisallowedHost(resolvedHop.hostname)) {
              break;
            }
            resolvedHop.protocol = 'https:';
            currentUrl = resolvedHop;

            coords = extractCoordsFromTextOrUrl(currentUrl.toString());
            if (coords) {
              break;
            }
            continue;
          }

          if (response.ok) {
            const contentLength = Number(response.headers.get('content-length') || '0');
            const contentType = (response.headers.get('content-type') || '').toLowerCase();
            if (
              (!contentLength || contentLength <= 2_000_000) &&
              (!contentType || contentType.includes('text/') || contentType.includes('html'))
            ) {
              const text = await response.text();
              html = text.slice(0, 300000);
              coords = extractCoordsFromTextOrUrl(html);
            }
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
    if (!checkApiRateLimit(req, 20, 60_000)) {
      res.status(429).json({ error: 'Demasiadas consultas seguidas. Intenta en un minuto.' });
      return;
    }
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

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta API no encontrada.' });
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

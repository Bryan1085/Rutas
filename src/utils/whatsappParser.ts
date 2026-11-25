import { DeliveryItem } from '../types';
import { validateGeographicalCoverage } from './coverageValidator';

interface ParseResult {
  items: DeliveryItem[];
  errors: string[];
}

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function buildWhatsAppUrl(phone?: string, presetText?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // Standard 8-digit Costa Rica number without country code -> prepend 506
  if (digits.length === 8) {
    digits = `506${digits}`;
  }
  const baseUrl = `https://wa.me/${digits}`;
  return presetText ? `${baseUrl}?text=${encodeURIComponent(presetText)}` : baseUrl;
}

export const WHATSAPP_TEMPLATE_STORAGE_KEY = 'ruteo_whatsapp_template';
export const DEFAULT_LOCATION_REQUEST_TEMPLATE =
  'Hola, te saludamos por tu paquete #{paquete}. ¿Nos podrías compartir tu ubicación actual o enlace de Google Maps para realizar la entrega, por favor?';

export function getLocationRequestTemplate(): string {
  try {
    const saved = localStorage.getItem(WHATSAPP_TEMPLATE_STORAGE_KEY);
    return saved && saved.trim() ? saved : DEFAULT_LOCATION_REQUEST_TEMPLATE;
  } catch {
    return DEFAULT_LOCATION_REQUEST_TEMPLATE;
  }
}

export function saveLocationRequestTemplate(template: string): void {
  try {
    const trimmed = template.trim();
    if (!trimmed) {
      localStorage.removeItem(WHATSAPP_TEMPLATE_STORAGE_KEY);
    } else {
      localStorage.setItem(WHATSAPP_TEMPLATE_STORAGE_KEY, trimmed);
    }
  } catch {
    // ignore storage errors
  }
}

export function buildLocationRequestMessage(packageNumber: number): string {
  const template = getLocationRequestTemplate();
  return template.replace(/\{paquete\}/gi, String(packageNumber));
}

// San José, Costa Rica center default
const DEFAULT_LAT = 9.9281;
const DEFAULT_LNG = -84.0907;

export function parseWhatsAppInput(rawText: string, existingItems: DeliveryItem[] = []): ParseResult {
  const items: DeliveryItem[] = [...existingItems];
  const errors: string[] = [];
  
  if (!rawText || !rawText.trim()) {
    return { items, errors: ['El texto ingresado está vacío.'] };
  }

  const lines = rawText.split(/\r?\n/);
  
  let maxOriginalNum = items.reduce((max, item) => Math.max(max, item.originalNumber), 0);
  let lineCounter = maxOriginalNum + 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let originalNumber = lineCounter;
    const numMatch = line.match(/(?:paquete|pedido|item|n[º°]|#)\s*(\d+)/i) || line.match(/^(\d+)[\.\)]\s+/);
    
    if (numMatch && numMatch[1]) {
      const parsedNum = parseInt(numMatch[1], 10);
      if (!isNaN(parsedNum)) {
        originalNumber = parsedNum;
      }
    } else {
      const startNumMatch = line.match(/^(\d+)\s*[-–:]/);
      if (startNumMatch && startNumMatch[1]) {
        const parsedNum = parseInt(startNumMatch[1], 10);
        if (!isNaN(parsedNum)) {
          originalNumber = parsedNum;
        }
      }
    }

    const isDuplicate = items.some(item => item.originalNumber === originalNumber);
    if (isDuplicate) {
      maxOriginalNum = Math.max(...items.map(it => it.originalNumber), maxOriginalNum);
      originalNumber = maxOriginalNum + 1;
    }

    let lat: number | null = null;
    let lng: number | null = null;

    const coordMatch = line.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
                       line.match(/q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ||
                       line.match(/(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);

    if (coordMatch) {
      const parsedLat = parseFloat(coordMatch[1]);
      const parsedLng = parseFloat(coordMatch[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat >= -90 && parsedLat <= 90 && parsedLng >= -180 && parsedLng <= 180) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }

    const urlMatch = line.match(/https?:\/\/[^\s]+/) || line.match(/maps\.app\.goo\.gl\/[^\s]+/);
    let address = line;

    if (urlMatch) {
      address = urlMatch[0];
      if (lat === null || lng === null) {
        // Generate pseudo coordinates around San Jose Costa Rica for testing links without direct coordinates
        lat = DEFAULT_LAT + (Math.sin(items.length * 2) * 0.05);
        lng = DEFAULT_LNG + (Math.cos(items.length * 2) * 0.05);
      }
    } else if (lat === null || lng === null) {
      lat = DEFAULT_LAT + (Math.sin(items.length + 1) * 0.04);
      lng = DEFAULT_LNG + (Math.cos(items.length + 1) * 0.04);
    }

    if (lat !== null && lng !== null) {
      const coverageValidation = validateGeographicalCoverage(lat, lng);

      const newItem: DeliveryItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        originalNumber,
        address: address.replace(/^https?:\/\/[^\s]+/, '').trim() || line,
        lat,
        lng,
        status: 'pending',
        coverageStatus: coverageValidation.coverageStatus,
        province: coverageValidation.province,
        orderIndex: items.length,
        notes: line
      };
      items.push(newItem);
      maxOriginalNum = Math.max(maxOriginalNum, originalNumber);
    } else {
      errors.push(`No se pudo interpretar la ubicación en la línea: "${line}"`);
    }

    lineCounter++;
  }

  return { items, errors };
}

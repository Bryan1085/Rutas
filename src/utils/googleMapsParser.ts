export interface ParsedMapLocation {
  lat: number;
  lng: number;
  address: string;
  originalNumber: number;
  rawText: string;
}

export function parseGoogleMapsUrl(rawInput: string, defaultNum: number): { location: ParsedMapLocation | null; error?: string } {
  const text = rawInput.trim();
  if (!text) {
    return { location: null, error: 'Texto vacío' };
  }

  // 1. Try to extract package number if present (e.g., "3:", "Paquete 8", "#12")
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

  let lat: number | null = null;
  let lng: number | null = null;

  // 2. Pattern A: WhatsApp Lat/Lng explicit labels (e.g., "Lat: 9.9281, Lng: -84.0907" or "Latitud: ... Longitud: ...")
  const labelledLatMatch = text.match(/(?:lat(?:itud)?)\s*[:=]?\s*(-?\d+\.\d+)/i);
  const labelledLngMatch = text.match(/(?:lng|lon(?:gitud)?)\s*[:=]?\s*(-?\d+\.\d+)/i);
  if (labelledLatMatch && labelledLngMatch) {
    lat = parseFloat(labelledLatMatch[1]);
    lng = parseFloat(labelledLngMatch[1]);
  }

  // 3. Pattern B: Google Maps @lat,lng
  if (lat === null || lng === null) {
    const atMatch = text.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (atMatch) {
      lat = parseFloat(atMatch[1]);
      lng = parseFloat(atMatch[2]);
    }
  }

  // 4. Pattern C: Google Maps data encoding !3d<lat>!4d<lng>
  if (lat === null || lng === null) {
    const data3d4dMatch = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (data3d4dMatch) {
      lat = parseFloat(data3d4dMatch[1]);
      lng = parseFloat(data3d4dMatch[2]);
    }
  }

  // 5. Pattern D: Query parameters q=, ll=, sll=, destination=
  if (lat === null || lng === null) {
    const queryCoordMatch = text.match(/[?&](?:q|ll|sll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (queryCoordMatch) {
      lat = parseFloat(queryCoordMatch[1]);
      lng = parseFloat(queryCoordMatch[2]);
    }
  }

  // 6. Pattern E: Generic decimal coordinate pair in text (e.g. "9.9281, -84.0907" from WhatsApp pin share)
  if (lat === null || lng === null) {
    const genericCoordMatch = text.match(/(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/);
    if (genericCoordMatch) {
      const p1 = parseFloat(genericCoordMatch[1]);
      const p2 = parseFloat(genericCoordMatch[2]);
      if (p1 >= -90 && p1 <= 90 && p2 >= -180 && p2 <= 180) {
        lat = p1;
        lng = p2;
      }
    }
  }

  // Validate coordinates reliability
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    if (text.includes('maps.app.goo.gl') || text.includes('goo.gl/maps')) {
      return {
        location: null,
        error: 'Enlace corto de Google Maps detectado sin coordenadas directas. Por favor asegúrate de incluir las coordenadas o un enlace completo.'
      };
    }
    return {
      location: null,
      error: 'No se pudieron extraer coordenadas geográficas válidas de Google Maps o WhatsApp.'
    };
  }

  // Extract clean address text (removing URL if present)
  const cleanAddress = text.replace(/https?:\/\/[^\s]+/, '').replace(/lat[^,\n]+/gi, '').replace(/lng[^,\n]+/gi, '').trim() || text;

  return {
    location: {
      lat,
      lng,
      address: cleanAddress.length > 5 ? cleanAddress : `Ubicación (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      originalNumber,
      rawText: text
    }
  };
}

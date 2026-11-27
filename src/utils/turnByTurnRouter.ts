export type ManeuverIconKind =
  | 'depart'
  | 'straight'
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'uturn'
  | 'roundabout'
  | 'arrive';

export interface RouteStepInstruction {
  id: string;
  instruction: string;
  streetName: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverLocation: [number, number]; // [lat, lng]
  geometry: [number, number][]; // [[lat, lng], ...]
  iconKind: ManeuverIconKind;
  bearingAfter: number;
}

export interface TurnByTurnRoute {
  coordinates: [number, number][]; // full polyline [[lat, lng], ...]
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  steps: RouteStepInstruction[];
}

export function distanceMetersBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegreesBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function formatDistanceEs(meters: number): string {
  const rounded = Math.max(0, Math.round(meters));
  if (rounded < 1000) {
    if (rounded >= 100) return `${Math.round(rounded / 10) * 10} m`;
    return `${rounded} m`;
  }
  const km = rounded / 1000;
  return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`;
}

export function formatDurationEs(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h} h ${rem} min` : `${h} h`;
}

/**
 * Finds the closest point on a route polyline to a GPS coordinate.
 */
export function findNearestRouteProgress(
  lat: number,
  lng: number,
  coords: [number, number][]
): {
  distanceMeters: number;
  segmentIndex: number;
  snappedPoint: [number, number];
  segmentBearing: number;
} {
  if (coords.length === 0) {
    return {
      distanceMeters: Infinity,
      segmentIndex: 0,
      snappedPoint: [lat, lng],
      segmentBearing: 0,
    };
  }
  if (coords.length === 1) {
    return {
      distanceMeters: distanceMetersBetween(lat, lng, coords[0][0], coords[0][1]),
      segmentIndex: 0,
      snappedPoint: coords[0],
      segmentBearing: 0,
    };
  }

  const cosLat = Math.cos((lat * Math.PI) / 180);
  let bestDist = Infinity;
  let bestIdx = 0;
  let bestPoint: [number, number] = coords[0];

  for (let i = 0; i < coords.length - 1; i++) {
    const [aLat, aLng] = coords[i];
    const [bLat, bLng] = coords[i + 1];

    const ax = (aLng - lng) * cosLat;
    const ay = aLat - lat;
    const bx = (bLng - lng) * cosLat;
    const by = bLat - lat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 1e-16) {
      t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    }

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);
    const d = distanceMetersBetween(lat, lng, projLat, projLng);

    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestPoint = [projLat, projLng];
    }
  }

  const segBearing = bearingDegreesBetween(
    coords[bestIdx][0],
    coords[bestIdx][1],
    coords[bestIdx + 1][0],
    coords[bestIdx + 1][1]
  );

  return {
    distanceMeters: bestDist,
    segmentIndex: bestIdx,
    snappedPoint: bestPoint,
    segmentBearing: segBearing,
  };
}

/**
 * Computes a smooth bearing looking ahead along the route polyline so map rotation
 * anticipates turns naturally instead of snapping on tiny 2m polyline segments.
 */
export function lookAheadBearingOnRoute(
  coords: [number, number][],
  segmentIndex: number,
  snappedPoint: [number, number],
  lookAheadMeters = 28
): number {
  if (coords.length < 2) return 0;
  let remaining = lookAheadMeters;
  let curLat = snappedPoint[0];
  let curLng = snappedPoint[1];
  let idx = Math.max(0, Math.min(segmentIndex, coords.length - 2));

  while (idx < coords.length - 1) {
    const [nextLat, nextLng] = coords[idx + 1];
    const segLen = distanceMetersBetween(curLat, curLng, nextLat, nextLng);
    if (segLen >= remaining && segLen > 0.5) {
      const ratio = remaining / segLen;
      const targetLat = curLat + (nextLat - curLat) * ratio;
      const targetLng = curLng + (nextLng - curLng) * ratio;
      return bearingDegreesBetween(snappedPoint[0], snappedPoint[1], targetLat, targetLng);
    }
    remaining -= segLen;
    curLat = nextLat;
    curLng = nextLng;
    idx += 1;
  }

  const last = coords[coords.length - 1];
  const distToEnd = distanceMetersBetween(snappedPoint[0], snappedPoint[1], last[0], last[1]);
  if (distToEnd > 1) {
    return bearingDegreesBetween(snappedPoint[0], snappedPoint[1], last[0], last[1]);
  }
  const prevIdx = Math.max(0, coords.length - 2);
  return bearingDegreesBetween(
    coords[prevIdx][0],
    coords[prevIdx][1],
    coords[coords.length - 1][0],
    coords[coords.length - 1][1]
  );
}

/**
 * Computes exact distance in meters along the route polyline from current snapped position
 * up to a maneuver coordinate ahead.
 */
export function roadDistanceToPoint(
  coords: [number, number][],
  startSegIdx: number,
  startPoint: [number, number],
  targetPoint: [number, number]
): number {
  if (coords.length < 2) {
    return distanceMetersBetween(startPoint[0], startPoint[1], targetPoint[0], targetPoint[1]);
  }
  const targetProg = findNearestRouteProgress(targetPoint[0], targetPoint[1], coords);
  if (targetProg.segmentIndex < startSegIdx) {
    return distanceMetersBetween(startPoint[0], startPoint[1], targetPoint[0], targetPoint[1]);
  }
  if (targetProg.segmentIndex === startSegIdx) {
    const a = coords[startSegIdx];
    const dStart = distanceMetersBetween(a[0], a[1], startPoint[0], startPoint[1]);
    const dTarget = distanceMetersBetween(a[0], a[1], targetProg.snappedPoint[0], targetProg.snappedPoint[1]);
    return Math.max(0, dTarget - dStart);
  }

  let total = distanceMetersBetween(
    startPoint[0],
    startPoint[1],
    coords[startSegIdx + 1][0],
    coords[startSegIdx + 1][1]
  );
  for (let i = startSegIdx + 1; i < targetProg.segmentIndex; i++) {
    total += distanceMetersBetween(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  total += distanceMetersBetween(
    coords[targetProg.segmentIndex][0],
    coords[targetProg.segmentIndex][1],
    targetProg.snappedPoint[0],
    targetProg.snappedPoint[1]
  );
  return total;
}

function mapIconKind(type: string, modifier?: string): ManeuverIconKind {
  if (type === 'arrive') return 'arrive';
  if (type === 'depart') return 'depart';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    return 'roundabout';
  }
  switch (modifier) {
    case 'uturn':
      return 'uturn';
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'slight left':
      return 'slight-left';
    case 'slight right':
      return 'slight-right';
    case 'sharp left':
      return 'sharp-left';
    case 'sharp right':
      return 'sharp-right';
    case 'straight':
    default:
      return 'straight';
  }
}

function formatManeuverSpanish(
  type: string,
  modifier: string | undefined,
  streetName: string,
  exit?: number
): string {
  const cleanStreet = streetName.trim();
  const towardClause = cleanStreet ? ` hacia ${cleanStreet}` : '';
  const alongClause = cleanStreet ? ` por ${cleanStreet}` : '';

  if (type === 'arrive') {
    return cleanStreet ? `Llegaste a ${cleanStreet}` : 'Has llegado a tu destino';
  }

  if (type === 'depart') {
    return cleanStreet ? `Inicia por ${cleanStreet}` : 'Inicia el recorrido por la vía';
  }

  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    const exitText = exit ? `toma la ${exit}ª salida` : 'toma la salida indicada';
    return `En la rotonda, ${exitText}${towardClause}`;
  }

  if (modifier === 'uturn') {
    return `Haz un retorno en U${alongClause}`;
  }

  if (type === 'fork') {
    if (modifier === 'left' || modifier === 'slight left') {
      return `Toma el desvío a la izquierda${towardClause}`;
    }
    if (modifier === 'right' || modifier === 'slight right') {
      return `Toma el desvío a la derecha${towardClause}`;
    }
  }

  if (type === 'on ramp' || type === 'off ramp') {
    const prefix = type === 'off ramp' ? 'Toma la salida' : 'Incorpórate a la vía';
    if (modifier === 'left' || modifier === 'slight left') {
      return `${prefix} a la izquierda${towardClause}`;
    }
    if (modifier === 'right' || modifier === 'slight right') {
      return `${prefix} a la derecha${towardClause}`;
    }
    return `${prefix}${towardClause}`;
  }

  if (type === 'merge') {
    return `Incorpórate${towardClause}`;
  }

  if (type === 'end of road') {
    if (modifier === 'left' || modifier === 'slight left') {
      return `Al final de la vía, gira a la izquierda${towardClause}`;
    }
    if (modifier === 'right' || modifier === 'slight right') {
      return `Al final de la vía, gira a la derecha${towardClause}`;
    }
  }

  if (type === 'continue' || type === 'new name' || type === 'notification') {
    if (modifier === 'left') return `Gira a la izquierda${towardClause}`;
    if (modifier === 'right') return `Gira a la derecha${towardClause}`;
    if (modifier === 'slight left') return `Mantente ligeramente a la izquierda${alongClause}`;
    if (modifier === 'slight right') return `Mantente ligeramente a la derecha${alongClause}`;
    return `Continúa recto${alongClause}`;
  }

  // Standard turn
  switch (modifier) {
    case 'left':
      return `Gira a la izquierda${towardClause}`;
    case 'right':
      return `Gira a la derecha${towardClause}`;
    case 'slight left':
      return `Mantente a la izquierda${towardClause}`;
    case 'slight right':
      return `Mantente a la derecha${towardClause}`;
    case 'sharp left':
      return `Gira cerrado a la izquierda${towardClause}`;
    case 'sharp right':
      return `Gira cerrado a la derecha${towardClause}`;
    case 'straight':
    default:
      return `Sigue recto${alongClause}`;
  }
}

export async function fetchTurnByTurnRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  signal?: AbortSignal
): Promise<TurnByTurnRoute | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=false`;

  try {
    const timeoutSignal = AbortSignal.timeout(8000);
    const combinedSignal =
      signal && typeof (AbortSignal as any).any === 'function'
        ? (AbortSignal as any).any([signal, timeoutSignal])
        : signal || timeoutSignal;

    const res = await fetch(url, { signal: combinedSignal });
    if (!res.ok) return null;
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) return null;

    const coordinates: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    const rawSteps: any[] = route.legs?.[0]?.steps || [];
    const steps: RouteStepInstruction[] = rawSteps.map((step, idx) => {
      const mType: string = step.maneuver?.type || 'continue';
      const mModifier: string | undefined = step.maneuver?.modifier;
      const mLoc: [number, number] = step.maneuver?.location
        ? [step.maneuver.location[1], step.maneuver.location[0]]
        : coordinates[0];
      const stepGeom: [number, number][] = Array.isArray(step.geometry?.coordinates)
        ? step.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng])
        : [mLoc];
      const streetName = typeof step.name === 'string' ? step.name : '';

      return {
        id: `step-${idx}-${mType}`,
        instruction: formatManeuverSpanish(mType, mModifier, streetName, step.maneuver?.exit),
        streetName,
        distanceMeters: Math.round(step.distance || 0),
        durationSeconds: Math.round(step.duration || 0),
        maneuverLocation: mLoc,
        geometry: stepGeom,
        iconKind: mapIconKind(mType, mModifier),
        bearingAfter: typeof step.maneuver?.bearing_after === 'number' ? step.maneuver.bearing_after : 0,
      };
    });

    return {
      coordinates,
      totalDistanceMeters: Math.round(route.distance || 0),
      totalDurationSeconds: Math.round(route.duration || 0),
      steps,
    };
  } catch {
    return null;
  }
}

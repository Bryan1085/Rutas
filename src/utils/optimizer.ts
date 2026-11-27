import { DeliveryItem, GpsPosition } from '../types';
import { calculateDistanceKm } from './whatsappParser';

export interface OptimizationResult {
  optimizedItems: DeliveryItem[];
  totalDistanceKm: number;
  totalMinutes: number;
  usedRoadNetwork?: boolean;
}

interface CoordPoint {
  lat: number;
  lng: number;
}

const osrmTripCache: Record<string, { orderIds: string[]; legDistKm: number[]; legMinutes: number[] }> = {};

export function isActiveRoutableItem(item: DeliveryItem): boolean {
  return (
    (item.status === 'pending' || item.status === 'in_transit') &&
    item.coverageStatus === 'in_coverage' &&
    item.hasLocation !== false &&
    Number.isFinite(item.lat) &&
    Number.isFinite(item.lng)
  );
}

/**
 * Stable signature representing active located stops + coarse GPS origin (~500m).
 * Used to avoid re-running route optimization unless stop locations or GPS zone change.
 */
export function buildCircuitSignature(
  items: DeliveryItem[],
  currentGps: GpsPosition | null
): string {
  const gpsPart = currentGps
    ? `${(Math.round(currentGps.lat * 200) / 200).toFixed(3)},${(Math.round(currentGps.lng * 200) / 200).toFixed(3)}`
    : 'no-gps';

  const activePart = items
    .filter(isActiveRoutableItem)
    .map((i) => `${i.id}:${i.lat.toFixed(4)},${i.lng.toFixed(4)}`)
    .sort()
    .join('|');

  return `${gpsPart}__${activePart}`;
}

function pointDist(a: CoordPoint, b: CoordPoint): number {
  return calculateDistanceKm(a.lat, a.lng, b.lat, b.lng);
}

/**
 * Closed-loop 2-Opt + Or-Opt TSP circuit builder.
 * Index 0 of `cycle` is kept fixed as anchor (`origin` when GPS exists, or starting stop).
 */
function improveClosedCycle(nodes: CoordPoint[], cycleInput: number[]): number[] {
  const n = cycleInput.length;
  if (n <= 3) return cycleInput;

  const cycle = [...cycleInput];
  const d = (idxA: number, idxB: number) => pointDist(nodes[idxA], nodes[idxB]);

  let improved = true;
  let iterations = 0;
  while (improved && iterations < 80) {
    improved = false;
    iterations++;

    // 2-Opt: eliminate crossing edges in the closed circuit
    for (let i = 0; i < n - 1; i++) {
      const a = cycle[i];
      const b = cycle[(i + 1) % n];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const c = cycle[j];
        const dNode = cycle[(j + 1) % n];

        const before = d(a, b) + d(c, dNode);
        const after = d(a, c) + d(b, dNode);
        if (after + 1e-6 < before) {
          // Reverse segment [i+1 .. j]
          let left = i + 1;
          let right = j;
          while (left < right) {
            const tmp = cycle[left];
            cycle[left] = cycle[right];
            cycle[right] = tmp;
            left++;
            right--;
          }
          improved = true;
        }
      }
    }

    // Or-Opt (single-node relocation): smoothly snap outliers onto outbound or return leg
    for (let i = 1; i < n; i++) {
      const prev = cycle[i - 1];
      const curr = cycle[i];
      const next = cycle[(i + 1) % n];
      const removeGain = d(prev, curr) + d(curr, next) - d(prev, next);

      let bestPos = -1;
      let bestCost = removeGain - 1e-6;

      for (let j = 0; j < n; j++) {
        if (j === i || j === i - 1) continue;
        const u = cycle[j];
        const v = cycle[(j + 1) % n];
        const insertCost = d(u, curr) + d(curr, v) - d(u, v);
        if (insertCost < bestCost) {
          bestCost = insertCost;
          bestPos = j;
        }
      }

      if (bestPos !== -1) {
        const [moved] = cycle.splice(i, 1);
        const insertAt = bestPos > i ? bestPos : bestPos + 1;
        cycle.splice(insertAt, 0, moved);
        improved = true;
        break;
      }
    }
  }

  return cycle;
}

/**
 * Builds an initial closed loop using Cheapest Insertion seeded with (anchor -> farthest),
 * creating an out-and-back circuit spine before 2-Opt refinement.
 */
function buildClosedCircuitOrder(stops: DeliveryItem[], origin: GpsPosition | null): DeliveryItem[] {
  const count = stops.length;
  if (count <= 1) return [...stops];
  if (count === 2) {
    if (!origin) return [...stops];
    const d0 = pointDist(origin, stops[0]);
    const d1 = pointDist(origin, stops[1]);
    return d0 <= d1 ? [stops[0], stops[1]] : [stops[1], stops[0]];
  }

  if (origin) {
    // nodes[0] = GPS origin, nodes[1..count] = stops[0..count-1]
    const nodes: CoordPoint[] = [{ lat: origin.lat, lng: origin.lng }, ...stops];

    // Seed spine: origin -> nearest stop -> farthest stop -> origin
    let nearestIdx = 1;
    let minD = Infinity;
    let farthestIdx = 1;
    let maxD = -1;

    for (let idx = 1; idx < nodes.length; idx++) {
      const dist = pointDist(nodes[0], nodes[idx]);
      if (dist < minD) {
        minD = dist;
        nearestIdx = idx;
      }
      if (dist > maxD) {
        maxD = dist;
        farthestIdx = idx;
      }
    }

    const cycle: number[] =
      nearestIdx === farthestIdx ? [0, nearestIdx] : [0, nearestIdx, farthestIdx];
    const inCycle = new Set<number>(cycle);

    while (inCycle.size < nodes.length) {
      let bestNode = -1;
      let bestInsertPos = 1;
      let bestDelta = Infinity;

      for (let cand = 1; cand < nodes.length; cand++) {
        if (inCycle.has(cand)) continue;
        for (let pos = 0; pos < cycle.length; pos++) {
          const u = nodes[cycle[pos]];
          const v = nodes[cycle[(pos + 1) % cycle.length]];
          const delta = pointDist(u, nodes[cand]) + pointDist(nodes[cand], v) - pointDist(u, v);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestNode = cand;
            bestInsertPos = pos + 1;
          }
        }
      }

      if (bestNode === -1) break;
      cycle.splice(bestInsertPos, 0, bestNode);
      inCycle.add(bestNode);
    }

    const refined = improveClosedCycle(nodes, cycle);
    // Rotate so origin (0) is at index 0
    const zeroPos = refined.indexOf(0);
    const rotated = [...refined.slice(zeroPos), ...refined.slice(0, zeroPos)];
    const forwardStops = rotated.slice(1).map((nodeIdx) => stops[nodeIdx - 1]);
    const reverseStops = [...forwardStops].reverse();

    // Pick orientation that minimizes total open path from origin (s1 -> ... -> sk),
    // breaking ties by visiting the closer outbound stop first and looping back near origin.
    const openDist = (seq: DeliveryItem[]) => {
      let sum = pointDist(origin, seq[0]);
      for (let i = 1; i < seq.length; i++) {
        sum += pointDist(seq[i - 1], seq[i]);
      }
      return sum;
    };

    const fDist = openDist(forwardStops);
    const rDist = openDist(reverseStops);
    if (Math.abs(fDist - rDist) < 0.05) {
      return pointDist(origin, forwardStops[0]) <= pointDist(origin, reverseStops[0])
        ? forwardStops
        : reverseStops;
    }
    return fDist <= rDist ? forwardStops : reverseStops;
  }

  // No GPS origin: build closed circuit over stops alone, then cut along longest gap
  const nodes: CoordPoint[] = [...stops];
  let seedA = 0;
  let seedB = 1;
  let maxPair = -1;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const dist = pointDist(nodes[i], nodes[j]);
      if (dist > maxPair) {
        maxPair = dist;
        seedA = i;
        seedB = j;
      }
    }
  }

  const cycle: number[] = [seedA, seedB];
  const inCycle = new Set<number>(cycle);
  while (inCycle.size < count) {
    let bestNode = -1;
    let bestInsertPos = 1;
    let bestDelta = Infinity;
    for (let cand = 0; cand < count; cand++) {
      if (inCycle.has(cand)) continue;
      for (let pos = 0; pos < cycle.length; pos++) {
        const u = nodes[cycle[pos]];
        const v = nodes[cycle[(pos + 1) % cycle.length]];
        const delta = pointDist(u, nodes[cand]) + pointDist(nodes[cand], v) - pointDist(u, v);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestNode = cand;
          bestInsertPos = pos + 1;
        }
      }
    }
    if (bestNode === -1) break;
    cycle.splice(bestInsertPos, 0, bestNode);
    inCycle.add(bestNode);
  }

  const refined = improveClosedCycle(nodes, cycle);

  // Cut the closed loop at its longest edge so the driver never doubles back across the biggest gap
  let longestEdgeIdx = 0;
  let longestEdgeDist = -1;
  for (let i = 0; i < refined.length; i++) {
    const u = nodes[refined[i]];
    const v = nodes[refined[(i + 1) % refined.length]];
    const d = pointDist(u, v);
    if (d > longestEdgeDist) {
      longestEdgeDist = d;
      longestEdgeIdx = i;
    }
  }

  const startAt = (longestEdgeIdx + 1) % refined.length;
  const cutSeq = [...refined.slice(startAt), ...refined.slice(0, startAt)].map((idx) => stops[idx]);
  return cutSeq;
}

function finalizeOptimizedList(
  sortedInCoverage: DeliveryItem[],
  otherItems: DeliveryItem[],
  currentGps: GpsPosition | null,
  legDistKm?: number[],
  legMinutes?: number[],
  usedRoadNetwork = false
): OptimizationResult {
  let runningDist = 0;
  let runningMins = 0;
  let lastLat = currentGps ? currentGps.lat : sortedInCoverage[0]?.lat || 0;
  let lastLng = currentGps ? currentGps.lng : sortedInCoverage[0]?.lng || 0;

  const updatedActive = sortedInCoverage.map((item, idx) => {
    const legDist =
      legDistKm && Number.isFinite(legDistKm[idx])
        ? legDistKm[idx]
        : idx === 0 && !currentGps
        ? 0
        : calculateDistanceKm(lastLat, lastLng, item.lat, item.lng);

    const estMin =
      legMinutes && Number.isFinite(legMinutes[idx])
        ? legMinutes[idx]
        : idx === 0 && !currentGps
        ? 3
        : Math.max(3, Math.round((legDist / 30) * 60) + 3);

    runningDist += legDist;
    runningMins += estMin;
    lastLat = item.lat;
    lastLng = item.lng;

    return {
      ...item,
      orderIndex: idx,
      distanceFromPrevKm: Math.round(legDist * 10) / 10,
      estimatedMinutes: estMin,
    };
  });

  const updatedOther = otherItems.map((item, offset) => ({
    ...item,
    orderIndex: updatedActive.length + offset,
    distanceFromPrevKm: undefined,
    estimatedMinutes: undefined,
  }));

  return {
    optimizedItems: [...updatedActive, ...updatedOther],
    totalDistanceKm: Math.round(runningDist * 10) / 10,
    totalMinutes: runningMins,
    usedRoadNetwork,
  };
}

/**
 * Synchronous Closed-Circuit Route Optimizer (Cheapest Insertion + 2-Opt + Or-Opt).
 * Groups outbound stops ("ida") along one corridor and return stops ("vuelta") on the opposite side
 * to form a non-crossing loop without backtracking on the same streets.
 */
export function optimizeRoute(
  items: DeliveryItem[],
  currentGps: GpsPosition | null
): OptimizationResult {
  if (!items || items.length === 0) {
    return { optimizedItems: [], totalDistanceKm: 0, totalMinutes: 0 };
  }

  const inCoveragePending = items.filter(isActiveRoutableItem);
  const otherItems = items.filter((item) => !isActiveRoutableItem(item));

  if (inCoveragePending.length === 0) {
    const preserved = otherItems.map((item, idx) => ({
      ...item,
      orderIndex: idx,
      distanceFromPrevKm: undefined,
      estimatedMinutes: undefined,
    }));
    return { optimizedItems: preserved, totalDistanceKm: 0, totalMinutes: 0 };
  }

  const sortedInCoverage = buildClosedCircuitOrder(inCoveragePending, currentGps);
  return finalizeOptimizedList(sortedInCoverage, otherItems, currentGps);
}

/**
 * Real-street Road Circuit Optimizer via OSRM Trip API (`/trip/v1/driving/`).
 * Respects one-way streets, highways, and real driving topology in Costa Rica,
 * seamlessly falling back to 2-Opt `optimizeRoute()` when offline or on error.
 */
export async function optimizeCircuitByRoad(
  items: DeliveryItem[],
  currentGps: GpsPosition | null,
  signal?: AbortSignal
): Promise<OptimizationResult> {
  const fallback = optimizeRoute(items, currentGps);
  const inCoveragePending = items.filter(isActiveRoutableItem);
  const otherItems = items.filter((item) => !isActiveRoutableItem(item));

  if (inCoveragePending.length < 2 || inCoveragePending.length > 45) {
    return fallback;
  }

  const cacheKey = buildCircuitSignature(items, currentGps);
  const cached = osrmTripCache[cacheKey];
  if (cached) {
    const byId: Record<string, DeliveryItem> = {};
    inCoveragePending.forEach((item) => {
      byId[item.id] = item;
    });
    const ordered = cached.orderIds.map((id) => byId[id]).filter(Boolean);
    if (ordered.length === inCoveragePending.length) {
      return finalizeOptimizedList(
        ordered,
        otherItems,
        currentGps,
        cached.legDistKm,
        cached.legMinutes,
        true
      );
    }
  }

  try {
    const hasGps = Boolean(currentGps);
    const inputPoints: CoordPoint[] = hasGps && currentGps
      ? [{ lat: currentGps.lat, lng: currentGps.lng }, ...inCoveragePending]
      : [...inCoveragePending];

    const coordParam = inputPoints.map((p) => `${p.lng},${p.lat}`).join(';');
    const osrmTripUrl = hasGps
      ? `https://router.project-osrm.org/trip/v1/driving/${coordParam}?source=first&roundtrip=true&overview=false`
      : `https://router.project-osrm.org/trip/v1/driving/${coordParam}?roundtrip=true&overview=false`;

    const timeoutSignal = AbortSignal.timeout(6500);
    const combinedSignal =
      signal && typeof (AbortSignal as any).any === 'function'
        ? (AbortSignal as any).any([signal, timeoutSignal])
        : signal || timeoutSignal;

    const res = await fetch(osrmTripUrl, { signal: combinedSignal });
    if (!res.ok) return fallback;

    const data = await res.json();
    if (data?.code !== 'Ok' || !Array.isArray(data.waypoints) || !data.trips?.[0]) {
      return fallback;
    }

    const waypoints: Array<{ waypoint_index: number }> = data.waypoints;
    const tripLegs: Array<{ distance?: number; duration?: number }> = data.trips[0].legs || [];

    if (hasGps) {
      // Position 0 is currentGps; remaining waypoints ordered by tour waypoint_index
      const indexedStops = inCoveragePending.map((item, idx) => ({
        item,
        tourPos: waypoints[idx + 1]?.waypoint_index ?? idx + 1,
      }));
      indexedStops.sort((a, b) => a.tourPos - b.tourPos);

      const orderedStops = indexedStops.map((s) => s.item);
      const legDistKm = orderedStops.map((_, idx) =>
        Math.round(((tripLegs[idx]?.distance || 0) / 1000) * 10) / 10
      );
      const legMinutes = orderedStops.map((_, idx) =>
        Math.max(2, Math.round((tripLegs[idx]?.duration || 0) / 60))
      );

      osrmTripCache[cacheKey] = {
        orderIds: orderedStops.map((s) => s.id),
        legDistKm,
        legMinutes,
      };

      return finalizeOptimizedList(orderedStops, otherItems, currentGps, legDistKm, legMinutes, true);
    }

    // No GPS: order closed cycle by waypoint_index, then cut at longest driving leg
    const cycleStops = inCoveragePending
      .map((item, idx) => ({
        item,
        tourPos: waypoints[idx]?.waypoint_index ?? idx,
      }))
      .sort((a, b) => a.tourPos - b.tourPos)
      .map((s) => s.item);

    let longestLegIdx = cycleStops.length - 1;
    let longestDuration = -1;
    if (tripLegs.length === cycleStops.length) {
      tripLegs.forEach((leg, idx) => {
        const dur = leg?.duration ?? leg?.distance ?? 0;
        if (dur > longestDuration) {
          longestDuration = dur;
          longestLegIdx = idx;
        }
      });
    }

    const startAt = (longestLegIdx + 1) % cycleStops.length;
    const cutStops = [...cycleStops.slice(startAt), ...cycleStops.slice(0, startAt)];

    const cutLegs =
      tripLegs.length === cycleStops.length
        ? [...tripLegs.slice(startAt), ...tripLegs.slice(0, startAt)]
        : [];

    const legDistKm = cutStops.map((_, idx) => {
      if (idx === 0) return 0;
      const d = cutLegs[idx - 1]?.distance;
      return typeof d === 'number' ? Math.round((d / 1000) * 10) / 10 : 0;
    });
    const legMinutes = cutStops.map((_, idx) => {
      if (idx === 0) return 3;
      const dur = cutLegs[idx - 1]?.duration;
      return typeof dur === 'number' ? Math.max(2, Math.round(dur / 60)) : 4;
    });

    osrmTripCache[cacheKey] = {
      orderIds: cutStops.map((s) => s.id),
      legDistKm,
      legMinutes,
    };

    return finalizeOptimizedList(cutStops, otherItems, currentGps, legDistKm, legMinutes, true);
  } catch {
    return fallback;
  }
}

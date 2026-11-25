import { DeliveryItem, GpsPosition } from '../types';
import { calculateDistanceKm } from './whatsappParser';

interface OptimizationResult {
  optimizedItems: DeliveryItem[];
  totalDistanceKm: number;
  totalMinutes: number;
}

export function optimizeRoute(
  items: DeliveryItem[],
  currentGps: GpsPosition | null
): OptimizationResult {
  if (!items || items.length === 0) {
    return { optimizedItems: [], totalDistanceKm: 0, totalMinutes: 0 };
  }

  // Separate in-coverage pending/in_transit items (with valid location) from out-of-coverage, incomplete, and finished items
  const inCoveragePending = items.filter(
    item =>
      (item.status === 'pending' || item.status === 'in_transit') &&
      item.coverageStatus === 'in_coverage' &&
      item.hasLocation !== false
  );

  const otherItems = items.filter(
    item =>
      item.hasLocation === false ||
      item.coverageStatus !== 'in_coverage' ||
      item.status === 'delivered' ||
      item.status === 'failed'
  );

  if (inCoveragePending.length <= 1) {
    let runningDist = 0;
    let lastLat = currentGps ? currentGps.lat : (inCoveragePending[0]?.lat || 0);
    let lastLng = currentGps ? currentGps.lng : (inCoveragePending[0]?.lng || 0);

    const updated = items.map((item, idx) => {
      if (item.hasLocation === false || item.coverageStatus === 'incomplete') {
        return { ...item, orderIndex: idx, distanceFromPrevKm: undefined, estimatedMinutes: undefined };
      }
      const dist = calculateDistanceKm(lastLat, lastLng, item.lat, item.lng);
      runningDist += dist;
      lastLat = item.lat;
      lastLng = item.lng;
      return {
        ...item,
        orderIndex: idx,
        distanceFromPrevKm: Math.round(dist * 10) / 10,
        estimatedMinutes: Math.max(3, Math.round((dist / 30) * 60))
      };
    });

    const totalMinutes = updated.reduce((acc, curr) => acc + (curr.estimatedMinutes || 5), 0);
    return {
      optimizedItems: updated,
      totalDistanceKm: Math.round(runningDist * 10) / 10,
      totalMinutes
    };
  }

  let startLat = currentGps ? currentGps.lat : inCoveragePending[0].lat;
  let startLng = currentGps ? currentGps.lng : inCoveragePending[0].lng;

  const unvisited = [...inCoveragePending];
  const sortedInCoverage: DeliveryItem[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistanceKm(currentLat, currentLng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextItem = unvisited.splice(nearestIdx, 1)[0];
    sortedInCoverage.push(nextItem);
    currentLat = nextItem.lat;
    currentLng = nextItem.lng;
  }

  // Combine other items (out of coverage, delivered, failed) with sorted in-coverage items
  const combined = [...otherItems, ...sortedInCoverage];

  let runningDist = 0;
  let lastLat = currentGps ? currentGps.lat : (sortedInCoverage[0]?.lat || 0);
  let lastLng = currentGps ? currentGps.lng : (sortedInCoverage[0]?.lng || 0);

  const finalOptimized = combined.map((item, idx) => {
    if (item.hasLocation === false || item.coverageStatus === 'incomplete') {
      return {
        ...item,
        orderIndex: idx,
        distanceFromPrevKm: undefined,
        estimatedMinutes: undefined
      };
    }
    const dist = calculateDistanceKm(lastLat, lastLng, item.lat, item.lng);
    runningDist += dist;
    lastLat = item.lat;
    lastLng = item.lng;
    const estMin = Math.max(3, Math.round((dist / 30) * 60) + 4);
    return {
      ...item,
      orderIndex: idx,
      distanceFromPrevKm: Math.round(dist * 10) / 10,
      estimatedMinutes: estMin
    };
  });

  const totalMinutes = finalOptimized.reduce((acc, curr) => acc + (curr.estimatedMinutes || 5), 0);

  return {
    optimizedItems: finalOptimized,
    totalDistanceKm: Math.round(runningDist * 10) / 10,
    totalMinutes
  };
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DeliveryItem, GpsPosition } from '../types';
import {
  Navigation,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  Route as RouteIcon,
  Loader2,
  MessageCircle,
  Camera,
  MapPin,
  X
} from 'lucide-react';
import { buildWhatsAppUrl, buildLocationRequestMessage, calculateDistanceKm } from '../utils/whatsappParser';

interface FreeMapViewProps {
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  remoteDrivers?: { id: string; driverName: string; lat: number; lng: number }[];
}

interface RouteOverlayInfo {
  distanceKm: number;
  durationMinutes: number;
  stopsCount: number;
}

const osrmCache: Record<string, { coords: [number, number][]; summary: RouteOverlayInfo }> = {};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const FreeMapView: React.FC<FreeMapViewProps> = ({
  items,
  currentGps,
  selectedPackageId,
  onUpdateStatus,
  onOpenPhotoModal,
  remoteDrivers = []
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const lastGpsOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);

  const [selectedItem, setSelectedItem] = useState<DeliveryItem | null>(null);
  const [routeStatus, setRouteStatus] = useState<{
    loading: boolean;
    error: string | null;
    summary: RouteOverlayInfo | null;
  }>({ loading: false, error: null, summary: null });

  const locatedItems = useMemo(
    () => items.filter((item) => item.hasLocation !== false && item.coverageStatus !== 'incomplete'),
    [items]
  );

  const visibleItems = useMemo(
    () => locatedItems.filter((item) => item.status !== 'delivered'),
    [locatedItems]
  );

  const activeRouteItems = useMemo(
    () =>
      items
        .filter(
          (i) =>
            (i.status === 'pending' || i.status === 'in_transit') &&
            i.coverageStatus === 'in_coverage' &&
            i.hasLocation !== false
        )
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [items]
  );

  const stableGpsOrigin = useMemo(() => {
    if (!currentGps) return null;
    const prev = lastGpsOriginRef.current;
    if (!prev || calculateDistanceKm(prev.lat, prev.lng, currentGps.lat, currentGps.lng) > 0.4) {
      const next = { lat: currentGps.lat, lng: currentGps.lng };
      lastGpsOriginRef.current = next;
      return next;
    }
    return prev;
  }, [currentGps]);

  const routeStopsKey = useMemo(() => {
    const gpsPart = stableGpsOrigin
      ? `${stableGpsOrigin.lat.toFixed(3)},${stableGpsOrigin.lng.toFixed(3)}`
      : 'no-gps';
    const stopsPart = activeRouteItems
      .map((i) => `${i.id}:${i.lat.toFixed(4)},${i.lng.toFixed(4)}`)
      .join('|');
    return `${gpsPart}__${stopsPart}`;
  }, [stableGpsOrigin, activeRouteItems]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = currentGps
      ? [currentGps.lat, currentGps.lng]
      : locatedItems.length > 0
      ? [locatedItems[0].lat, locatedItems[0].lng]
      : [9.9281, -84.0907];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const routeLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    routeLayerRef.current = routeLayer;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      routeLayerRef.current = null;
      markersLayerRef.current = null;
      hasFittedBoundsRef.current = false;
    };
  }, []);

  // Pan to selected package from list
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPackageId) return;
    const target = items.find(
      (i) => i.id === selectedPackageId && i.hasLocation !== false && i.coverageStatus !== 'incomplete'
    );
    if (target) {
      map.setView([target.lat, target.lng], 16, { animate: true });
      setSelectedItem(target);
    }
  }, [selectedPackageId, items]);

  // Keep selectedItem synced if status updates
  useEffect(() => {
    if (!selectedItem) return;
    const latest = items.find((i) => i.id === selectedItem.id);
    if (!latest || latest.status === 'delivered') {
      setSelectedItem(null);
    } else {
      setSelectedItem(latest);
    }
  }, [items]);

  // Render markers (GPS, Remote Drivers, Packages)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();
    const boundsPoints: [number, number][] = [];

    if (currentGps) {
      boundsPoints.push([currentGps.lat, currentGps.lng]);
      const gpsIcon = L.divIcon({
        className: '',
        html: `<div style="width:36px;height:36px;background:#2563eb;border:3px solid #ffffff;border-radius:9999px;box-shadow:0 6px 14px rgba(37,99,235,0.45);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px;">GPS</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      L.marker([currentGps.lat, currentGps.lng], { icon: gpsIcon, title: 'Tu Ubicación GPS' }).addTo(markersLayer);
    }

    remoteDrivers.forEach((driver) => {
      boundsPoints.push([driver.lat, driver.lng]);
      const driverIcon = L.divIcon({
        className: '',
        html: `<div style="background:#4f46e5;color:#fff;padding:4px 10px;border-radius:14px;border:2px solid #fff;box-shadow:0 6px 14px rgba(0,0,0,0.25);font-size:11px;font-weight:800;white-space:nowrap;">${escapeHtml(driver.driverName)}</div>`,
        iconSize: [90, 26],
        iconAnchor: [45, 13]
      });
      L.marker([driver.lat, driver.lng], {
        icon: driverIcon,
        title: `Conductor: ${driver.driverName}`
      }).addTo(markersLayer);
    });

    visibleItems.forEach((item) => {
      boundsPoints.push([item.lat, item.lng]);
      const bg =
        item.coverageStatus === 'out_of_coverage'
          ? '#dc2626'
          : item.status === 'in_transit'
          ? '#2563eb'
          : item.status === 'failed'
          ? '#ea580c'
          : '#059669';

      const pkgIcon = L.divIcon({
        className: '',
        html: `<div style="width:38px;height:38px;background:${bg};color:#fff;border:3px solid #fff;border-radius:14px;box-shadow:0 6px 14px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;cursor:pointer;">#${item.originalNumber}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const marker = L.marker([item.lat, item.lng], {
        icon: pkgIcon,
        title: `Paquete #${item.originalNumber} - ${item.address}`
      });
      marker.on('click', () => {
        setSelectedItem(item);
      });
      marker.addTo(markersLayer);
    });

    if (!hasFittedBoundsRef.current && boundsPoints.length > 1) {
      hasFittedBoundsRef.current = true;
      map.fitBounds(boundsPoints, { padding: [45, 45], maxZoom: 15 });
    }
  }, [currentGps, remoteDrivers, visibleItems]);

  // Draw road route via free OSRM public server (cached per routeStopsKey)
  useEffect(() => {
    const routeLayer = routeLayerRef.current;
    if (!routeLayer) return;

    routeLayer.clearLayers();

    const hasGpsOrigin = Boolean(stableGpsOrigin);
    if (activeRouteItems.length === 0 || (!hasGpsOrigin && activeRouteItems.length < 2)) {
      setRouteStatus({ loading: false, error: null, summary: null });
      return;
    }

    const waypoints: { lat: number; lng: number }[] = [
      ...(stableGpsOrigin ? [{ lat: stableGpsOrigin.lat, lng: stableGpsOrigin.lng }] : []),
      ...activeRouteItems.slice(0, 25).map((i) => ({ lat: i.lat, lng: i.lng }))
    ];

    const cached = osrmCache[routeStopsKey];
    if (cached) {
      L.polyline(cached.coords, {
        color: '#059669',
        weight: 5,
        opacity: 0.9
      }).addTo(routeLayer);
      setRouteStatus({ loading: false, error: null, summary: cached.summary });
      return;
    }

    let cancelled = false;
    setRouteStatus({ loading: true, error: null, summary: null });

    const coordParam = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordParam}?overview=full&geometries=geojson`;

    fetch(osrmUrl, { signal: AbortSignal.timeout(8000) })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          const latLngs: [number, number][] = route.geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          const summary: RouteOverlayInfo = {
            distanceKm: Math.round(((route.distance || 0) / 1000) * 10) / 10,
            durationMinutes: Math.max(1, Math.round((route.duration || 0) / 60)),
            stopsCount: activeRouteItems.length
          };
          osrmCache[routeStopsKey] = { coords: latLngs, summary };

          L.polyline(latLngs, {
            color: '#059669',
            weight: 5,
            opacity: 0.9
          }).addTo(routeLayer);
          setRouteStatus({ loading: false, error: null, summary });
        } else {
          // Straight-line fallback
          const fallbackCoords: [number, number][] = waypoints.map((p) => [p.lat, p.lng]);
          L.polyline(fallbackCoords, {
            color: '#059669',
            weight: 4,
            dashArray: '8, 8',
            opacity: 0.8
          }).addTo(routeLayer);
          setRouteStatus({ loading: false, error: null, summary: null });
        }
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackCoords: [number, number][] = waypoints.map((p) => [p.lat, p.lng]);
        L.polyline(fallbackCoords, {
          color: '#059669',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.8
        }).addTo(routeLayer);
        setRouteStatus({ loading: false, error: null, summary: null });
      });

    return () => {
      cancelled = true;
    };
  }, [routeStopsKey]);

  const waUrl = selectedItem ? buildWhatsAppUrl(selectedItem.phone) : null;
  const waPresetUrl = selectedItem
    ? buildWhatsAppUrl(selectedItem.phone, buildLocationRequestMessage(selectedItem.originalNumber))
    : null;

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-3xl overflow-hidden shadow-xl border-2 border-emerald-500/20">
      {/* Route Calculation Status Overlay */}
      {routeStatus.loading && (
        <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-emerald-200 text-emerald-900 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 text-xs font-bold">
          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
          <span>Calculando ruta gratuita...</span>
        </div>
      )}

      {!routeStatus.loading && routeStatus.summary && (
        <div className="absolute top-3 left-14 z-[400] bg-white/95 backdrop-blur-xs border border-emerald-200 text-gray-900 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2.5 text-xs">
          <RouteIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-emerald-800">
            Ruta vial: {routeStatus.summary.distanceKm} km • ~{routeStatus.summary.durationMinutes} min
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600 font-medium">{routeStatus.summary.stopsCount} paradas</span>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />

      {/* Selected Package Floating Info Card */}
      {selectedItem && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 z-[450] bg-white rounded-2xl shadow-2xl border border-gray-200 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center shadow-xs">
                #{selectedItem.originalNumber}
              </span>
              <span className="text-xs font-semibold text-gray-500 uppercase">
                {selectedItem.province || 'Costa Rica'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  selectedItem.coverageStatus === 'out_of_coverage'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {selectedItem.coverageStatus === 'out_of_coverage' ? 'Fuera de Cobertura' : 'En Cobertura'}
              </span>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-900 line-clamp-2">{selectedItem.address}</p>
            {selectedItem.phone && (
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">Tel: {selectedItem.phone}</p>
            )}
            {selectedItem.coverageStatus === 'out_of_coverage' ? (
              <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Fuera de zona autorizada.</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 mt-0.5">Orden en ruta: #{selectedItem.orderIndex + 1}</p>
            )}
          </div>

          <div className="space-y-1.5">
            {waUrl && (
              <div className="flex items-center gap-1.5">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
                {waPresetUrl && (
                  <a
                    href={waPresetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300 py-1.5 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-green-700" />
                    <span>Pedir ubic.</span>
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <a
                href={`https://waze.com/ul?ll=${selectedItem.lat},${selectedItem.lng}&navigate=yes`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-sky-500 hover:bg-sky-600 text-white py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Navigation className="w-3.5 h-3.5 transform rotate-45" />
                <span>Waze</span>
              </a>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedItem.lat},${selectedItem.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Maps</span>
              </a>
            </div>

            {selectedItem.coverageStatus === 'in_coverage' && (
              <div className="space-y-1.5 pt-0.5">
                <button
                  onClick={() => {
                    onOpenPhotoModal(selectedItem);
                    setSelectedItem(null);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{selectedItem.deliveryPhoto ? 'Ver / Reenviar Foto' : 'Foto de Entrega'}</span>
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedItem.id, 'delivered');
                      setSelectedItem(null);
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border border-emerald-200"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Entregar</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedItem.id, 'failed');
                      setSelectedItem(null);
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-800 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border border-red-200"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Fallida</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

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
  X,
  Volume2
} from 'lucide-react';
import { buildWhatsAppUrl, buildLocationRequestMessage, calculateDistanceKm } from '../utils/whatsappParser';
import { buildPackageAnnouncement, speakText } from '../utils/speechUtils';

interface FreeMapViewProps {
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onClearSelectedPackage?: () => void;
  speakerEnabled?: boolean;
  autoReadOnMapPin?: boolean;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  onStartInAppNavigation?: (focusItem?: DeliveryItem) => void;
}

interface RouteOverlayInfo {
  distanceKm: number;
  durationMinutes: number;
  stopsCount: number;
}

const osrmCache: Record<string, { coords: [number, number][]; summary: RouteOverlayInfo }> = {};

function addCircuitDirectionArrows(coords: [number, number][], layer: L.LayerGroup) {
  if (coords.length < 2) return;
  const stepMeters = 650;
  let accumulatedMeters = stepMeters * 0.45;

  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1];
    const [lat2, lng2] = coords[i];
    const segDistMeters = L.latLng(lat1, lng1).distanceTo(L.latLng(lat2, lng2));
    if (segDistMeters < 15) continue;

    accumulatedMeters += segDistMeters;
    if (accumulatedMeters >= stepMeters) {
      accumulatedMeters = 0;
      const midLat = (lat1 + lat2) / 2;
      const midLng = (lng1 + lng2) / 2;
      // Compute screen-space angle (lat is up, lng*cos(lat) is right)
      const cosLat = Math.cos((midLat * Math.PI) / 180);
      const dx = (lng2 - lng1) * cosLat;
      const dy = lat2 - lat1;
      const angleDeg = (Math.atan2(dx, dy) * 180) / Math.PI;

      const arrowIcon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;display:flex;align-items:center;justify-content:center;transform:rotate(${angleDeg.toFixed(1)}deg);pointer-events:none;"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L14 13L8 10L2 13L8 1Z" fill="#047857" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/></svg></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([midLat, midLng], { icon: arrowIcon, interactive: false, keyboard: false }).addTo(layer);
    }
  }
}

export const FreeMapView: React.FC<FreeMapViewProps> = ({
  items,
  currentGps,
  selectedPackageId,
  onClearSelectedPackage,
  speakerEnabled = false,
  autoReadOnMapPin = true,
  onUpdateStatus,
  onOpenPhotoModal,
  onStartInAppNavigation
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const lastGpsOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const hasFittedBoundsRef = useRef<boolean>(false);
  const itemsRef = useRef<DeliveryItem[]>(items);
  itemsRef.current = items;

  const [selectedItem, setSelectedItem] = useState<DeliveryItem | null>(null);
  const speakerEnabledRef = useRef<boolean>(speakerEnabled);
  speakerEnabledRef.current = speakerEnabled;
  const autoReadOnMapPinRef = useRef<boolean>(autoReadOnMapPin);
  autoReadOnMapPinRef.current = autoReadOnMapPin;
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

    map.on('click', () => {
      setSelectedItem(null);
    });

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

  // Pan to selected package from list once without re-triggering on items updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPackageId) return;
    const target = itemsRef.current.find(
      (i) =>
        i.id === selectedPackageId &&
        i.hasLocation !== false &&
        i.coverageStatus !== 'incomplete' &&
        Number.isFinite(i.lat) &&
        Number.isFinite(i.lng)
    );
    if (target) {
      map.setView([target.lat, target.lng], 16, { animate: true });
      setSelectedItem(target);
    }
    onClearSelectedPackage?.();
  }, [selectedPackageId]);

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
      const headingDeg =
        typeof currentGps.heading === 'number' && Number.isFinite(currentGps.heading)
          ? currentGps.heading
          : 0;
      const vehicleTriangleIcon = L.divIcon({
        className: '',
        html: `<div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 5px 12px rgba(2,132,199,0.5));transform:rotate(${headingDeg.toFixed(1)}deg);">
          <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#ffffff" fill-opacity="0.96" stroke="#0284c7" stroke-width="2.5"/>
            <path d="M20 7L30 29L20 24.5L10 29L20 7Z" fill="#0284c7" stroke="#0369a1" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21]
      });
      L.marker([currentGps.lat, currentGps.lng], {
        icon: vehicleTriangleIcon,
        zIndexOffset: 900,
        title: 'Tu Vehículo'
      }).addTo(markersLayer);
    }

    const activeSeqById: Record<string, number> = {};
    activeRouteItems.forEach((item, idx) => {
      activeSeqById[item.id] = idx + 1;
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
      const seqNum = activeSeqById[item.id];
      const seqHtml = seqNum
        ? `<span style="position:absolute;top:-7px;right:-7px;min-width:17px;height:17px;padding:0 3px;background:#0f172a;color:#fff;border:1.5px solid #fff;border-radius:5px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.35);">${seqNum}</span>`
        : '';

      const pkgIcon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:38px;height:38px;background:${bg};color:#fff;border:3px solid #fff;border-radius:14px;box-shadow:0 6px 14px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;cursor:pointer;">#${item.originalNumber}${seqHtml}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });

      const marker = L.marker([item.lat, item.lng], {
        icon: pkgIcon,
        title: `${seqNum ? `Parada ${seqNum} • ` : ''}Paquete #${item.originalNumber} - ${item.address}`
      });
      marker.on('click', () => {
        setSelectedItem(item);
        if (speakerEnabledRef.current && autoReadOnMapPinRef.current) {
          speakText(buildPackageAnnouncement(item));
        }
      });
      marker.addTo(markersLayer);
    });

    if (!hasFittedBoundsRef.current && boundsPoints.length > 1) {
      hasFittedBoundsRef.current = true;
      map.fitBounds(boundsPoints, { padding: [45, 45], maxZoom: 15 });
    }
  }, [currentGps, visibleItems, activeRouteItems]);

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
      ...activeRouteItems.slice(0, 50).map((i) => ({ lat: i.lat, lng: i.lng }))
    ];

    const cached = osrmCache[routeStopsKey];
    if (cached) {
      L.polyline(cached.coords, {
        color: '#059669',
        weight: 5,
        opacity: 0.92
      }).addTo(routeLayer);
      addCircuitDirectionArrows(cached.coords, routeLayer);
      setRouteStatus({ loading: false, error: null, summary: cached.summary });
      return;
    }

    let cancelled = false;
    setRouteStatus({ loading: true, error: null, summary: null });

    const coordParam = waypoints.map((p) => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordParam}?overview=full&geometries=geojson&alternatives=false`;

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
            opacity: 0.92
          }).addTo(routeLayer);
          addCircuitDirectionArrows(latLngs, routeLayer);
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
    ? buildWhatsAppUrl(
        selectedItem.phone,
        buildLocationRequestMessage(
          selectedItem.originalNumber,
          selectedItem.recipientName,
          selectedItem.orderIndex
        )
      )
    : null;

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-3xl overflow-hidden shadow-xl border-2 border-emerald-500/20 dark:border-slate-700">
      {/* Route Calculation Status Overlay */}
      {routeStatus.loading && (
        <div className="absolute top-3 left-3 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-emerald-200 dark:border-slate-700 text-emerald-900 dark:text-emerald-200 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 text-xs font-bold">
          <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <span>Calculando circuito vial...</span>
        </div>
      )}

      {!routeStatus.loading && routeStatus.summary && (
        <div className="absolute top-3 left-14 z-[400] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-emerald-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2.5 text-xs">
          <RouteIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold text-emerald-800 dark:text-emerald-300">
            Circuito vial: {routeStatus.summary.distanceKm} km • ~{routeStatus.summary.durationMinutes} min
          </span>
          <span className="text-gray-400 dark:text-slate-600">|</span>
          <span className="text-gray-600 dark:text-slate-300 font-medium">{routeStatus.summary.stopsCount} paradas</span>
        </div>
      )}

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[400px]" />

      {/* Launch In-App Turn-by-Turn GPS Button */}
      {onStartInAppNavigation && activeRouteItems.length > 0 && !selectedItem && (
        <button
          type="button"
          onClick={() => onStartInAppNavigation()}
          className="absolute bottom-3 left-3 z-[400] bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white/90 text-xs font-black flex items-center gap-2 transition-transform active:scale-95"
          title="Abrir navegación GPS paso a paso dentro de la app"
        >
          <Navigation className="w-4 h-4 transform rotate-45" />
          <span>Navegar GPS</span>
        </button>
      )}

      {/* Selected Package Floating Info Card */}
      {selectedItem && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 max-h-[60%] overflow-y-auto z-[450] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center shadow-xs">
                #{selectedItem.originalNumber}
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                {selectedItem.province || 'Costa Rica'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => speakText(buildPackageAnnouncement(selectedItem))}
                className="bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 p-1.5 rounded-lg border border-amber-200 dark:border-amber-700"
                title="Leer en altavoz"
                aria-label="Leer paquete en altavoz"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  selectedItem.coverageStatus === 'out_of_coverage'
                    ? 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-200'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                {selectedItem.coverageStatus === 'out_of_coverage' ? 'Fuera de Cobertura' : 'En Cobertura'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-colors"
                aria-label="Cerrar tarjeta"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            {selectedItem.recipientName && (
              <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 mb-0.5">{selectedItem.recipientName}</p>
            )}
            <p className="text-xs font-bold text-gray-900 dark:text-slate-100 line-clamp-2">{selectedItem.address}</p>
            {selectedItem.phone && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">Tel: {selectedItem.phone}</p>
            )}
            {selectedItem.status === 'failed' && selectedItem.failureReason && (
              <p className="text-[11px] text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1 mt-1 font-semibold">
                Motivo: {selectedItem.failureReason}
              </p>
            )}
            {selectedItem.coverageStatus === 'out_of_coverage' ? (
              <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>Fuera de zona autorizada.</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">Orden en ruta: #{selectedItem.orderIndex + 1}</p>
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
                    className="bg-green-100 dark:bg-green-950/70 hover:bg-green-200 dark:hover:bg-green-900 text-green-900 dark:text-green-200 border border-green-300 dark:border-green-700 py-1.5 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-green-700 dark:text-green-300" />
                    <span>Pedir ubic.</span>
                  </a>
                )}
              </div>
            )}

            {onStartInAppNavigation && selectedItem.coverageStatus === 'in_coverage' && (
              <button
                type="button"
                onClick={() => {
                  onStartInAppNavigation(selectedItem);
                  setSelectedItem(null);
                }}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 transform rotate-45" />
                <span>Guiar aquí (GPS en app)</span>
              </button>
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
                    className="bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-700"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Entregar</span>
                  </button>
                  <button
                    onClick={() => {
                      onUpdateStatus(selectedItem.id, 'failed');
                      setSelectedItem(null);
                    }}
                    className="bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/70 text-red-800 dark:text-red-200 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 border border-red-200 dark:border-red-700"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
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

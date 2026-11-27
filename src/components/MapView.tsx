import React, { useState, useEffect, useRef, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { DeliveryItem, GpsPosition } from '../types';
import { Navigation, CheckCircle2, AlertCircle, ExternalLink, ShieldAlert, Route as RouteIcon, Loader2, MessageCircle, Camera, MapPin, Volume2, X } from 'lucide-react';
import { calculateDistanceKm, buildWhatsAppUrl, buildLocationRequestMessage } from '../utils/whatsappParser';
import { buildPackageAnnouncement, speakText } from '../utils/speechUtils';
import { AppTheme } from '../utils/appSettings';

interface MapViewProps {
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onClearSelectedPackage?: () => void;
  speakerEnabled?: boolean;
  autoReadOnMapPin?: boolean;
  theme?: AppTheme;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onStartNavigation: (item: DeliveryItem) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  onStartInAppNavigation?: (focusItem?: DeliveryItem) => void;
  apiKey?: string;
}

interface RouteOverlayInfo {
  distanceKm: number;
  durationMinutes: number;
  stopsCount: number;
}

interface CachedRouteResult {
  path: any[];
  summary: RouteOverlayInfo;
}

const gmpRouteCache: Record<string, CachedRouteResult> = {};

// Modern Routes API renderer following real streets/roads via Route.computeRoutes()
const MapRouteHandler: React.FC<{
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onSelectMarker: (item: DeliveryItem) => void;
  onClearSelectedPackage?: () => void;
  onRouteStatusChange: (status: {
    loading: boolean;
    error: string | null;
    summary: RouteOverlayInfo | null;
  }) => void;
}> = ({ items, currentGps, selectedPackageId, onSelectMarker, onClearSelectedPackage, onRouteStatusChange }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes') as any;
  const polylinesRef = useRef<any[]>([]);
  const lastGpsOriginRef = useRef<{ lat: number; lng: number } | null>(null);

  const stableGpsOrigin = useMemo(() => {
    if (!currentGps) return null;
    const prev = lastGpsOriginRef.current;
    // Update route origin only when driver moves > 500m to preserve free API quota
    if (!prev || calculateDistanceKm(prev.lat, prev.lng, currentGps.lat, currentGps.lng) > 0.5) {
      const next = { lat: currentGps.lat, lng: currentGps.lng };
      lastGpsOriginRef.current = next;
      return next;
    }
    return prev;
  }, [currentGps]);

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

  const routeStopsKey = useMemo(() => {
    const gpsPart = stableGpsOrigin
      ? `${stableGpsOrigin.lat.toFixed(3)},${stableGpsOrigin.lng.toFixed(3)}`
      : 'no-gps';
    const stopsPart = activeRouteItems
      .map((i) => `${i.id}:${i.lat.toFixed(4)},${i.lng.toFixed(4)}`)
      .join('|');
    return `${gpsPart}__${stopsPart}`;
  }, [stableGpsOrigin, activeRouteItems]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
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
      map.panTo({ lat: target.lat, lng: target.lng });
      map.setZoom(16);
      onSelectMarker(target);
    }
    onClearSelectedPackage?.();
  }, [map, selectedPackageId]);

  useEffect(() => {
    const clearPolylines = () => {
      polylinesRef.current.forEach((p) => {
        if (p && typeof p.setMap === 'function') {
          p.setMap(null);
        }
      });
      polylinesRef.current = [];
    };

    if (!map || !routesLib?.Route) {
      return;
    }

    clearPolylines();

    const hasGpsOrigin = Boolean(stableGpsOrigin);
    if (activeRouteItems.length === 0 || (!hasGpsOrigin && activeRouteItems.length < 2)) {
      onRouteStatusChange({ loading: false, error: null, summary: null });
      return;
    }

    // Reuse cached route geometry for identical stops/origin so toggling map or editing non-location fields uses 0 quota
    const cached = gmpRouteCache[routeStopsKey];
    if (cached && (window as any).google?.maps?.Polyline) {
      const googleMaps = (window as any).google.maps;
      const arrowIcons = googleMaps.SymbolPath?.FORWARD_CLOSED_ARROW
        ? [
            {
              icon: {
                path: googleMaps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 2.7,
                fillColor: '#047857',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 1.2,
              },
              offset: '40px',
              repeat: '115px',
            },
          ]
        : undefined;
      const poly = new googleMaps.Polyline({
        path: cached.path,
        strokeColor: '#059669',
        strokeWeight: 5,
        strokeOpacity: 0.92,
        ...(arrowIcons ? { icons: arrowIcons } : {}),
        zIndex: 10,
        map,
      });
      polylinesRef.current = [poly];
      onRouteStatusChange({ loading: false, error: null, summary: cached.summary });
      return () => {
        clearPolylines();
      };
    }

    let cancelled = false;
    onRouteStatusChange({ loading: true, error: null, summary: null });

    const origin = stableGpsOrigin
      ? { lat: stableGpsOrigin.lat, lng: stableGpsOrigin.lng }
      : { lat: activeRouteItems[0].lat, lng: activeRouteItems[0].lng };

    const stopsForRoute = stableGpsOrigin ? activeRouteItems : activeRouteItems.slice(1);
    const destinationItem = stopsForRoute[stopsForRoute.length - 1];
    const destination = { lat: destinationItem.lat, lng: destinationItem.lng };

    const intermediateItems = stopsForRoute.slice(0, -1).slice(0, 25);
    const intermediates = intermediateItems.map((item) => ({
      location: { lat: item.lat, lng: item.lng },
    }));

    const request = {
      origin,
      destination,
      ...(intermediates.length > 0 ? { intermediates } : {}),
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
    };

    routesLib.Route.computeRoutes(request)
      .then((response: { routes?: any[] }) => {
        if (cancelled) return;
        const primaryRoute = response?.routes?.[0];
        if (!primaryRoute) {
          onRouteStatusChange({
            loading: false,
            error: 'No se encontró una ruta vial entre los destinos seleccionados.',
            summary: null,
          });
          return;
        }

        let createdPolylines: any[] = [];
        const googleMaps = (window as any).google?.maps;
        if (primaryRoute.path?.length && googleMaps?.Polyline) {
          const arrowIcons = googleMaps.SymbolPath?.FORWARD_CLOSED_ARROW
            ? [
                {
                  icon: {
                    path: googleMaps.SymbolPath.FORWARD_CLOSED_ARROW,
                    scale: 2.7,
                    fillColor: '#047857',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 1.2,
                  },
                  offset: '40px',
                  repeat: '115px',
                },
              ]
            : undefined;
          const singleCircuitPoly = new googleMaps.Polyline({
            path: primaryRoute.path,
            strokeColor: '#059669',
            strokeWeight: 5,
            strokeOpacity: 0.92,
            ...(arrowIcons ? { icons: arrowIcons } : {}),
            zIndex: 10,
            map,
          });
          createdPolylines = [singleCircuitPoly];
        } else if (typeof primaryRoute.createPolylines === 'function') {
          createdPolylines = primaryRoute.createPolylines();
          createdPolylines.forEach((polyline: any) => {
            polyline.setOptions({
              strokeColor: '#059669',
              strokeWeight: 5,
              strokeOpacity: 0.92,
              zIndex: 10,
            });
            polyline.setMap(map);
          });
        }

        polylinesRef.current = createdPolylines;

        const distanceMeters = primaryRoute.distanceMeters ?? 0;
        const durationMillis = primaryRoute.durationMillis ?? 0;
        const summary: RouteOverlayInfo = {
          distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
          durationMinutes: Math.max(1, Math.round(durationMillis / 60000)),
          stopsCount: activeRouteItems.length,
        };

        if (primaryRoute.path) {
          gmpRouteCache[routeStopsKey] = {
            path: primaryRoute.path,
            summary,
          };
        }

        onRouteStatusChange({
          loading: false,
          error: null,
          summary,
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        const errMsg = String(err?.message || err || '');
        if (
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('OVER_QUERY_LIMIT') ||
          errMsg.includes('OverQuotaMapError') ||
          errMsg.includes('QuotaExceededError') ||
          errMsg.includes('429')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        console.error('Error al calcular ruta por vías:', err);
        onRouteStatusChange({
          loading: false,
          error: 'No se pudo calcular la ruta real por carreteras.',
          summary: null,
        });
      });

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [map, routesLib, routeStopsKey]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  items,
  currentGps,
  selectedPackageId,
  onClearSelectedPackage,
  speakerEnabled = false,
  autoReadOnMapPin = true,
  theme = 'light',
  onUpdateStatus,
  onStartNavigation,
  onOpenPhotoModal,
  onStartInAppNavigation,
  apiKey = ''
}) => {
  const [selectedItem, setSelectedItem] = useState<DeliveryItem | null>(null);
  const handleSelectMarker = (item: DeliveryItem) => {
    setSelectedItem(item);
    if (speakerEnabled && autoReadOnMapPin) {
      speakText(buildPackageAnnouncement(item));
    }
  };
  const [routeStatus, setRouteStatus] = useState<{
    loading: boolean;
    error: string | null;
    summary: RouteOverlayInfo | null;
  }>({ loading: false, error: null, summary: null });

  useEffect(() => {
    if (!routeStatus.error) return;
    const timer = setTimeout(() => {
      setRouteStatus(prev => ({ ...prev, error: null }));
    }, 6000);
    return () => clearTimeout(timer);
  }, [routeStatus.error]);

  useEffect(() => {
    if (!selectedItem) return;
    const latest = items.find((i) => i.id === selectedItem.id);
    if (!latest || latest.status === 'delivered') {
      setSelectedItem(null);
    } else {
      setSelectedItem(latest);
    }
  }, [items]);

  const locatedItems = items.filter((item) => item.hasLocation !== false && item.coverageStatus !== 'incomplete');

  const defaultCenter = currentGps
    ? { lat: currentGps.lat, lng: currentGps.lng }
    : locatedItems.length > 0
    ? { lat: locatedItems[0].lat, lng: locatedItems[0].lng }
    : { lat: 9.9281, lng: -84.0907 };

  const visibleItems = locatedItems.filter((item) => item.status !== 'delivered');

  const activeSequenceById = useMemo(() => {
    const seq: Record<string, number> = {};
    visibleItems
      .filter(
        (i) =>
          (i.status === 'pending' || i.status === 'in_transit') &&
          i.coverageStatus === 'in_coverage'
      )
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((item, idx) => {
        seq[item.id] = idx + 1;
      });
    return seq;
  }, [visibleItems]);

  const getMarkerColor = (item: DeliveryItem) => {
    if (item.coverageStatus === 'out_of_coverage') {
      return { bg: '#dc2626', text: '#ffffff' };
    }
    switch (item.status) {
      case 'in_transit':
        return { bg: '#2563eb', text: '#ffffff' };
      case 'failed':
        return { bg: '#ea580c', text: '#ffffff' };
      case 'pending':
      default:
        return { bg: '#059669', text: '#ffffff' };
    }
  };

  return (
    <div className="w-full h-full min-h-[400px] relative rounded-3xl overflow-hidden shadow-xl border-2 border-emerald-500/20 dark:border-slate-700 bg-gray-100 dark:bg-slate-900">
      {/* Route Calculation Status Overlay */}
      {routeStatus.loading && (
        <div className="absolute top-3 left-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-emerald-200 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 text-xs font-bold">
          <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <span>Calculando circuito por vías...</span>
        </div>
      )}

      {!routeStatus.loading && routeStatus.summary && (
        <div className="absolute top-3 left-3 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-emerald-200 dark:border-emerald-700/60 text-gray-900 dark:text-slate-100 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2.5 text-xs">
          <RouteIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-bold text-emerald-800 dark:text-emerald-300">
            Circuito vial: {routeStatus.summary.distanceKm} km • ~{routeStatus.summary.durationMinutes} min
          </span>
          <span className="text-gray-400 dark:text-slate-500">|</span>
          <span className="text-gray-600 dark:text-slate-300 font-medium">{routeStatus.summary.stopsCount} paradas</span>
        </div>
      )}

      {!routeStatus.loading && routeStatus.error && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto z-20 bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-xs border border-amber-300 dark:border-amber-700/70 text-amber-950 dark:text-amber-100 px-3 py-2 rounded-xl shadow-md flex items-center justify-between gap-2 text-xs max-w-md">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span className="font-medium truncate">{routeStatus.error}</span>
          </div>
          <button
            type="button"
            onClick={() => setRouteStatus(prev => ({ ...prev, error: null }))}
            aria-label="Cerrar aviso"
            className="text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 p-1 rounded-lg hover:bg-amber-200/60 dark:hover:bg-amber-800/60 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <APIProvider
        apiKey={apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
        libraries={['routes']}
        language="es"
        region="CR"
      >
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={13}
          mapId="DEMO_MAP_ID"
          colorScheme={theme === 'dark' ? 'DARK' : 'LIGHT'}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling={'greedy'}
          disableHysteresis={true}
          onClick={() => setSelectedItem(null)}
        >
          <MapRouteHandler
            items={items}
            currentGps={currentGps}
            selectedPackageId={selectedPackageId}
            onSelectMarker={handleSelectMarker}
            onClearSelectedPackage={onClearSelectedPackage}
            onRouteStatusChange={setRouteStatus}
          />

          {/* Vehicle Navigation Triangle Marker (only vehicle triangle, no driver markers) */}
          {currentGps && (
            <AdvancedMarker
              position={{ lat: currentGps.lat, lng: currentGps.lng }}
              title="Tu Vehículo"
            >
              <div
                style={{
                  transform: `rotate(${
                    typeof currentGps.heading === 'number' && Number.isFinite(currentGps.heading)
                      ? currentGps.heading.toFixed(1)
                      : '0'
                  }deg)`,
                  filter: 'drop-shadow(0 5px 12px rgba(2,132,199,0.5))',
                }}
                className="w-10 h-10 flex items-center justify-center"
              >
                <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" fill="#ffffff" fillOpacity="0.96" stroke="#0284c7" strokeWidth="2.5" />
                  <path d="M20 7L30 29L20 24.5L10 29L20 7Z" fill="#0284c7" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
            </AdvancedMarker>
          )}

          {/* Delivery Markers */}
          {visibleItems.map((item) => {
            if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) return null;
            const colorInfo = getMarkerColor(item);
            const seqNumber = activeSequenceById[item.id];
            return (
              <AdvancedMarker
                key={item.id}
                position={{ lat: item.lat, lng: item.lng }}
                onClick={() => handleSelectMarker(item)}
                title={`${seqNumber ? `Parada ${seqNumber} • ` : ''}Paquete #${item.originalNumber} - ${item.address}`}
              >
                <div
                  style={{
                    backgroundColor: colorInfo.bg,
                    color: colorInfo.text,
                  }}
                  className={`relative w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shadow-lg border-3 border-white transform transition-transform hover:scale-110 cursor-pointer ${
                    item.coverageStatus === 'out_of_coverage' ? 'border-red-300 animate-pulse' : ''
                  }`}
                >
                  #{item.originalNumber}
                  {seqNumber && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 rounded-md bg-slate-900 text-white border border-white text-[9px] font-black flex items-center justify-center shadow-sm">
                      {seqNumber}
                    </span>
                  )}
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>

      {/* Launch In-App Turn-by-Turn GPS Button */}
      {onStartInAppNavigation && Object.keys(activeSequenceById).length > 0 && !selectedItem && (
        <button
          type="button"
          onClick={() => onStartInAppNavigation()}
          className="absolute bottom-3 left-3 z-20 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-2xl shadow-xl border-2 border-white/90 text-xs font-black flex items-center gap-2 transition-transform active:scale-95"
          title="Abrir navegación GPS paso a paso dentro de la app"
        >
          <Navigation className="w-4 h-4 transform rotate-45" />
          <span>Navegar GPS</span>
        </button>
      )}

      {/* Selected Package Floating Info Card (Never traps map interaction or InfoWindow DOM) */}
      {selectedItem && (
        <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 max-h-[60%] overflow-y-auto z-30 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-2 gap-2">
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
                className="bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 p-1.5 rounded-lg border border-amber-200 dark:border-amber-700 transition-colors"
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
                <span>Fuera de zona autorizada. No participa en ruta.</span>
              </p>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
                Orden en ruta: #{selectedItem.orderIndex + 1}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            {(() => {
              const waUrl = buildWhatsAppUrl(selectedItem.phone);
              const waPresetUrl = buildWhatsAppUrl(
                selectedItem.phone,
                buildLocationRequestMessage(
                  selectedItem.originalNumber,
                  selectedItem.recipientName,
                  selectedItem.orderIndex
                )
              );
              if (!waUrl) return null;
              return (
                <div className="flex items-center gap-1.5">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  {waPresetUrl && (
                    <a
                      href={waPresetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-green-100 dark:bg-green-950/70 hover:bg-green-200 dark:hover:bg-green-900 text-green-900 dark:text-green-200 border border-green-300 dark:border-green-700 py-1.5 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-colors"
                      title="Pedir ubicación por WhatsApp"
                    >
                      <MapPin className="w-3 h-3 text-green-700 dark:text-green-300" />
                      <span>Pedir ubic.</span>
                    </a>
                  )}
                </div>
              );
            })()}
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
                onClick={() => setSelectedItem(null)}
                className="bg-sky-500 hover:bg-sky-600 text-white py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <Navigation className="w-3.5 h-3.5 transform rotate-45" />
                <span>Waze</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  onStartNavigation(selectedItem);
                  setSelectedItem(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Maps</span>
              </button>
            </div>

            {selectedItem.coverageStatus === 'in_coverage' && (
              <div className="space-y-1.5 pt-0.5">
                <button
                  onClick={() => {
                    onOpenPhotoModal(selectedItem);
                    setSelectedItem(null);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
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

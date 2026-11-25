import React, { useState, useEffect, useRef, useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { DeliveryItem, GpsPosition } from '../types';
import { Navigation, CheckCircle2, AlertCircle, ExternalLink, ShieldAlert, Route as RouteIcon, Loader2, Users, MessageCircle, Camera, MapPin, Lock, Eye } from 'lucide-react';
import { calculateDistanceKm, buildWhatsAppUrl, buildLocationRequestMessage } from '../utils/whatsappParser';

interface MapViewProps {
  items: DeliveryItem[];
  currentUserId?: string | null;
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onStartNavigation: (item: DeliveryItem) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  apiKey?: string;
  remoteDrivers?: { id: string; driverName: string; lat: number; lng: number }[];
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
  onRouteStatusChange: (status: {
    loading: boolean;
    error: string | null;
    summary: RouteOverlayInfo | null;
  }) => void;
}> = ({ items, currentGps, selectedPackageId, onSelectMarker, onRouteStatusChange }) => {
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

  useEffect(() => {
    if (!map || !selectedPackageId) return;
    const target = items.find(
      (i) => i.id === selectedPackageId && i.hasLocation !== false && i.coverageStatus !== 'incomplete'
    );
    if (target) {
      map.panTo({ lat: target.lat, lng: target.lng });
      map.setZoom(16);
      onSelectMarker(target);
    }
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
      const poly = new googleMaps.Polyline({
        path: cached.path,
        strokeColor: '#059669',
        strokeWeight: 6,
        strokeOpacity: 0.9,
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
        if (typeof primaryRoute.createPolylines === 'function') {
          createdPolylines = primaryRoute.createPolylines();
          createdPolylines.forEach((polyline: any) => {
            polyline.setOptions({
              strokeColor: '#059669',
              strokeWeight: 6,
              strokeOpacity: 0.9,
              zIndex: 10,
            });
            polyline.setMap(map);
          });
        } else if (primaryRoute.path && (window as any).google?.maps?.Polyline) {
          const googleMaps = (window as any).google.maps;
          const fallbackPoly = new googleMaps.Polyline({
            path: primaryRoute.path,
            strokeColor: '#059669',
            strokeWeight: 6,
            strokeOpacity: 0.9,
            zIndex: 10,
            map,
          });
          createdPolylines = [fallbackPoly];
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
  currentUserId = null,
  currentGps,
  selectedPackageId,
  onUpdateStatus,
  onStartNavigation,
  onOpenPhotoModal,
  apiKey = '',
  remoteDrivers = []
}) => {
  const [selectedItem, setSelectedItem] = useState<DeliveryItem | null>(null);
  const isSelectedOwner = selectedItem
    ? (currentUserId ? selectedItem.assignedDriverId === currentUserId : !selectedItem.assignedDriverId)
    : false;
  const [routeStatus, setRouteStatus] = useState<{
    loading: boolean;
    error: string | null;
    summary: RouteOverlayInfo | null;
  }>({ loading: false, error: null, summary: null });

  const locatedItems = items.filter((item) => item.hasLocation !== false && item.coverageStatus !== 'incomplete');

  const defaultCenter = currentGps
    ? { lat: currentGps.lat, lng: currentGps.lng }
    : locatedItems.length > 0
    ? { lat: locatedItems[0].lat, lng: locatedItems[0].lng }
    : { lat: 9.9281, lng: -84.0907 };

  const visibleItems = locatedItems.filter((item) => item.status !== 'delivered');

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
    <div className="w-full h-full min-h-[400px] relative rounded-3xl overflow-hidden shadow-xl border-2 border-emerald-500/20">
      {/* Route Calculation Status Overlay */}
      {routeStatus.loading && (
        <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs border border-emerald-200 text-emerald-900 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2 text-xs font-bold">
          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
          <span>Calculando ruta por vías...</span>
        </div>
      )}

      {!routeStatus.loading && routeStatus.summary && (
        <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-xs border border-emerald-200 text-gray-900 px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2.5 text-xs">
          <RouteIcon className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-emerald-800">
            Ruta vial: {routeStatus.summary.distanceKm} km • ~{routeStatus.summary.durationMinutes} min
          </span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-600 font-medium">{routeStatus.summary.stopsCount} paradas</span>
        </div>
      )}

      {!routeStatus.loading && routeStatus.error && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto z-20 bg-amber-50/95 backdrop-blur-xs border border-amber-300 text-amber-950 px-3.5 py-2.5 rounded-xl shadow-md flex items-center gap-2 text-xs max-w-md">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-medium">{routeStatus.error}</span>
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
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
          gestureHandling={'greedy'}
          disableHysteresis={true}
        >
          <MapRouteHandler
            items={items}
            currentGps={currentGps}
            selectedPackageId={selectedPackageId}
            onSelectMarker={(item) => setSelectedItem(item)}
            onRouteStatusChange={setRouteStatus}
          />

          {/* Driver GPS Location Marker */}
          {currentGps && (
            <AdvancedMarker
              position={{ lat: currentGps.lat, lng: currentGps.lng }}
              title="Tu Ubicación GPS"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-full border-3 border-white shadow-xl flex items-center justify-center text-white animate-pulse">
                <Navigation className="w-5 h-5 transform rotate-45" />
              </div>
            </AdvancedMarker>
          )}

          {/* Other Connected Drivers Markers */}
          {remoteDrivers.map((driver) => (
            <AdvancedMarker
              key={driver.id}
              position={{ lat: driver.lat, lng: driver.lng }}
              title={`Conductor: ${driver.driverName}`}
            >
              <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-2xl shadow-xl border-2 border-white flex items-center gap-1.5 text-xs font-black">
                <Users className="w-3.5 h-3.5 text-indigo-200" />
                <span>{driver.driverName}</span>
              </div>
            </AdvancedMarker>
          ))}

          {/* Delivery Markers */}
          {visibleItems.map((item) => {
            const colorInfo = getMarkerColor(item);
            return (
              <AdvancedMarker
                key={item.id}
                position={{ lat: item.lat, lng: item.lng }}
                onClick={() => setSelectedItem(item)}
                title={`Paquete #${item.originalNumber} - ${item.address}`}
              >
                <div
                  style={{
                    backgroundColor: colorInfo.bg,
                    color: colorInfo.text,
                  }}
                  className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shadow-lg border-3 border-white transform transition-transform hover:scale-110 cursor-pointer ${
                    item.coverageStatus === 'out_of_coverage' ? 'border-red-300 animate-pulse' : ''
                  }`}
                >
                  #{item.originalNumber}
                </div>
              </AdvancedMarker>
            );
          })}

          {/* Info Window for Selected Marker */}
          {selectedItem && (
            <InfoWindow
              position={{ lat: selectedItem.lat, lng: selectedItem.lng }}
              onCloseClick={() => setSelectedItem(null)}
            >
              <div className="p-3 max-w-xs space-y-2 font-sans">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center shadow-xs">
                      #{selectedItem.originalNumber}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      {selectedItem.province || 'Costa Rica'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                      selectedItem.coverageStatus === 'out_of_coverage'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedItem.coverageStatus === 'out_of_coverage' ? 'Fuera de Cobertura' : 'En Cobertura'}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-900 line-clamp-2">{selectedItem.address}</p>
                  {selectedItem.phone && (
                    <p className="text-xs text-emerald-700 font-semibold mt-1">
                      Tel: {selectedItem.phone}
                    </p>
                  )}
                  {selectedItem.coverageStatus === 'out_of_coverage' ? (
                    <p className="text-[11px] text-red-600 mt-1 font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>Fuera de zona autorizada. No participa en ruta.</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500 mt-1">
                      Orden en ruta: #{selectedItem.orderIndex + 1}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-col gap-1.5">
                  {(() => {
                    const waUrl = buildWhatsAppUrl(selectedItem.phone);
                    const waPresetUrl = buildWhatsAppUrl(
                      selectedItem.phone,
                      buildLocationRequestMessage(selectedItem.originalNumber)
                    );
                    if (!waUrl) return null;
                    return (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                        {waPresetUrl && (
                          <a
                            href={waPresetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300 py-2 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-colors"
                            title="Pedir ubicación por WhatsApp"
                          >
                            <MapPin className="w-3 h-3 text-green-700" />
                            <span>Pedir ubic.</span>
                          </a>
                        )}
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href={`https://waze.com/ul?ll=${selectedItem.lat},${selectedItem.lng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSelectedItem(null)}
                      className="bg-sky-500 hover:bg-sky-600 text-white py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5 transform rotate-45" />
                      <span>Waze</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedItem.lat},${selectedItem.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSelectedItem(null)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Maps</span>
                    </a>
                  </div>

                  {!isSelectedOwner && (
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>De: {selectedItem.assignedDriverName || 'Otro conductor'} (Solo lectura)</span>
                    </div>
                  )}

                  {selectedItem.coverageStatus === 'in_coverage' && (
                    isSelectedOwner ? (
                      <div className="space-y-1.5 pt-1">
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
                    ) : selectedItem.deliveryPhoto ? (
                      <button
                        onClick={() => {
                          onOpenPhotoModal(selectedItem);
                          setSelectedItem(null);
                        }}
                        className="w-full bg-indigo-100 hover:bg-indigo-200 text-indigo-800 py-1.5 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 border border-indigo-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Foto (Solo lectura)</span>
                      </button>
                    ) : null
                  )}
                </div>
              </div>
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, useMap } from '@vis.gl/react-google-maps';
import { DeliveryItem, GpsPosition } from '../types';
import { Navigation, CheckCircle2, AlertCircle, ExternalLink, ShieldAlert } from 'lucide-react';

interface MapViewProps {
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onStartNavigation: (item: DeliveryItem) => void;
  apiKey?: string;
}

// Internal component to handle road-following Directions route and package centering
const MapRouteHandler: React.FC<{
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  selectedPackageId: string | null;
  onSelectMarker: (item: DeliveryItem) => void;
}> = ({ items, currentGps, selectedPackageId, onSelectMarker }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !(window as any).google?.maps) return;

    const googleMaps = (window as any).google.maps;
    const activeRouteItems = items
      .filter(i => (i.status === 'pending' || i.status === 'in_transit') && i.coverageStatus === 'in_coverage')
      .sort((a, b) => a.orderIndex - b.orderIndex);

    // If a specific package is selected, center map on it
    if (selectedPackageId) {
      const target = items.find(i => i.id === selectedPackageId);
      if (target) {
        map.panTo({ lat: target.lat, lng: target.lng });
        map.setZoom(16);
        onSelectMarker(target);
      }
    }

    if (activeRouteItems.length === 0) return;

    // Set up DirectionsService for road-following route lines
    const directionsService = new googleMaps.DirectionsService();
    const directionsRenderer = new googleMaps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#059669', // Waze/RUTEO emerald green
        strokeWeight: 6,
        strokeOpacity: 0.85
      }
    });

    const origin = currentGps
      ? new googleMaps.LatLng(currentGps.lat, currentGps.lng)
      : new googleMaps.LatLng(activeRouteItems[0].lat, activeRouteItems[0].lng);

    const destinationItem = activeRouteItems[activeRouteItems.length - 1];
    const destination = new googleMaps.LatLng(destinationItem.lat, destinationItem.lng);

    const waypoints = activeRouteItems.slice(0, activeRouteItems.length - 1).map(item => ({
      location: new googleMaps.LatLng(item.lat, item.lng),
      stopover: true
    }));

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: googleMaps.TravelMode.DRIVING
      },
      (result: any, status: string) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
        }
      }
    );

    return () => {
      directionsRenderer.setMap(null);
    };
  }, [map, items, currentGps, selectedPackageId]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  items,
  currentGps,
  selectedPackageId,
  onUpdateStatus,
  onStartNavigation,
  apiKey = ''
}) => {
  const [selectedItem, setSelectedItem] = useState<DeliveryItem | null>(null);

  const defaultCenter = currentGps
    ? { lat: currentGps.lat, lng: currentGps.lng }
    : items.length > 0
    ? { lat: items[0].lat, lng: items[0].lng }
    : { lat: 9.9281, lng: -84.0907 };

  // Filter markers: Hide delivered items from main map view
  const visibleItems = items.filter(item => item.status !== 'delivered');

  const getMarkerColor = (item: DeliveryItem) => {
    if (item.coverageStatus === 'out_of_coverage') {
      return { bg: '#dc2626', text: '#ffffff', label: 'Fuera de Cobertura' }; // Red
    }
    switch (item.status) {
      case 'in_transit':
        return { bg: '#2563eb', text: '#ffffff', label: 'En camino' }; // Blue
      case 'failed':
        return { bg: '#ea580c', text: '#ffffff', label: 'No entregada' }; // Orange
      case 'pending':
      default:
        return { bg: '#059669', text: '#ffffff', label: 'Pendiente' }; // Emerald Green Waze style
    }
  };

  return (
    <div className="w-full h-full min-h-[500px] relative rounded-3xl overflow-hidden shadow-xl border-2 border-emerald-500/20">
      <APIProvider apiKey={apiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
        <Map
          defaultCenter={defaultCenter}
          defaultZoom={13}
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
          style={{ width: '100%', height: '100%' }}
          gestureHandling={'greedy'}
          disableHysteresis={true}
        >
          {/* Map Route & Selection Handler */}
          <MapRouteHandler
            items={items}
            currentGps={currentGps}
            selectedPackageId={selectedPackageId}
            onSelectMarker={item => setSelectedItem(item)}
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
                    color: colorInfo.text
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
                {selectedItem.coverageStatus === 'in_coverage' && (
                  <div className="pt-2 flex flex-col gap-1.5">
                    <button
                      onClick={() => {
                        onStartNavigation(selectedItem);
                        setSelectedItem(null);
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Navegar (Google Maps / Waze)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1 pt-1">
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
            </InfoWindow>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

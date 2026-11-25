import React, { useMemo, useState } from 'react';
import {
  X,
  Share2,
  Navigation,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  MapPin
} from 'lucide-react';
import { DeliveryItem, GpsPosition } from '../types';

interface ShareRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  currentGps?: GpsPosition | null;
}

export const ShareRouteModal: React.FC<ShareRouteModalProps> = ({
  isOpen,
  onClose,
  items,
  currentGps
}) => {
  const [includeDelivered, setIncludeDelivered] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');

  const routeStops = useMemo(() => {
    return items
      .filter((i) => {
        if (i.hasLocation === false || i.coverageStatus === 'incomplete') return false;
        if (includeDelivered) return true;
        return i.status === 'pending' || i.status === 'in_transit';
      })
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [items, includeDelivered]);

  const routeShareText = useMemo(() => {
    if (routeStops.length === 0) return '';
    const lines = routeStops.map((stop, idx) => {
      const cleanAddress = /^https?:\/\//i.test(stop.address.trim())
        ? stop.province || 'Ubicación en mapa'
        : stop.address;
      const wazeUrl = `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
      const phonePart = stop.phone ? ` | Tel: ${stop.phone}` : '';
      return `${idx + 1}. Paquete #${stop.originalNumber} (${cleanAddress}${phonePart})\nWaze: ${wazeUrl}`;
    });
    return `Ruta RUTEO (${routeStops.length} paradas):\n\n${lines.join('\n\n')}`;
  }, [routeStops]);

  const googleMultiStopUrl = useMemo(() => {
    if (routeStops.length === 0) return null;
    if (!currentGps && routeStops.length < 2) return null;

    const maxStops = currentGps ? 10 : 11;
    const limited = routeStops.slice(0, maxStops);
    const origin = currentGps
      ? `${currentGps.lat},${currentGps.lng}`
      : `${limited[0].lat},${limited[0].lng}`;
    const remaining = currentGps ? limited : limited.slice(1);
    const destinationItem = remaining[remaining.length - 1];
    if (!destinationItem) return null;
    const destination = `${destinationItem.lat},${destinationItem.lng}`;
    const waypoints = remaining
      .slice(0, -1)
      .map((s) => `${s.lat},${s.lng}`)
      .join('|');

    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving'
    });
    if (waypoints) {
      params.set('waypoints', waypoints);
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }, [routeStops, currentGps]);

  if (!isOpen) return null;

  const handleCopyRoute = async () => {
    if (!routeShareText) return;
    setShareFeedback('');
    try {
      await navigator.clipboard.writeText(routeShareText);
      setCopied(true);
      setShareFeedback('Ruta con enlaces a Waze copiada al portapapeles.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareFeedback('No se pudo copiar automáticamente.');
    }
  };

  const handleNativeShare = async () => {
    if (!routeShareText) return;
    setShareFeedback('');
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({
          title: `Ruta RUTEO (${routeStops.length} paradas)`,
          text: routeShareText
        });
        setShareFeedback('Ruta compartida correctamente.');
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }
    await handleCopyRoute();
  };

  const whatsappShareUrl = routeShareText
    ? `https://wa.me/?text=${encodeURIComponent(routeShareText)}`
    : null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-sky-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <Navigation className="w-5 h-5 transform rotate-45" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Compartir Ruta a Waze</h2>
              <p className="text-xs text-sky-900">
                {routeStops.length} {routeStops.length === 1 ? 'parada con ubicación' : 'paradas en orden de ruta'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-sky-100/60 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeDelivered}
              onChange={(e) => setIncludeDelivered(e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Incluir paquetes ya entregados o fallidos</span>
          </label>

          {routeStops.length === 0 ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-6 text-center space-y-2">
              <MapPin className="w-6 h-6 text-gray-400 mx-auto" />
              <p className="text-xs font-bold text-gray-700">No hay paradas pendientes con ubicación</p>
              <p className="text-[11px] text-gray-500">
                Agrega ubicación a tus paquetes o activa la casilla de arriba para incluir entregas anteriores.
              </p>
            </div>
          ) : (
            <>
              {/* Share all Waze links together */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="bg-sky-500 hover:bg-sky-600 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartir Todo</span>
                </button>

                {whatsappShareUrl && (
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 hover:bg-green-700 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar WhatsApp</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleCopyRoute}
                  className="bg-gray-900 hover:bg-gray-800 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copiado' : 'Copiar Lista'}</span>
                </button>
              </div>

              {googleMultiStopUrl && (
                <a
                  href={googleMultiStopUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>
                    Abrir ruta completa junta en Google Maps ({Math.min(routeStops.length, 10)} paradas)
                  </span>
                </a>
              )}

              {shareFeedback && (
                <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-center">
                  {shareFeedback}
                </p>
              )}

              <p className="text-[11px] text-gray-500 bg-sky-50/70 border border-sky-200 rounded-xl p-2.5 leading-relaxed">
                Waze solo admite 1 destino por enlace directo, pero aquí puedes compartir toda la ruta con todos los enlaces juntos o abrir cada parada en orden:
              </p>

              {/* Ordered stops with direct Waze launch */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {routeStops.map((stop, idx) => (
                  <div
                    key={stop.id}
                    className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 h-6 bg-sky-100 text-sky-900 rounded-lg font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="bg-emerald-600 text-white font-black text-[11px] px-2 py-0.5 rounded-lg shrink-0">
                        #{stop.originalNumber}
                      </span>
                      <span className="text-xs font-semibold text-gray-800 truncate">
                        {/^https?:\/\//i.test(stop.address.trim()) ? stop.province || 'Ubicación' : stop.address}
                      </span>
                    </div>
                    <a
                      href={`https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-500 hover:bg-sky-600 text-white px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Navigation className="w-3 h-3 transform rotate-45" />
                      <span>Waze</span>
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

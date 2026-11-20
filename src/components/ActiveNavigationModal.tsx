import React from 'react';
import { X, Navigation, CheckCircle2, AlertCircle, ExternalLink, PauseCircle, MapPin } from 'lucide-react';
import { DeliveryItem } from '../types';

interface ActiveNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onFinishRoute: () => void;
}

export const ActiveNavigationModal: React.FC<ActiveNavigationModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateStatus,
  onFinishRoute
}) => {
  if (!isOpen) return null;

  // Filter only in-coverage items for active navigation route
  const activeRouteItems = items.filter(i => i.coverageStatus === 'in_coverage');
  const sortedItems = [...activeRouteItems].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentTarget = sortedItems.find(i => i.status === 'pending' || i.status === 'in_transit');
  const deliveredCount = activeRouteItems.filter(i => i.status === 'delivered').length;
  const totalCount = activeRouteItems.length;
  const progressPercent = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 100;

  const handleOpenGoogleMaps = (item: DeliveryItem) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
    window.open(url, '_blank');
  };

  const handleOpenWaze = (item: DeliveryItem) => {
    const url = `https://www.waze.com/ul?ll=${item.lat},${item.lng}&navigate=yes`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <Navigation className="w-5 h-5 transform rotate-45" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Navegación Activa RUTEO</h2>
              <p className="text-xs text-emerald-100">
                Progreso: {deliveredCount} de {totalCount} entregados en zona ({progressPercent}%)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-1.5">
          <div
            className="bg-emerald-500 h-1.5 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {totalCount === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">No hay destinos en cobertura</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Para iniciar la navegación, asegúrate de tener al menos una ubicación dentro de San José, Heredia o Cartago.
              </p>
            </div>
          ) : currentTarget ? (
            <div className="space-y-5">
              {/* Next Target Card */}
              <div className="bg-emerald-50/70 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white font-black text-sm px-3 py-1 rounded-xl shadow-xs">
                      Paquete #{currentTarget.originalNumber}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                      {currentTarget.province || 'En Cobertura'}
                    </span>
                  </div>
                  <span className="text-xs text-amber-800 font-medium bg-amber-100 px-2.5 py-1 rounded-lg">
                    Pendiente
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-gray-900 leading-snug">{currentTarget.address}</p>
                  {currentTarget.distanceFromPrevKm !== undefined && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Distancia: ~{currentTarget.distanceFromPrevKm} km ({currentTarget.estimatedMinutes || 5} min)</span>
                    </p>
                  )}
                </div>

                {/* Navigation App Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={() => handleOpenGoogleMaps(currentTarget)}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all shadow-blue-600/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Google Maps</span>
                  </button>
                  <button
                    onClick={() => handleOpenWaze(currentTarget)}
                    className="bg-sky-500 hover:bg-sky-600 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all shadow-sky-500/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Waze</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons for Current Delivery */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700 text-center">Registrar resultado de esta entrega:</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onUpdateStatus(currentTarget.id, 'delivered')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Entregado! (Siguiente)</span>
                  </button>
                  <button
                    onClick={() => onUpdateStatus(currentTarget.id, 'failed')}
                    className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <span>No se pudo entregar</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">¡Todas las entregas en cobertura completadas!</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Has completado exitosamente todas las paradas autorizadas de este recorrido.
              </p>
            </div>
          )}

          {/* Remaining Queue Preview */}
          {sortedItems.filter(i => i.status === 'pending' || i.status === 'in_transit').length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-700 mb-2">Próximas paradas en cola:</h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {sortedItems
                  .filter(i => i.status === 'pending' || i.status === 'in_transit')
                  .slice(currentTarget ? 1 : 0, 5)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] flex items-center justify-center">
                          #{item.originalNumber}
                        </span>
                        <span className="font-medium text-gray-800 truncate max-w-xs">{item.address}</span>
                      </div>
                      <span className="text-[10px] text-gray-500">#{idx + 1} en cola</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl hover:bg-gray-200/60 transition-colors"
          >
            <PauseCircle className="w-4 h-4 text-gray-500" />
            <span>Pausar Recorrido</span>
          </button>
          <button
            onClick={() => {
              onFinishRoute();
              onClose();
            }}
            className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            Finalizar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

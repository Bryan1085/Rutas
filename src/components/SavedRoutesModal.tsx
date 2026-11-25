import React from 'react';
import { X, Bookmark, Calendar, CheckCircle2, Trash2, ArrowRight, MapPin } from 'lucide-react';
import { RouteSession } from '../types';

interface SavedRoutesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedRoutes: RouteSession[];
  onLoadRoute: (route: RouteSession) => void;
  onDeleteRoute: (id: string) => void;
  onSaveCurrentRoute: () => void;
  hasCurrentItems: boolean;
}

export const SavedRoutesModal: React.FC<SavedRoutesModalProps> = ({
  isOpen,
  onClose,
  savedRoutes,
  onLoadRoute,
  onDeleteRoute,
  onSaveCurrentRoute,
  hasCurrentItems
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Recorridos Guardados</h2>
              <p className="text-xs text-gray-600">Historial de rutas y estadísticas de entregas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-emerald-100/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <h3 className="text-xs font-bold text-gray-900">¿Deseas guardar el recorrido actual?</h3>
              <p className="text-[11px] text-gray-500">Conserva todas las paradas y sus estados actuales.</p>
            </div>
            <button
              onClick={onSaveCurrentRoute}
              disabled={!hasCurrentItems}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm ${
                hasCurrentItems
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Guardar Recorrido Actual
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-gray-800">Historial de Recorridos ({savedRoutes.length}):</h3>

            {savedRoutes.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-8 text-center bg-gray-50 rounded-xl">
                No hay recorridos guardados todavía.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {savedRoutes.map(route => {
                  const delivered = route.items.filter(i => i.status === 'delivered').length;
                  const total = route.items.length;
                  const dateStr = new Date(route.createdAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={route.id}
                      className="p-4 bg-white border border-gray-200 rounded-xl flex items-center justify-between hover:border-emerald-300 transition-all shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900">{route.name}</h4>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                            {delivered}/{total} entregados
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dateStr}
                          </span>
                          <span>• {route.totalDistanceKm} km</span>
                          <span>• {route.totalMinutes} min</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onLoadRoute(route);
                            onClose();
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border border-emerald-200"
                        >
                          <span>Abrir</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteRoute(route.id)}
                          className="text-gray-400 hover:text-red-600 p-2 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200/60 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { CheckCircle2, Camera, MapPin, User, X, AlertTriangle } from 'lucide-react';
import { DeliveryItem } from '../types';

interface DeliveryConfirmModalProps {
  isOpen: boolean;
  item: DeliveryItem | null;
  onCancel: () => void;
  onConfirmDelivery: (item: DeliveryItem) => void;
  onOpenPhotoFirst: (item: DeliveryItem) => void;
}

export const DeliveryConfirmModal: React.FC<DeliveryConfirmModalProps> = ({
  isOpen,
  item,
  onCancel,
  onConfirmDelivery,
  onOpenPhotoFirst,
}) => {
  if (!isOpen || !item) return null;

  const isIncomplete = item.hasLocation === false || item.coverageStatus === 'incomplete';
  const displayAddress = isIncomplete
    ? 'Sin ubicación registrada'
    : /^https?:\/\//i.test(item.address.trim())
    ? 'Ubicación en mapa'
    : item.address;

  return (
    <div className="fixed inset-0 z-[1300] bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-emerald-600 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black">Confirmar Entrega</h2>
              <p className="text-xs text-emerald-100">Verifica que sea el paquete correcto</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar confirmación"
            className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/15 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-700/80 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="bg-emerald-600 text-white font-black text-sm px-3 py-1 rounded-xl shadow-xs">
                Paquete #{item.originalNumber}
              </span>
              {item.province && item.province !== 'Sin ubicación' && (
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">{item.province}</span>
              )}
            </div>

            {item.recipientName && (
              <p className="text-sm font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>{item.recipientName}</span>
              </p>
            )}

            <p className="text-xs font-semibold text-gray-800 dark:text-slate-200 flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{displayAddress}</span>
            </p>
          </div>

          {/* Photo status indicator */}
          {item.deliveryPhoto ? (
            <div className="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 flex items-center gap-3">
              <img
                src={item.deliveryPhoto}
                alt={`Foto paquete ${item.originalNumber}`}
                className="w-12 h-12 rounded-xl object-cover border border-gray-300 dark:border-slate-600 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Foto de entrega lista</p>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">Se quitará de la lista y la foto quedará lista para enviar.</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-700 rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-950 dark:text-amber-200">Sin foto de entrega</p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">¿Deseas tomar la foto antes de entregarlo?</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenPhotoFirst(item)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Tomar foto</span>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-4 rounded-2xl text-xs font-bold text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors min-h-[46px]"
            >
              No, cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirmDelivery(item)}
              className="py-3 px-4 rounded-2xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all active:scale-95 min-h-[46px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sí, Entregado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

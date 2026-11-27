import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { DeliveryItem } from '../types';

interface DeliveryFailedModalProps {
  isOpen: boolean;
  item: DeliveryItem | null;
  onCancel: () => void;
  onConfirmFailed: (item: DeliveryItem, reason: string) => void;
}

const PRESET_REASONS = [
  'Cliente no se encontraba',
  'No contestó llamada / WhatsApp',
  'Dirección incorrecta o incompleta',
  'Cliente rechazó el paquete',
  'Local o portón cerrado',
  'Reprogramado para otro día',
];

export const DeliveryFailedModal: React.FC<DeliveryFailedModalProps> = ({
  isOpen,
  item,
  onCancel,
  onConfirmFailed,
}) => {
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (isOpen && item) {
      setReason(item.failureReason || '');
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmFailed(item, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 bg-red-50 dark:bg-red-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-gray-900 dark:text-slate-100 truncate">
                ¿Por qué no se entregó #{item.originalNumber}?
              </h2>
              <p className="text-xs text-red-700 dark:text-red-300 truncate">
                {item.recipientName || item.address || 'Motivo de no entrega'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
            className="text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-red-100/70 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-700 dark:text-slate-300">
              Selecciona un motivo rápido:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map(preset => {
                const selected = reason.trim() === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(selected ? '' : preset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors text-left ${
                      selected
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-700'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block">
              O escribe el motivo (opcional):
            </label>
            <textarea
              rows={3}
              maxLength={250}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ej. Se llamó 3 veces y nadie salió a recibir..."
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl p-3 text-xs focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
            />
          </div>

          <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-red-600/20 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Guardar No Entregado</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

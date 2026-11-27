import React from 'react';
import { MessageCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  DEFAULT_LOCATION_REQUEST_TEMPLATES,
  formatLocationRequestMessage,
} from '../utils/whatsappParser';

interface WhatsAppTemplatesEditorProps {
  templates: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
  showPreview?: boolean;
}

export const WhatsAppTemplatesEditor: React.FC<WhatsAppTemplatesEditorProps> = ({
  templates,
  onChange,
  compact = false,
  showPreview = false,
}) => {
  const list = templates.length > 0 ? templates : [...DEFAULT_LOCATION_REQUEST_TEMPLATES];

  const handleUpdateAt = (index: number, value: string) => {
    const next = [...list];
    next[index] = value;
    onChange(next);
  };

  const handleInsertTokenAt = (index: number, token: string) => {
    const current = list[index] || '';
    const nextVal = `${current}${current.endsWith(' ') || current === '' ? '' : ' '}${token}`;
    handleUpdateAt(index, nextVal);
  };

  const handleRemoveAt = (index: number) => {
    if (list.length <= 1) return;
    onChange(list.filter((_, idx) => idx !== index));
  };

  const handleAddTemplate = () => {
    onChange([
      ...list,
      'Hola {nombre}, ¿nos podrías enviar tu ubicación para entregar tu paquete #{paquete}? ¡Muchas gracias!',
    ]);
  };

  const handleRestoreDefaults = () => {
    onChange([...DEFAULT_LOCATION_REQUEST_TEMPLATES]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
            Mensajes preestablecidos de WhatsApp ({list.length})
          </span>
        </div>
        <button
          type="button"
          onClick={handleRestoreDefaults}
          className="text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restaurar los 3 mensajes</span>
        </button>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
        La app rota automáticamente entre estos mensajes al pedir ubicaciones para variar el texto y evitar bloqueos en WhatsApp. Usa{' '}
        <strong className="text-gray-700 dark:text-slate-200">{'{nombre}'}</strong> y{' '}
        <strong className="text-gray-700 dark:text-slate-200">{'{paquete}'}</strong>.
      </p>

      <div className="space-y-2.5">
        {list.map((tpl, idx) => (
          <div
            key={idx}
            className="bg-gray-50/90 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold text-gray-700 dark:text-slate-200">
                Mensaje {idx + 1}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleInsertTokenAt(idx, '{nombre}')}
                  className="text-[10px] font-bold bg-emerald-100/90 dark:bg-emerald-950/70 hover:bg-emerald-200 dark:hover:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  + {'{nombre}'}
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertTokenAt(idx, '{paquete}')}
                  className="text-[10px] font-bold bg-green-100/90 dark:bg-green-950/70 hover:bg-green-200 dark:hover:bg-green-900/70 text-green-900 dark:text-green-200 px-2 py-0.5 rounded-lg border border-green-200 dark:border-green-800 transition-colors"
                >
                  + {'{paquete}'}
                </button>
                {list.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAt(idx)}
                    aria-label={`Eliminar mensaje ${idx + 1}`}
                    title="Eliminar este mensaje"
                    className="p-1 rounded-lg text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={compact ? 2 : 3}
              value={tpl}
              onChange={e => handleUpdateAt(idx, e.target.value)}
              placeholder={
                DEFAULT_LOCATION_REQUEST_TEMPLATES[idx % DEFAULT_LOCATION_REQUEST_TEMPLATES.length]
              }
              className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl p-2.5 text-xs focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none resize-none"
            />

            {showPreview && tpl.trim() && (
              <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-snug">
                Vista previa: {formatLocationRequestMessage(tpl, 3, 'María López')}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add new message button (+) */}
      <button
        type="button"
        onClick={handleAddTemplate}
        className="w-full py-2.5 px-3 min-h-[42px] rounded-xl border border-dashed border-green-400 dark:border-green-700 bg-green-50/60 dark:bg-green-950/30 hover:bg-green-100/70 dark:hover:bg-green-950/50 text-green-800 dark:text-green-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
      >
        <Plus className="w-4 h-4 shrink-0" />
        <span>Añadir otro mensaje</span>
      </button>
    </div>
  );
};

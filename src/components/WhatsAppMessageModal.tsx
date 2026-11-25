import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Save, RotateCcw } from 'lucide-react';
import {
  DEFAULT_LOCATION_REQUEST_TEMPLATE,
  getLocationRequestTemplate,
  saveLocationRequestTemplate
} from '../utils/whatsappParser';

interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
  isOpen,
  onClose
}) => {
  const [template, setTemplate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTemplate(getLocationRequestTemplate());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveLocationRequestTemplate(template);
    onClose();
  };

  const handleReset = () => {
    setTemplate(DEFAULT_LOCATION_REQUEST_TEMPLATE);
  };

  const previewText = (template || DEFAULT_LOCATION_REQUEST_TEMPLATE).replace(/\{paquete\}/gi, '3');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-green-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Mensaje de WhatsApp</h2>
              <p className="text-xs text-green-800">Edita el mensaje preestablecido</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-green-100/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700">Mensaje preestablecido:</label>
              <button
                type="button"
                onClick={() => setTemplate(prev => `${prev}${prev.endsWith(' ') || prev === '' ? '' : ' '}{paquete}`)}
                className="text-[11px] font-bold bg-green-100 hover:bg-green-200 text-green-900 px-2 py-0.5 rounded-full border border-green-300 transition-colors"
              >
                + Insertar {'{paquete}'}
              </button>
            </div>
            <textarea
              rows={4}
              value={template}
              onChange={e => setTemplate(e.target.value)}
              placeholder={DEFAULT_LOCATION_REQUEST_TEMPLATE}
              className="w-full bg-gray-50 border border-gray-300 rounded-2xl p-3 text-xs focus:border-green-500 focus:ring-2 focus:ring-green-500/20 outline-none resize-none"
            />
            <p className="text-[11px] text-gray-500">
              Usa <strong>{'{paquete}'}</strong> donde quieras que aparezca automáticamente el número de paquete.
            </p>
          </div>

          <div className="bg-green-50/70 border border-green-200 rounded-2xl p-3 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-800">Vista previa (Paquete #3):</span>
            <p className="text-xs text-gray-800 leading-relaxed">{previewText}</p>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>Guardar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

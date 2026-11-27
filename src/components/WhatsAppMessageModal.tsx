import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Save, RotateCcw } from 'lucide-react';
import {
  DEFAULT_LOCATION_REQUEST_TEMPLATES,
  getLocationRequestTemplates,
  saveLocationRequestTemplates,
} from '../utils/whatsappParser';
import { WhatsAppTemplatesEditor } from './WhatsAppTemplatesEditor';

interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppMessageModal: React.FC<WhatsAppMessageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [templates, setTemplates] = useState<string[]>([...DEFAULT_LOCATION_REQUEST_TEMPLATES]);

  useEffect(() => {
    if (isOpen) {
      setTemplates(getLocationRequestTemplates());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveLocationRequestTemplates(templates);
    onClose();
  };

  const handleReset = () => {
    setTemplates([...DEFAULT_LOCATION_REQUEST_TEMPLATES]);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[88vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-green-50 dark:bg-green-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-slate-100">Mensajes de WhatsApp</h2>
              <p className="text-xs text-green-800 dark:text-green-300">
                Rotación automática para pedir ubicaciones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-green-100/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col">
          <div className="p-5 sm:p-6 overflow-y-auto flex-1">
            <WhatsAppTemplatesEditor
              templates={templates}
              onChange={setTemplates}
              showPreview
            />
          </div>

          <div className="px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/80 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700/60 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700/60 transition-colors"
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

import React, { useState } from 'react';
import { X, Settings, Key, RefreshCw, Check, Shield } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  onResetData
}) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gray-200 rounded-xl flex items-center justify-center text-gray-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Configuración RUTEO</h2>
              <p className="text-xs text-gray-500">Parámetros de la aplicación</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-emerald-600" />
              <span>Google Maps API Key (opcional):</span>
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-xl border border-gray-300 p-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono"
            />
            <p className="text-[11px] text-gray-500">
              Si se deja en blanco, la aplicación utilizará la clave preconfigurada del entorno o el mapa interactivo estándar.
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              Tus datos de trabajo y recorridos se guardan localmente en tu dispositivo de forma segura y privada.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (confirm('¿Estás seguro de restablecer todos los datos locales?')) {
                  onResetData();
                  onClose();
                }
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 p-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Borrar datos</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 shadow-emerald-600/20"
              >
                {saved ? <Check className="w-4 h-4" /> : null}
                <span>{saved ? 'Guardado' : 'Guardar'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

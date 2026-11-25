import React, { useState } from 'react';
import { Download, Monitor, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isWindows, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA (Windows or mobile), hide the button
  if (isInstalled) {
    return null;
  }

  // Native Chromium / Edge / Windows / Android prompt
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
        title="Instalar RUTEO como aplicación en Windows o móvil"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
    );
  }

  // Fallback guided install modal for iOS Safari or Windows Desktop when browser prompt is deferred
  if (isIOS || isWindows) {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 text-xs font-bold text-emerald-800 transition-colors"
          title={isWindows ? 'Instalar en Windows' : 'Instalar en iPhone / iPad'}
        >
          {isWindows ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          <span className="hidden md:inline">Instalar</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-gray-900">
                  {isWindows ? 'Instalar en Windows' : 'Instalar en iPhone / iPad'}
                </h3>
                <button
                  onClick={() => setShowGuide(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isWindows ? (
                <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
                  <p>Para usar <strong>RUTEO</strong> como aplicación de escritorio en Windows:</p>
                  <ol className="list-decimal list-inside space-y-1.5 font-medium text-gray-800">
                    <li>Abre la aplicación en una pestaña directa de <strong>Microsoft Edge</strong> o <strong>Google Chrome</strong>.</li>
                    <li>Haz clic en el ícono de <strong>Instalar</strong> en el extremo derecho de la barra de direcciones (o abre el menú <strong>⋯ / ⋮ → Aplicaciones → Instalar RUTEO</strong>).</li>
                  </ol>
                </div>
              ) : (
                <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
                  <p>Para instalar <strong>RUTEO</strong> en tu iPhone o iPad:</p>
                  <ol className="list-decimal list-inside space-y-1.5 font-medium text-gray-800">
                    <li>Toca el botón <strong>Compartir</strong> en la barra de Safari.</li>
                    <li>Desliza hacia abajo y selecciona <strong>Agregar a inicio</strong>.</li>
                  </ol>
                </div>
              )}

              <button
                onClick={() => setShowGuide(false)}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

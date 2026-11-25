import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, Map as MapIcon } from 'lucide-react';

interface QuotaBannerProps {
  mapProvider?: 'google' | 'free';
  onSwitchToFreeMap?: () => void;
}

export const QuotaBanner: React.FC<QuotaBannerProps> = ({ mapProvider, onSwitchToFreeMap }) => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleQuotaError = () => {
      setQuotaExceeded(true);
      setDismissed(false);
    };

    window.addEventListener('gmp-quota-exceeded', handleQuotaError);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaError);
    };
  }, []);

  if (!quotaExceeded || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 mx-auto flex-wrap justify-center">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          Se alcanzó la cuota gratuita diaria de Google Maps.{' '}
          {mapProvider === 'free' ? (
            <strong>Activamos el Mapa Gratuito (sin costo ni límite) para que sigas usando la app gratis.</strong>
          ) : (
            <>
              Usa el{' '}
              {onSwitchToFreeMap && (
                <button
                  onClick={() => {
                    onSwitchToFreeMap();
                    setDismissed(true);
                  }}
                  className="underline font-bold text-emerald-800 hover:text-emerald-900 inline-flex items-center gap-1 mx-0.5"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  Mapa Gratuito (sin costo)
                </button>
              )}{' '}
              o consulta{' '}
            </>
          )}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-amber-950 hover:text-amber-800 ml-1"
          >
            más info en Google Maps
          </a>
          .
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-700 hover:text-amber-900 p-1 rounded shrink-0"
        title="Cerrar"
        aria-label="Cerrar aviso"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

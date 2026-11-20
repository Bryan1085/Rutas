import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const QuotaBanner: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleQuotaError = () => {
      setQuotaExceeded(true);
    };

    window.addEventListener('gmp-quota-exceeded', handleQuotaError);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaError);
    };
  }, []);

  if (!quotaExceeded || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-2 mx-auto">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          Límite de cuota de Google Maps alcanzado. Visita{' '}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-amber-950 hover:text-amber-800"
          >
            Google Maps Developers
          </a>{' '}
          para configurar tu cuenta o proyecto con facturación.
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-700 hover:text-amber-900 p-1 rounded"
        title="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

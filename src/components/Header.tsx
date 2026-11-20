import React from 'react';
import { Navigation, MapPin, CheckCircle2, Clock, Settings, Bookmark } from 'lucide-react';
import { DeliveryItem } from '../types';

interface HeaderProps {
  items: DeliveryItem[];
  onOpenSettings: () => void;
  onOpenSavedRoutes: () => void;
  gpsActive: boolean;
  onToggleGps: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  items,
  onOpenSettings,
  onOpenSavedRoutes,
  gpsActive,
  onToggleGps
}) => {
  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'in_transit').length;
  const completedCount = items.filter(i => i.status === 'delivered').length;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Navigation className="w-5 h-5 transform rotate-45" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-1.5">
                RUTEO
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Pro
                </span>
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">Optimización inteligente de entregas</p>
            </div>
          </div>

          {/* Counters & GPS Status */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Pendientes:</span>
              <strong className="text-amber-900 font-bold">{pendingCount}</strong>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Entregadas:</span>
              <strong className="text-emerald-900 font-bold">{completedCount}</strong>
            </div>

            {/* GPS Toggle */}
            <button
              onClick={onToggleGps}
              title={gpsActive ? "GPS Activo" : "Activar GPS"}
              className={`p-2 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${
                gpsActive
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MapPin className={`w-4 h-4 ${gpsActive ? 'text-emerald-600 animate-pulse' : 'text-gray-400'}`} />
              <span className="hidden md:inline">{gpsActive ? 'GPS OK' : 'GPS'}</span>
            </button>

            {/* Saved Routes button */}
            <button
              onClick={onOpenSavedRoutes}
              className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Recorridos Guardados"
            >
              <Bookmark className="w-5 h-5" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-600 hover:text-emerald-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Configuración"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

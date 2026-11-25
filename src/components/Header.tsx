import React from 'react';
import { Navigation, MapPin, Settings, Bookmark, User as UserIcon, LogOut, LogIn, Users } from 'lucide-react';
import { User } from 'firebase/auth';
import { PWAInstallButton } from './PWAInstallButton';

interface DriverInfo {
  id: string;
  driverName: string;
  lat: number;
  lng: number;
}

interface RouteDriverOption {
  id: string;
  driverName: string;
}

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenSavedRoutes: () => void;
  gpsActive: boolean;
  onToggleGps: () => void;
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
  remoteDrivers: DriverInfo[];
  routeDrivers?: RouteDriverOption[];
  selectedDriverId: string | null;
  onSelectDriver: (driverId: string | null) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenSavedRoutes,
  gpsActive,
  onToggleGps,
  user,
  onSignIn,
  onSignOut,
  remoteDrivers,
  routeDrivers,
  selectedDriverId,
  onSelectDriver
}) => {
  const driverOptions: RouteDriverOption[] = routeDrivers && routeDrivers.length > 0
    ? routeDrivers
    : remoteDrivers.map(d => ({ id: d.id, driverName: d.driverName }));

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <Navigation className="w-4.5 h-4.5 transform rotate-45" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900">
                RUTEO
              </h1>
            </div>
          </div>

          {/* Driver Route Selector & Controls */}
          <div className="flex items-center gap-2.5">
            {/* Driver Route Filter Dropdown (Desktop) */}
            <div className="hidden md:flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-bold text-gray-600">Ruta de:</span>
              <select
                value={selectedDriverId || 'all'}
                onChange={e => onSelectDriver(e.target.value === 'all' ? null : e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-900 outline-none cursor-pointer"
              >
                <option value="all">Todos los conductores</option>
                {user && (
                  <option value={user.uid}>
                    Tú ({user.displayName || user.email?.split('@')[0] || 'Conductor'})
                  </option>
                )}
                {driverOptions.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.driverName} (Solo lectura)
                  </option>
                ))}
              </select>
            </div>

            {/* Install PWA / Windows Desktop App */}
            <PWAInstallButton />

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

            {/* User Auth Button */}
            {user ? (
              <div className="flex items-center gap-1.5 pl-1 border-l border-gray-200">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-bold text-gray-800 truncate max-w-[100px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[9px] text-emerald-600 font-semibold">Sincronizado</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-emerald-500" />
                ) : (
                  <div className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xs">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <button
                  onClick={onSignOut}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                title="Iniciar sesión para sincronizar"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Conectar</span>
              </button>
            )}
          </div>
        </div>

        {/* Driver Route Filter Bar (Mobile) */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 w-full">
            <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-gray-600 shrink-0">Ruta de:</span>
            <select
              value={selectedDriverId || 'all'}
              onChange={e => onSelectDriver(e.target.value === 'all' ? null : e.target.value)}
              className="bg-transparent text-xs font-bold text-gray-900 outline-none cursor-pointer flex-1 min-w-0"
            >
              <option value="all">Todos los conductores</option>
              {user && (
                <option value={user.uid}>
                  Tú ({user.displayName || user.email?.split('@')[0] || 'Conductor'})
                </option>
              )}
              {driverOptions.map(d => (
                <option key={d.id} value={d.id}>
                  {d.driverName} (Solo lectura)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};

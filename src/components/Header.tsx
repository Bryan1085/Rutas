import React from 'react';
import {
  Navigation,
  MapPin,
  Settings,
  Bookmark,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  UserCheck,
  Users,
  Loader2,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { AppSettings, AppTheme, BUTTON_COLOR_STYLES, DEFAULT_APP_SETTINGS } from '../utils/appSettings';
import type { DriverProfile } from '../types';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenSavedRoutes: () => void;
  gpsActive: boolean;
  onToggleGps: () => void;
  speakerEnabled?: boolean;
  onToggleSpeaker?: () => void;
  theme?: AppTheme;
  onToggleTheme?: () => void;
  appSettings?: AppSettings;
  currentDriver?: DriverProfile | null;
  activeDriversCount?: number;
  syncBusy?: boolean;
  onOpenDriversModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenSavedRoutes,
  gpsActive,
  onToggleGps,
  speakerEnabled = false,
  onToggleSpeaker,
  theme = 'light',
  onToggleTheme,
  appSettings = DEFAULT_APP_SETTINGS,
  currentDriver = null,
  activeDriversCount = 0,
  syncBusy = false,
  onOpenDriversModal,
}) => {
  const { visibleButtons, buttonColors } = appSettings;
  const accentStyle = BUTTON_COLOR_STYLES[buttonColors.accent];
  const speakerStyle = BUTTON_COLOR_STYLES[buttonColors.speakerBtn];
  const isDark = theme === 'dark';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${accentStyle.iconBg}`}>
              <Navigation className="w-4.5 h-4.5 transform rotate-45" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-slate-100">
                RUTEO
              </h1>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Active Driver Roster & Sync Control */}
            {onOpenDriversModal && (
              <button
                type="button"
                onClick={onOpenDriversModal}
                title={
                  currentDriver
                    ? `Conductor: ${currentDriver.driverName} (${activeDriversCount} activos)`
                    : 'Ingresar nombre de conductor'
                }
                aria-label="Conductores activos"
                className={`p-2 sm:px-2.5 sm:py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                  currentDriver
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                    : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                }`}
              >
                {syncBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
                ) : currentDriver ? (
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Users className="w-4 h-4 text-gray-500 dark:text-slate-400 shrink-0" />
                )}
                <span className="max-w-[90px] sm:max-w-[130px] truncate">
                  {currentDriver ? currentDriver.driverName : 'Conductor'}
                </span>
              </button>
            )}

            {/* Install PWA / Windows Desktop App */}
            {visibleButtons.headerInstall && <PWAInstallButton />}

            {/* Speaker (Altavoz) Toggle */}
            {onToggleSpeaker && visibleButtons.headerSpeaker && (
              <button
                onClick={onToggleSpeaker}
                title={speakerEnabled ? 'Altavoz activado (clic para silenciar)' : 'Activar altavoz para leer entregas en voz alta'}
                aria-label={speakerEnabled ? 'Desactivar altavoz' : 'Activar altavoz'}
                className={`p-2 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${
                  speakerEnabled
                    ? `${speakerStyle.soft} shadow-xs`
                    : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                {speakerEnabled ? (
                  <Volume2 className={`w-4 h-4 ${speakerStyle.badgeText}`} />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                )}
                <span className="hidden md:inline">{speakerEnabled ? 'Altavoz' : 'Silencio'}</span>
              </button>
            )}

            {/* GPS Toggle */}
            {visibleButtons.headerGps && (
              <button
                onClick={onToggleGps}
                title={gpsActive ? "GPS Activo" : "Activar GPS"}
                className={`p-2 rounded-lg border transition-all flex items-center gap-1 text-xs font-medium ${
                  gpsActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <MapPin className={`w-4 h-4 ${gpsActive ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' : 'text-gray-400 dark:text-slate-400'}`} />
                <span className="hidden md:inline">{gpsActive ? 'GPS OK' : 'GPS'}</span>
              </button>
            )}

            {/* Saved Routes button */}
            {visibleButtons.headerSavedRoutes && (
              <button
                onClick={onOpenSavedRoutes}
                className="p-2 text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Recorridos Guardados"
              >
                <Bookmark className="w-5 h-5" />
              </button>
            )}

            {/* Day / Dark Mode Toggle */}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={isDark ? 'Cambiar a Modo Día' : 'Cambiar a Modo Oscuro'}
                aria-label={isDark ? 'Cambiar a Modo Día' : 'Cambiar a Modo Oscuro'}
                className="p-2 text-gray-600 dark:text-amber-300 hover:text-emerald-600 dark:hover:text-amber-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            )}

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
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


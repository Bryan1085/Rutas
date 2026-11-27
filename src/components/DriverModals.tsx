import React, { useState } from 'react';
import {
  User,
  Users,
  Trash2,
  Plus,
  X,
  Check,
  Loader2,
  Navigation,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { DriverProfile } from '../types';

interface DriverOnboardingModalProps {
  isOpen: boolean;
  activeDrivers: DriverProfile[];
  busy: boolean;
  removedNotice?: string | null;
  onRegisterDriver: (name: string) => Promise<void>;
  onSelectExistingDriver: (driver: DriverProfile) => void;
}

export const DriverOnboardingModal: React.FC<DriverOnboardingModalProps> = ({
  isOpen,
  activeDrivers,
  busy,
  removedNotice,
  onRegisterDriver,
  onSelectExistingDriver,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError('Escribe tu nombre de conductor para continuar.');
      return;
    }
    setError('');
    await onRegisterDriver(trimmed);
    setNameInput('');
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 bg-emerald-600 text-white flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Navigation className="w-5 h-5 transform rotate-45" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight">Bienvenido a RUTEO</h2>
            <p className="text-xs text-emerald-100">
              Crea o elige tu conductor. Todos ven y editan los mismos paquetes y rutas.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {removedNotice && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl p-3 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>{removedNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <label
              htmlFor="driver-onboarding-name"
              className="block text-xs font-bold text-gray-700 dark:text-slate-200"
            >
              Crear conductor (nombre)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="driver-onboarding-name"
                type="text"
                autoFocus
                maxLength={100}
                value={nameInput}
                onChange={e => {
                  setNameInput(e.target.value);
                  setError('');
                }}
                placeholder="Ej. Carlos, María, Ruta Norte..."
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            {error && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-3 px-4 rounded-2xl text-sm font-black shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Conectando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Crear conductor y entrar</span>
                </>
              )}
            </button>
          </form>

          {activeDrivers.length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                O usar un conductor ya creado
              </p>
              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                {activeDrivers.map(driver => (
                  <button
                    key={driver.id}
                    type="button"
                    disabled={busy}
                    onClick={() => onSelectExistingDriver(driver)}
                    className="px-3 py-2 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-gray-200 dark:border-slate-700 hover:border-emerald-400 text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{driver.driverName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface DriverManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDriver: DriverProfile | null;
  activeDrivers: DriverProfile[];
  busy: boolean;
  onSwitchOrAddDriver: (name: string) => Promise<void>;
  onSelectDriver: (driver: DriverProfile) => void;
  onDeleteDriver: (driver: DriverProfile) => Promise<void>;
}

export const DriverManagerModal: React.FC<DriverManagerModalProps> = ({
  isOpen,
  onClose,
  currentDriver,
  activeDrivers,
  busy,
  onSwitchOrAddDriver,
  onSelectDriver,
  onDeleteDriver,
}) => {
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddOrSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    await onSwitchOrAddDriver(trimmed);
    setNewName('');
  };

  return (
    <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-slate-100">
                Conductores activos
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Todos comparten acceso total a paquetes y rutas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar conductores"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Add or change current driver */}
          <form onSubmit={handleAddOrSwitch} className="flex gap-2">
            <input
              type="text"
              maxLength={100}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nuevo conductor o cambiar nombre..."
              className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:border-emerald-500 outline-none"
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Usar</span>
            </button>
          </form>

          {/* List of drivers */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
              Lista de conductores ({activeDrivers.length})
            </p>

            {activeDrivers.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                No hay otros conductores registrados en la nube aún.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-800 border border-gray-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                {activeDrivers.map(driver => {
                  const isCurrent = currentDriver?.id === driver.id;
                  const confirming = confirmDeleteId === driver.id;
                  return (
                    <div
                      key={driver.id}
                      className={`px-3.5 py-3 flex items-center justify-between gap-2 ${
                        isCurrent
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/35'
                          : 'bg-white dark:bg-slate-900'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (!isCurrent) {
                            onSelectDriver(driver);
                            onClose();
                          }
                        }}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        title={isCurrent ? 'Conductor activo en este dispositivo' : `Cambiar a ${driver.driverName}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300'
                          }`}
                        >
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-gray-900 dark:text-slate-100 truncate">
                              {driver.driverName}
                            </p>
                            {isCurrent && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-600 text-white shrink-0">
                                Este equipo
                              </span>
                            )}
                          </div>
                          {!isCurrent && (
                            <p className="text-[11px] text-gray-500 dark:text-slate-400">
                              Tocar para usar este nombre
                            </p>
                          )}
                        </div>
                      </button>

                      {confirming ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              await onDeleteDriver(driver);
                              setConfirmDeleteId(null);
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors"
                          >
                            Eliminar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 px-2 py-1.5 rounded-xl text-[11px] font-bold"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmDeleteId(driver.id)}
                          title={`Eliminar a ${driver.driverName} cuando no esté trabajando`}
                          aria-label={`Eliminar conductor ${driver.driverName}`}
                          className="p-2 rounded-xl text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-800 rounded-2xl p-3">
            Si eliminas a un conductor que ya no está trabajando, se cerrará su sesión automáticamente en su dispositivo y dejará de sincronizar.
          </p>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { X, Navigation, CheckCircle2, AlertCircle, ExternalLink, PauseCircle, MapPin, MessageCircle, Camera, Volume2, VolumeX, Images } from 'lucide-react';
import { DeliveryItem } from '../types';
import { buildWhatsAppUrl } from '../utils/whatsappParser';
import { buildPackageAnnouncement, speakText, stopSpeaking } from '../utils/speechUtils';
import { DEFAULT_APP_SETTINGS, SpeakerSettings } from '../utils/appSettings';

interface ActiveNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  onFinishRoute: () => void;
  onOpenSendPhotosModal?: () => void;
  speakerEnabled?: boolean;
  speakerSettings?: SpeakerSettings;
  onToggleSpeaker?: () => void;
}

export const ActiveNavigationModal: React.FC<ActiveNavigationModalProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateStatus,
  onOpenPhotoModal,
  onFinishRoute,
  onOpenSendPhotosModal,
  speakerEnabled = false,
  speakerSettings = DEFAULT_APP_SETTINGS.speaker,
  onToggleSpeaker
}) => {
  const lastSpokenIdRef = useRef<string | null>(null);

  // Filter only in-coverage items with valid location for active navigation route
  const activeRouteItems = items.filter(i => i.coverageStatus === 'in_coverage' && i.hasLocation !== false);
  const sortedItems = [...activeRouteItems].sort((a, b) => a.orderIndex - b.orderIndex);
  const currentTarget = sortedItems.find(i => i.status === 'pending' || i.status === 'in_transit');
  const deliveredCount = activeRouteItems.filter(i => i.status === 'delivered').length;
  const photosCount = items.filter(i => Boolean(i.deliveryPhoto)).length;
  const totalCount = activeRouteItems.length;
  const progressPercent = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 100;

  useEffect(() => {
    if (!isOpen) {
      lastSpokenIdRef.current = null;
      stopSpeaking();
      return;
    }
    if (!speakerEnabled || !speakerSettings.autoReadOnNavigation) return;

    if (currentTarget && lastSpokenIdRef.current !== currentTarget.id) {
      lastSpokenIdRef.current = currentTarget.id;
      speakText(buildPackageAnnouncement(currentTarget, 'Siguiente entrega', speakerSettings), {
        rate: speakerSettings.rate,
        pitch: speakerSettings.pitch
      });
    } else if (!currentTarget && totalCount > 0 && lastSpokenIdRef.current !== 'completed') {
      lastSpokenIdRef.current = 'completed';
      speakText('Has completado todas las entregas en cobertura.', {
        rate: speakerSettings.rate,
        pitch: speakerSettings.pitch
      });
    }
  }, [isOpen, speakerEnabled, speakerSettings, currentTarget?.id, totalCount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-emerald-600 dark:bg-emerald-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <Navigation className="w-5 h-5 transform rotate-45" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Navegación Activa RUTEO</h2>
              <p className="text-xs text-emerald-100">
                Progreso: {deliveredCount} de {totalCount} entregados en zona ({progressPercent}%)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onToggleSpeaker && (
              <button
                type="button"
                onClick={onToggleSpeaker}
                title={speakerEnabled ? 'Silenciar altavoz' : 'Activar altavoz'}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  speakerEnabled
                    ? 'bg-amber-400 text-amber-950 shadow-xs'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                {speakerEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{speakerEnabled ? 'Altavoz ON' : 'Altavoz'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5">
          <div
            className="bg-emerald-500 h-1.5 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {totalCount === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">No hay destinos en cobertura</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto">
                Para iniciar la navegación, asegúrate de tener al menos una ubicación dentro de San José, Heredia o Cartago.
              </p>
            </div>
          ) : currentTarget ? (
            <div className="space-y-5">
              {/* Next Target Card */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/30 dark:border-emerald-700/50 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white font-black text-sm px-3 py-1 rounded-xl shadow-xs">
                      Paquete #{currentTarget.originalNumber}
                    </span>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded-lg">
                      {currentTarget.province || 'En Cobertura'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => speakText(buildPackageAnnouncement(currentTarget, 'Entrega actual', speakerSettings), {
                        rate: speakerSettings.rate,
                        pitch: speakerSettings.pitch
                      })}
                      className="bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800/70 text-amber-900 dark:text-amber-200 p-1.5 rounded-lg transition-colors"
                      title="Leer entrega en altavoz"
                      aria-label="Leer entrega en altavoz"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-amber-800 dark:text-amber-200 font-medium bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-lg">
                      Pendiente
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  {currentTarget.recipientName && (
                    <p className="text-sm font-extrabold text-emerald-950 dark:text-emerald-200">{currentTarget.recipientName}</p>
                  )}
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{currentTarget.address}</p>
                  {currentTarget.distanceFromPrevKm !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Distancia: ~{currentTarget.distanceFromPrevKm} km ({currentTarget.estimatedMinutes || 5} min)</span>
                    </p>
                  )}
                </div>

                {/* Navigation & Contact App Buttons */}
                <div className="space-y-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${currentTarget.lat},${currentTarget.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all shadow-blue-600/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Google Maps</span>
                    </a>
                    <a
                      href={`https://waze.com/ul?ll=${currentTarget.lat},${currentTarget.lng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-500 hover:bg-sky-600 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all shadow-sky-500/20"
                    >
                      <Navigation className="w-4 h-4 transform rotate-45" />
                      <span>Waze</span>
                    </a>
                  </div>
                  {(() => {
                    const waUrl = buildWhatsAppUrl(currentTarget.phone);
                    if (!waUrl) return null;
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Enviar WhatsApp ({currentTarget.phone})</span>
                      </a>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons for Current Delivery */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 text-center">Registrar resultado de esta entrega:</p>
                <button
                  type="button"
                  onClick={() => onOpenPhotoModal(currentTarget)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>{currentTarget.deliveryPhoto ? 'Ver / Reenviar Foto de Entrega' : 'Tomar Foto de Entrega'}</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onUpdateStatus(currentTarget.id, 'delivered')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Entregado! (Siguiente)</span>
                  </button>
                  <button
                    onClick={() => onUpdateStatus(currentTarget.id, 'failed')}
                    className="bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <span>No se pudo entregar</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">¡Todas las entregas en cobertura completadas!</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 max-w-xs mx-auto">
                  Has completado exitosamente todas las paradas autorizadas de este recorrido.
                </p>
              </div>
              {onOpenSendPhotosModal && photosCount > 0 && (
                <button
                  type="button"
                  onClick={onOpenSendPhotosModal}
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-2xl text-xs font-black inline-flex items-center gap-2 shadow-lg shadow-green-600/20 transition-all"
                >
                  <Images className="w-4 h-4" />
                  <span>Enviar todas las fotos a WhatsApp ({photosCount})</span>
                </button>
              )}
            </div>
          )}

          {/* Remaining Queue Preview */}
          {sortedItems.filter(i => i.status === 'pending' || i.status === 'in_transit').length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">Próximas paradas en cola:</h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {sortedItems
                  .filter(i => i.status === 'pending' || i.status === 'in_transit')
                  .slice(currentTarget ? 1 : 0, 5)
                  .map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-slate-800/80 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-lg font-bold text-[11px] flex items-center justify-center">
                          #{item.originalNumber}
                        </span>
                        <span className="font-medium text-gray-800 dark:text-slate-200 truncate max-w-xs">{item.address}</span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-slate-400">#{idx + 1} en cola</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-xl hover:bg-gray-200/60 dark:hover:bg-slate-700/60 transition-colors"
          >
            <PauseCircle className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            <span>Pausar Recorrido</span>
          </button>
          <button
            onClick={() => {
              onFinishRoute();
              onClose();
            }}
            className="bg-gray-900 dark:bg-slate-700 hover:bg-gray-800 dark:hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs"
          >
            Finalizar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

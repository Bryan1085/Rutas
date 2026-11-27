import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Sparkles, Navigation, Trash2, Search, ShieldAlert, ChevronUp, ChevronDown, Edit3, Phone, MessageCircle, Camera, Send, Share2, X, CheckCircle2, Images, SlidersHorizontal } from 'lucide-react';
import { DeliveryItem, GpsPosition } from '../types';
import { buildWhatsAppUrl } from '../utils/whatsappParser';
import { buildPackageAnnouncement, speakText } from '../utils/speechUtils';
import { WhatsAppMessageModal } from './WhatsAppMessageModal';
import { ShareRouteModal } from './ShareRouteModal';
import { AppSettings, BUTTON_COLOR_STYLES, DEFAULT_APP_SETTINGS } from '../utils/appSettings';

interface MainDashboardProps {
  items: DeliveryItem[];
  currentGps?: GpsPosition | null;
  speakerEnabled?: boolean;
  appSettings?: AppSettings;
  onOpenInputModal: () => void;
  onOpenOptimizerModal: () => void;
  onOpenNavigationModal: () => void;
  onOpenSavedRoutesModal: () => void;
  onOpenRequestLocationsModal: () => void;
  onOpenSendPhotosModal: () => void;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onEditItem: (item: DeliveryItem) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  onSelectPackage: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  items,
  currentGps,
  speakerEnabled = false,
  appSettings = DEFAULT_APP_SETTINGS,
  onOpenInputModal,
  onOpenOptimizerModal,
  onOpenNavigationModal,
  onOpenSavedRoutesModal,
  onOpenRequestLocationsModal,
  onOpenSendPhotosModal,
  onUpdateStatus,
  onEditItem,
  onOpenPhotoModal,
  onSelectPackage,
  onDeleteItem,
  onClearAllItems
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(appSettings.general.defaultListExpanded);
  const [isWhatsAppMsgOpen, setIsWhatsAppMsgOpen] = useState<boolean>(false);
  const [isShareRouteOpen, setIsShareRouteOpen] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setIsBottomSheetOpen(appSettings.general.defaultListExpanded);
  }, [appSettings.general.defaultListExpanded]);

  const { visibleButtons, buttonColors, speaker: speakerSettings, general: generalSettings } = appSettings;
  const optimizeStyle = BUTTON_COLOR_STYLES[buttonColors.optimize];
  const startRouteStyle = BUTTON_COLOR_STYLES[buttonColors.startRoute];
  const shareWazeStyle = BUTTON_COLOR_STYLES[buttonColors.shareWaze];
  const whatsappStyle = BUTTON_COLOR_STYLES[buttonColors.whatsappBtn];
  const photoStyle = BUTTON_COLOR_STYLES[buttonColors.photoBtn];

  const locatedItemsCount = items.filter(i => i.hasLocation !== false && i.coverageStatus !== 'incomplete').length;
  const photosCount = items.filter(i => Boolean(i.deliveryPhoto)).length;
  const missingLocationWithPhoneCount = items.filter(
    i => (i.hasLocation === false || i.coverageStatus === 'incomplete') && Boolean(buildWhatsAppUrl(i.phone))
  ).length;
  const anyWithPhoneCount = items.filter(i => Boolean(buildWhatsAppUrl(i.phone))).length;

  const myInCoverageItems = items.filter(
    i => i.coverageStatus === 'in_coverage' && i.hasLocation !== false
  );
  const outOfCoverageCount = items.filter(i => i.coverageStatus === 'out_of_coverage').length;
  const myOutOfCoverageCount = outOfCoverageCount;

  const filteredItems = items.filter(item => {
    const matchesSearch = item.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(item.originalNumber).includes(searchTerm) ||
                          String(item.orderIndex + 1).includes(searchTerm) ||
                          (item.recipientName && item.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (item.province && item.province.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (item.phone && item.phone.includes(searchTerm));
    const matchesStatus = statusFilter === 'all' ? item.status !== 'delivered' : item.status === statusFilter;
    const matchesCoverage = coverageFilter === 'all' || item.coverageStatus === coverageFilter;
    return matchesSearch && matchesStatus && matchesCoverage;
  }).sort((a, b) => a.orderIndex - b.orderIndex);

  const hasActionButtons =
    visibleButtons.optimize ||
    visibleButtons.startRoute ||
    visibleButtons.shareWaze ||
    visibleButtons.requestLocations ||
    visibleButtons.sendPhotos ||
    visibleButtons.editWhatsApp;

  const hasActiveFilters = searchTerm.trim() !== '' || statusFilter !== 'all' || coverageFilter !== 'all';

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-16">
      {/* Compact Action Bar */}
      {hasActionButtons && (
        <div className="flex flex-wrap gap-2 sm:gap-2.5">
          {visibleButtons.optimize && (
            <button
              onClick={onOpenOptimizerModal}
              disabled={myInCoverageItems.length === 0}
              className={`flex-1 min-w-[140px] ${optimizeStyle.solid} px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Optimizar Ruta</span>
            </button>
          )}

          {visibleButtons.startRoute && (
            <button
              onClick={() => {
                if (myOutOfCoverageCount > 0) {
                  if (!confirm(`Atención: Tienes ${myOutOfCoverageCount} paquete(s) fuera de zona de cobertura (San José, Heredia, Cartago). No participarán en la navegación. ¿Deseas iniciar de todos modos?`)) {
                    return;
                  }
                }
                onOpenNavigationModal();
              }}
              disabled={myInCoverageItems.length === 0}
              className={`flex-1 min-w-[140px] ${startRouteStyle.solid} px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Navigation className="w-4 h-4 transform rotate-45 shrink-0" />
              <span>Navegar GPS</span>
            </button>
          )}

          {visibleButtons.shareWaze && (
            <button
              onClick={() => setIsShareRouteOpen(true)}
              disabled={locatedItemsCount === 0}
              className={`flex-1 min-w-[140px] ${shareWazeStyle.solid} px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Share2 className="w-4 h-4 shrink-0" />
              <span>Compartir a Waze</span>
            </button>
          )}

          {visibleButtons.requestLocations && (
            <button
              onClick={onOpenRequestLocationsModal}
              disabled={anyWithPhoneCount === 0}
              className={`flex-1 min-w-[165px] ${whatsappStyle.soft} px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Send className={`w-4 h-4 shrink-0 ${whatsappStyle.badgeText}`} />
              <span>
                Pedir Ubicaciones
                {missingLocationWithPhoneCount > 0
                  ? ` (${missingLocationWithPhoneCount})`
                  : anyWithPhoneCount > 0
                  ? ` (${anyWithPhoneCount})`
                  : ''}
              </span>
            </button>
          )}

          {visibleButtons.sendPhotos && (
            <button
              onClick={onOpenSendPhotosModal}
              disabled={photosCount === 0}
              className={`flex-1 min-w-[145px] ${whatsappStyle.solid} px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <Images className="w-4 h-4 shrink-0" />
              <span>Enviar Fotos{photosCount > 0 ? ` (${photosCount})` : ''}</span>
            </button>
          )}

          {visibleButtons.editWhatsApp && (
            <button
              onClick={() => setIsWhatsAppMsgOpen(true)}
              className={`flex-1 min-w-[165px] ${whatsappStyle.soft} px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95`}
            >
              <MessageCircle className={`w-4 h-4 shrink-0 ${whatsappStyle.badgeText}`} />
              <span>Editar mensaje WhatsApp</span>
            </button>
          )}
        </div>
      )}

      {/* Out of coverage alert if any */}
      {generalSettings.showOutOfCoverageBanner && outOfCoverageCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
            {outOfCoverageCount} paquete(s) fuera de cobertura (San José, Heredia, Cartago) excluidos de la ruta.
          </p>
        </div>
      )}

      {/* Package List Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-slate-800 shadow-lg overflow-hidden transition-colors">
        <div
          onClick={() => setIsBottomSheetOpen(!isBottomSheetOpen)}
          className={`${generalSettings.compactList ? 'px-3.5 py-2' : 'px-4 sm:px-6 py-2.5 sm:py-3.5'} bg-gray-50 dark:bg-slate-800/80 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-slate-800 transition-colors`}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center justify-center font-bold text-xs">
              {filteredItems.length}
            </div>
            <h3 className="text-xs sm:text-sm font-black text-gray-900 dark:text-slate-100">Lista de Paquetes</h3>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                if (!isBottomSheetOpen) {
                  setIsBottomSheetOpen(true);
                  setShowFilters(true);
                } else {
                  setShowFilters(prev => !prev);
                }
              }}
              aria-expanded={showFilters}
              aria-label="Mostrar u ocultar búsqueda y filtros"
              title={showFilters ? 'Ocultar búsqueda y filtros' : 'Buscar o filtrar paquetes'}
              className={`relative px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                showFilters || hasActiveFilters
                  ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filtrar</span>
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              className="text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold"
            >
              <span>{isBottomSheetOpen ? 'Contraer' : 'Expandir'}</span>
              {isBottomSheetOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isBottomSheetOpen && (
          <div className={generalSettings.compactList ? 'p-2.5 sm:p-4 space-y-2.5' : 'p-3 sm:p-5 space-y-3'}>
            {/* Collapsible Search & Filters (hidden by default for compact mobile view) */}
            {showFilters && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-1">
                <div className="relative flex-1 w-full sm:w-auto">
                  <Search className="w-3.5 h-3.5 text-gray-400 dark:text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar #paquete, nombre, teléfono..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl pl-8 pr-8 py-2 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <select
                    value={coverageFilter}
                    onChange={e => setCoverageFilter(e.target.value)}
                    className="flex-1 sm:flex-none bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 outline-none"
                  >
                    <option value="all">Todas las zonas</option>
                    <option value="in_coverage">En cobertura</option>
                    <option value="incomplete">Datos incompletos</option>
                    <option value="out_of_coverage">Fuera de cobertura</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="flex-1 sm:flex-none bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 outline-none"
                  >
                    <option value="all">Activos</option>
                    <option value="pending">Pendientes</option>
                    <option value="in_transit">En camino</option>
                    <option value="failed">No entregados</option>
                    <option value="delivered">Entregados</option>
                  </select>
                </div>
              </div>
            )}

            {/* List */}
            {filteredItems.length === 0 ? (
              items.length > 0 && items.every(i => i.status === 'delivered') && statusFilter === 'all' && !searchTerm && coverageFilter === 'all' ? (
                <div className="text-center py-10 space-y-3 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-700">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">¡Todos los paquetes han sido entregados!</h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 max-w-sm mx-auto">
                    Los paquetes entregados desaparecen de la lista y del mapa automáticamente.
                  </p>
                  {photosCount > 0 && (
                    <button
                      onClick={onOpenSendPhotosModal}
                      className={`${whatsappStyle.solid} px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5`}
                    >
                      <Images className="w-4 h-4" />
                      <span>Enviar Fotos ({photosCount})</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 space-y-3 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 dark:text-slate-200">No hay ubicaciones registradas</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                    Agrega nuevos paquetes con el botón flotante para empezar a rutear.
                  </p>
                  <button
                    onClick={onOpenInputModal}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Paquete</span>
                  </button>
                </div>
              )
            ) : (
              <div className={`${generalSettings.compactList ? 'space-y-1.5 max-h-[540px]' : 'space-y-3 max-h-[500px]'} overflow-y-auto pr-0.5`}>
                {filteredItems.map(item => {
                  const isIncomplete = item.hasLocation === false || item.coverageStatus === 'incomplete';
                  const isFailed = item.status === 'failed';
                  const isDeliveredWithoutPhoto = item.status === 'delivered' && !item.deliveryPhoto;
                  const isDeliveredComplete = item.status === 'delivered' && Boolean(item.deliveryPhoto);
                  const compact = generalSettings.compactList;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (speakerEnabled && speakerSettings.autoReadOnListTap) {
                          speakText(buildPackageAnnouncement(item, undefined, speakerSettings), {
                            rate: speakerSettings.rate,
                            pitch: speakerSettings.pitch
                          });
                        }
                        if (isIncomplete) {
                          onEditItem(item);
                        } else {
                          onSelectPackage(item.id);
                        }
                      }}
                      className={`${compact ? 'px-2.5 py-2 rounded-xl gap-2' : 'p-4 rounded-2xl gap-3'} border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:shadow-md ${
                        isIncomplete
                          ? 'bg-orange-50/95 dark:bg-orange-950/45 border-orange-400 dark:border-orange-700/80 hover:border-orange-500'
                          : isFailed
                          ? 'bg-red-50/90 dark:bg-red-950/45 border-red-400 dark:border-red-700/80 hover:border-red-500'
                          : isDeliveredWithoutPhoto
                          ? 'bg-yellow-50/95 dark:bg-yellow-950/40 border-yellow-400 dark:border-yellow-700/80 hover:border-yellow-500'
                          : isDeliveredComplete
                          ? 'bg-emerald-100/80 dark:bg-emerald-950/55 border-emerald-500 dark:border-emerald-700/90 hover:border-emerald-600'
                          : item.coverageStatus === 'out_of_coverage'
                          ? 'bg-red-50/60 dark:bg-red-950/30 border-red-200 dark:border-red-800/70 hover:border-red-400'
                          : 'bg-white dark:bg-slate-800/70 border-gray-200 dark:border-slate-700/80 hover:border-emerald-400 dark:hover:border-emerald-500/70 shadow-2xs'
                      }`}
                    >
                      <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3.5'} min-w-0 flex-1 w-full sm:w-auto`}>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`${compact ? 'text-[10px] w-5 text-center text-gray-500 dark:text-slate-400' : 'w-7 h-7 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg text-xs flex items-center justify-center'} font-bold`}
                            title="Orden de visita"
                          >
                            {item.orderIndex + 1}
                          </span>

                          <span
                            className={`${compact ? 'w-8 h-8 rounded-xl text-[11px]' : 'w-10 h-10 rounded-2xl text-xs shadow-md'} font-black flex items-center justify-center ${
                              isIncomplete
                                ? 'bg-orange-500 text-white'
                                : isFailed
                                ? 'bg-red-600 text-white ring-2 ring-red-400'
                                : isDeliveredWithoutPhoto
                                ? 'bg-yellow-400 text-yellow-950 ring-2 ring-yellow-500'
                                : isDeliveredComplete
                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                                : item.coverageStatus === 'out_of_coverage'
                                ? 'bg-red-600 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                            title={
                              isIncomplete
                                ? `Paquete #${item.originalNumber} sin ubicación`
                                : isFailed
                                ? `Paquete #${item.originalNumber} no se pudo entregar`
                                : isDeliveredWithoutPhoto
                                ? `Paquete #${item.originalNumber} entregado sin foto`
                                : isDeliveredComplete
                                ? `Paquete #${item.originalNumber} entregado completo`
                                : `Paquete #${item.originalNumber}`
                            }
                          >
                            #{item.originalNumber}
                          </span>
                        </div>

                        <div className={`${compact ? 'space-y-0' : 'space-y-0.5'} min-w-0 flex-1`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            {item.recipientName && (
                              <span className="text-xs font-extrabold text-gray-900 dark:text-slate-100 truncate max-w-[140px] sm:max-w-[200px] shrink-0">
                                {item.recipientName}
                              </span>
                            )}
                            {item.recipientName && <span className="text-gray-300 dark:text-slate-600 text-[10px] shrink-0">·</span>}
                            <p
                              title={isIncomplete ? 'Sin ubicación registrada' : item.address}
                              className={`${item.recipientName ? 'font-medium text-[11px]' : 'font-bold text-xs'} truncate flex-1 ${
                                isDeliveredComplete
                                  ? 'text-emerald-950 dark:text-emerald-200'
                                  : isFailed
                                  ? 'text-red-950 dark:text-red-200'
                                  : isDeliveredWithoutPhoto
                                  ? 'text-yellow-950 dark:text-yellow-200'
                                  : item.recipientName
                                  ? 'text-gray-600 dark:text-slate-300'
                                  : 'text-gray-900 dark:text-slate-100'
                              }`}
                            >
                              {isIncomplete
                                ? 'Sin ubicación registrada'
                                : /^https?:\/\//i.test(item.address.trim())
                                ? 'Ubicación en mapa'
                                : item.address}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-500 dark:text-slate-400 flex-wrap">
                            <span
                              className={`font-bold ${
                                isIncomplete
                                  ? 'text-orange-700 dark:text-orange-300'
                                  : isFailed
                                  ? 'text-red-700 dark:text-red-300'
                                  : isDeliveredWithoutPhoto
                                  ? 'text-yellow-800 dark:text-yellow-300'
                                  : isDeliveredComplete
                                  ? 'text-emerald-800 dark:text-emerald-300'
                                  : item.coverageStatus === 'out_of_coverage'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {isIncomplete ? 'Sin ubicación' : (item.province || 'Costa Rica')}
                            </span>
                            {item.phone && (() => {
                              const waUrl = buildWhatsAppUrl(item.phone);
                              return (
                                <>
                                  <span>•</span>
                                  {waUrl ? (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold underline decoration-emerald-400/70"
                                      title="Abrir chat en WhatsApp"
                                    >
                                      <span>{item.phone}</span>
                                    </a>
                                  ) : (
                                    <span className="flex items-center gap-0.5 text-gray-700 dark:text-slate-300 font-medium">
                                      <Phone className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                      {item.phone}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                            {item.notes && !/^https?:\/\//i.test(item.notes.trim()) && (
                              <>
                                <span>•</span>
                                <span className="text-gray-600 dark:text-slate-300 truncate max-w-[160px] sm:max-w-[220px]">{item.notes}</span>
                              </>
                            )}
                          </div>
                          {isFailed && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'failed');
                              }}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-red-700 dark:text-red-300 bg-red-100/90 dark:bg-red-950/70 hover:bg-red-200/80 dark:hover:bg-red-900/70 border border-red-300 dark:border-red-800 px-2 py-0.5 rounded-md max-w-full transition-colors"
                              title="Tocar para editar el motivo de no entrega"
                            >
                              <span className="truncate">
                                {item.failureReason ? `Motivo: ${item.failureReason}` : '+ Agregar motivo de no entrega'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={`flex items-center ${compact ? 'gap-1' : 'gap-2 pt-2 border-t sm:border-t-0 sm:pt-0 border-gray-100 dark:border-slate-800'} w-full sm:w-auto justify-end flex-wrap`}
                        onClick={e => e.stopPropagation()}
                      >
                        {isIncomplete && (
                          <span className="bg-orange-100 dark:bg-orange-950/80 text-orange-900 dark:text-orange-200 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-300 dark:border-orange-700">
                            Falta ubic.
                          </span>
                        )}

                        {isFailed && !visibleButtons.rowStatus && (
                          <span className="bg-red-200 dark:bg-red-950/90 text-red-950 dark:text-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-400 dark:border-red-700">
                            No entregado
                          </span>
                        )}

                        {isDeliveredWithoutPhoto && (
                          <span className="bg-yellow-300 dark:bg-yellow-900/80 text-yellow-950 dark:text-yellow-100 text-[10px] font-bold px-2 py-0.5 rounded-md border border-yellow-500 dark:border-yellow-600 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Falta foto</span>
                          </span>
                        )}

                        {isDeliveredComplete && !visibleButtons.rowStatus && (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>Entregado</span>
                          </span>
                        )}

                        {item.coverageStatus === 'out_of_coverage' && !isIncomplete && !isFailed && (
                          <span className="bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-red-200 dark:border-red-800">
                            Fuera zona
                          </span>
                        )}

                        {/* Photo Button (Icon Only) */}
                        {visibleButtons.rowPhoto && (
                          <button
                            onClick={() => onOpenPhotoModal(item)}
                            className={`${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} flex items-center justify-center transition-colors border shadow-2xs ${
                              isDeliveredWithoutPhoto
                                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border-yellow-500'
                                : item.deliveryPhoto
                                ? `${photoStyle.solid} border-transparent`
                                : 'bg-gray-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-gray-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 border-gray-200 dark:border-slate-600'
                            }`}
                            title={item.deliveryPhoto ? 'Ver o reenviar foto de entrega' : 'Tomar foto de entrega'}
                            aria-label={item.deliveryPhoto ? 'Ver foto de entrega' : 'Tomar foto de entrega'}
                          >
                            <Camera className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                          </button>
                        )}

                        {/* WhatsApp Button (Icon Only, only if phone saved) */}
                        {visibleButtons.rowWhatsApp && (() => {
                          const waUrl = buildWhatsAppUrl(item.phone);
                          if (!waUrl) return null;
                          return (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`${whatsappStyle.solid} ${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} flex items-center justify-center transition-colors shadow-2xs`}
                              title={`Abrir WhatsApp (${item.phone})`}
                              aria-label="Abrir WhatsApp"
                            >
                              <MessageCircle className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                            </a>
                          );
                        })()}

                        {/* Edit Button (Icon Only) */}
                        {visibleButtons.rowEdit && (
                          <button
                            onClick={() => onEditItem(item)}
                            className={`${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} flex items-center justify-center transition-colors border ${
                              isIncomplete
                                ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
                                : 'bg-gray-100 dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-gray-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 border-gray-200 dark:border-slate-600'
                            }`}
                            title={isIncomplete ? 'Completar ubicación' : 'Editar paquete y ubicación'}
                            aria-label="Editar paquete"
                          >
                            <Edit3 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                          </button>
                        )}

                        {visibleButtons.rowStatus && (
                          <select
                            value={item.status}
                            onChange={e => onUpdateStatus(item.id, e.target.value as DeliveryItem['status'])}
                            className={`${compact ? 'ml-1 text-[11px] px-2 py-1 rounded-lg' : 'text-xs px-2.5 py-1.5 rounded-xl'} font-semibold border outline-none transition-colors ${
                              isDeliveredWithoutPhoto
                                ? 'bg-yellow-200 dark:bg-yellow-900/80 text-yellow-950 dark:text-yellow-100 border-yellow-400 dark:border-yellow-600'
                                : isDeliveredComplete
                                ? 'bg-emerald-200 dark:bg-emerald-900/80 text-emerald-950 dark:text-emerald-100 border-emerald-400 dark:border-emerald-600'
                                : item.status === 'in_transit'
                                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                                : isFailed
                                ? 'bg-red-200 dark:bg-red-950/80 text-red-950 dark:text-red-200 border-red-400 dark:border-red-700'
                                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                            }`}
                          >
                            <option value="pending">Pendiente</option>
                            <option value="in_transit">En camino</option>
                            <option value="delivered">Entregado</option>
                            <option value="failed">No entregado</option>
                          </select>
                        )}

                        {visibleButtons.rowDelete && (
                          generalSettings.confirmBeforeDelete && confirmDeleteId === item.id ? (
                            <button
                              onClick={() => {
                                onDeleteItem(item.id);
                                setConfirmDeleteId(null);
                              }}
                              onBlur={() => setConfirmDeleteId(null)}
                              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg text-[11px] font-bold transition-colors"
                              title="Toca de nuevo para confirmar eliminación"
                            >
                              ¿Borrar?
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (generalSettings.confirmBeforeDelete) {
                                  setConfirmDeleteId(item.id);
                                } else {
                                  onDeleteItem(item.id);
                                }
                              }}
                              className={`text-gray-400 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 ${compact ? 'p-1.5 rounded-lg' : 'p-2 rounded-xl'} hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors`}
                              title="Eliminar paquete"
                              aria-label="Eliminar paquete"
                            >
                              <Trash2 className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <WhatsAppMessageModal
        isOpen={isWhatsAppMsgOpen}
        onClose={() => setIsWhatsAppMsgOpen(false)}
      />

      <ShareRouteModal
        isOpen={isShareRouteOpen}
        onClose={() => setIsShareRouteOpen(false)}
        items={items}
        currentGps={currentGps}
      />
    </div>
  );
};

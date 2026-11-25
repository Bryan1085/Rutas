import React, { useState } from 'react';
import { Plus, MapPin, Sparkles, Navigation, Trash2, Search, ShieldAlert, ChevronUp, ChevronDown, Edit3, Phone, MessageCircle, Camera, Send, Share2, Lock, Eye } from 'lucide-react';
import { DeliveryItem, GpsPosition } from '../types';
import { buildWhatsAppUrl, buildLocationRequestMessage } from '../utils/whatsappParser';
import { WhatsAppMessageModal } from './WhatsAppMessageModal';
import { ShareRouteModal } from './ShareRouteModal';

interface MainDashboardProps {
  items: DeliveryItem[];
  currentUserId?: string | null;
  currentGps?: GpsPosition | null;
  onOpenInputModal: () => void;
  onOpenOptimizerModal: () => void;
  onOpenNavigationModal: () => void;
  onOpenSavedRoutesModal: () => void;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onEditItem: (item: DeliveryItem) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  onSelectPackage: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems: () => void;
  showMap: boolean;
  onToggleShowMap: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  items,
  currentUserId = null,
  currentGps,
  onOpenInputModal,
  onOpenOptimizerModal,
  onOpenNavigationModal,
  onOpenSavedRoutesModal,
  onUpdateStatus,
  onEditItem,
  onOpenPhotoModal,
  onSelectPackage,
  onDeleteItem,
  onClearAllItems,
  showMap,
  onToggleShowMap
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<string>('all');
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState<boolean>(true);
  const [isWhatsAppMsgOpen, setIsWhatsAppMsgOpen] = useState<boolean>(false);
  const [isShareRouteOpen, setIsShareRouteOpen] = useState<boolean>(false);

  const isOwnItem = (item: DeliveryItem) =>
    currentUserId ? item.assignedDriverId === currentUserId : !item.assignedDriverId;

  const locatedItemsCount = items.filter(i => i.hasLocation !== false && i.coverageStatus !== 'incomplete').length;

  const myInCoverageItems = items.filter(
    i => isOwnItem(i) && i.coverageStatus === 'in_coverage' && i.hasLocation !== false
  );
  const outOfCoverageCount = items.filter(i => i.coverageStatus === 'out_of_coverage').length;

  const filteredItems = items.filter(item => {
    const matchesSearch = item.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          String(item.originalNumber).includes(searchTerm) ||
                          String(item.orderIndex + 1).includes(searchTerm) ||
                          (item.province && item.province.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (item.phone && item.phone.includes(searchTerm));
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCoverage = coverageFilter === 'all' || item.coverageStatus === coverageFilter;
    return matchesSearch && matchesStatus && matchesCoverage;
  }).sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="space-y-4 pb-16">
      {/* Compact Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <button
          onClick={onOpenOptimizerModal}
          disabled={myInCoverageItems.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Optimizar Ruta</span>
        </button>

        <button
          onClick={() => {
            if (outOfCoverageCount > 0) {
              if (!confirm(`Atención: Hay ${outOfCoverageCount} paquete(s) fuera de zona de cobertura (San José, Heredia, Cartago). No participarán en la navegación. ¿Deseas iniciar de todos modos?`)) {
                return;
              }
            }
            onOpenNavigationModal();
          }}
          disabled={myInCoverageItems.length === 0}
          className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-teal-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Navigation className="w-4 h-4 transform rotate-45 shrink-0" />
          <span>Iniciar Ruta</span>
        </button>

        <button
          onClick={() => setIsShareRouteOpen(true)}
          disabled={locatedItemsCount === 0}
          className="bg-sky-500 hover:bg-sky-600 text-white px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Share2 className="w-4 h-4 shrink-0" />
          <span>Compartir a Waze</span>
        </button>

        <button
          onClick={onToggleShowMap}
          className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-200 px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
        >
          <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{showMap ? 'Ocultar Mapa' : 'Ver Mapa'}</span>
        </button>

        <button
          onClick={() => setIsWhatsAppMsgOpen(true)}
          className="col-span-2 sm:col-span-1 bg-green-50 hover:bg-green-100 text-green-900 border border-green-300 px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
        >
          <MessageCircle className="w-4 h-4 text-green-700 shrink-0" />
          <span>Editar mensaje WhatsApp</span>
        </button>
      </div>

      {/* Out of coverage alert if any */}
      {outOfCoverageCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-xs">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <p className="text-xs font-semibold text-amber-950">
            {outOfCoverageCount} paquete(s) fuera de cobertura (San José, Heredia, Cartago) excluidos de la ruta.
          </p>
        </div>
      )}

      {/* Package List Panel */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden">
        <div
          onClick={() => setIsBottomSheetOpen(!isBottomSheetOpen)}
          className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-xs">
              {filteredItems.length}
            </div>
            <h3 className="text-sm font-black text-gray-900">Lista de Paquetes</h3>
          </div>

          <button className="text-gray-500 hover:text-gray-900 p-1.5 rounded-xl flex items-center gap-1 text-xs font-bold">
            <span>{isBottomSheetOpen ? 'Contraer' : 'Expandir'}</span>
            {isBottomSheetOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isBottomSheetOpen && (
          <div className="p-6 space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full sm:w-auto">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar dirección, teléfono, #paquete..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-2xl pl-10 pr-4 py-2.5 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <select
                  value={coverageFilter}
                  onChange={e => setCoverageFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="all">Todas las zonas</option>
                  <option value="in_coverage">En cobertura</option>
                  <option value="incomplete">Datos incompletos</option>
                  <option value="out_of_coverage">Fuera de cobertura</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="in_transit">En camino</option>
                  <option value="delivered">Entregadas</option>
                  <option value="failed">Fallidas</option>
                </select>
              </div>
            </div>

            {/* List */}
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 space-y-3 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <MapPin className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800">No hay ubicaciones registradas</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
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
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {filteredItems.map(item => {
                  const isOwner = isOwnItem(item);
                  const isIncomplete = item.hasLocation === false || item.coverageStatus === 'incomplete';
                  const isFailed = item.status === 'failed';
                  const isDeliveredWithoutPhoto = item.status === 'delivered' && !item.deliveryPhoto;
                  const isDeliveredComplete = item.status === 'delivered' && Boolean(item.deliveryPhoto);
                  return (
                    <div
                      key={item.id}
                      onClick={() => (isIncomplete && isOwner ? onEditItem(item) : onSelectPackage(item.id))}
                      className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:shadow-md ${
                        isIncomplete
                          ? 'bg-orange-50/95 border-orange-400 hover:border-orange-500'
                          : isFailed
                          ? 'bg-red-50/90 border-red-400 hover:border-red-500'
                          : isDeliveredWithoutPhoto
                          ? 'bg-yellow-50/95 border-yellow-400 hover:border-yellow-500'
                          : isDeliveredComplete
                          ? 'bg-emerald-100/80 border-emerald-500 hover:border-emerald-600'
                          : item.coverageStatus === 'out_of_coverage'
                          ? 'bg-red-50/60 border-red-200 hover:border-red-400'
                          : 'bg-white border-gray-200 hover:border-emerald-400 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-7 h-7 bg-gray-100 text-gray-700 rounded-lg font-bold text-xs flex items-center justify-center" title="Orden de visita">
                            #{item.orderIndex + 1}
                          </span>

                          <span
                            className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shadow-md ${
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

                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p
                              title={isIncomplete ? 'Sin ubicación registrada' : item.address}
                              className={`font-bold text-xs sm:text-sm truncate max-w-[210px] sm:max-w-xs md:max-w-sm ${
                                isDeliveredComplete
                                  ? 'text-emerald-950'
                                  : isFailed
                                  ? 'text-red-950'
                                  : isDeliveredWithoutPhoto
                                  ? 'text-yellow-950'
                                  : 'text-gray-900'
                              }`}
                            >
                              {isIncomplete
                                ? 'Sin ubicación registrada'
                                : /^https?:\/\//i.test(item.address.trim())
                                ? 'Ubicación en mapa'
                                : item.address}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500 flex-wrap">
                            <span
                              className={`font-bold ${
                                isIncomplete
                                  ? 'text-orange-700'
                                  : isFailed
                                  ? 'text-red-700'
                                  : isDeliveredWithoutPhoto
                                  ? 'text-yellow-800'
                                  : isDeliveredComplete
                                  ? 'text-emerald-800'
                                  : item.coverageStatus === 'out_of_coverage'
                                  ? 'text-red-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {isIncomplete ? 'Datos incompletos' : (item.province || 'Costa Rica')}
                            </span>
                            {item.phone && (() => {
                              const waUrl = buildWhatsAppUrl(item.phone);
                              const waPresetUrl = buildWhatsAppUrl(
                                item.phone,
                                buildLocationRequestMessage(item.originalNumber)
                              );
                              return (
                                <>
                                  <span>•</span>
                                  {waUrl ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <a
                                        href={waUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold underline decoration-emerald-400/70"
                                        title="Abrir chat en WhatsApp"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                                        <span>{item.phone}</span>
                                      </a>
                                      {waPresetUrl && (
                                        <a
                                          href={waPresetUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300 p-1 rounded-full flex items-center justify-center transition-colors"
                                          title="Enviar mensaje preestablecido pidiendo ubicación por WhatsApp"
                                          aria-label="Pedir ubicación por WhatsApp"
                                        >
                                          <Send className="w-2.5 h-2.5 text-green-700" />
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                                      <Phone className="w-3 h-3 text-emerald-600" />
                                      {item.phone}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100" onClick={e => e.stopPropagation()}>
                        {!isOwner && (
                          <span
                            className="bg-indigo-50 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-indigo-200 inline-flex items-center gap-1"
                            title="Solo puedes editar los paquetes de tu propio perfil"
                          >
                            <Lock className="w-2.5 h-2.5 shrink-0" />
                            <span>{item.assignedDriverName || 'Otro conductor'} • Solo lectura</span>
                          </span>
                        )}

                        {isIncomplete && (
                          <span className="bg-orange-100 text-orange-900 text-[10px] font-bold px-2.5 py-0.5 rounded-lg border border-orange-300">
                            Falta ubicación
                          </span>
                        )}

                        {isFailed && (
                          <span className="bg-red-200 text-red-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-red-400">
                            No entregada
                          </span>
                        )}

                        {isDeliveredWithoutPhoto && (
                          <span className="bg-yellow-300 text-yellow-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-yellow-500">
                            Falta foto
                          </span>
                        )}

                        {isDeliveredComplete && (
                          <span className="bg-emerald-200 text-emerald-950 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400">
                            Entregado
                          </span>
                        )}

                        {item.coverageStatus === 'out_of_coverage' && !isIncomplete && !isFailed && (
                          <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-red-200">
                            Fuera de cobertura
                          </span>
                        )}

                        {/* Photo Button (Icon Only) */}
                        {isOwner ? (
                          <button
                            onClick={() => onOpenPhotoModal(item)}
                            className={`p-2 rounded-xl flex items-center justify-center transition-colors border shadow-2xs ${
                              isDeliveredWithoutPhoto
                                ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-950 border-yellow-500'
                                : item.deliveryPhoto
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                                : 'bg-gray-100 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-gray-200'
                            }`}
                            title={item.deliveryPhoto ? 'Ver o reenviar foto de entrega' : 'Tomar foto de entrega'}
                            aria-label={item.deliveryPhoto ? 'Ver foto de entrega' : 'Tomar foto de entrega'}
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        ) : item.deliveryPhoto ? (
                          <button
                            onClick={() => onOpenPhotoModal(item)}
                            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border border-indigo-200 p-2 rounded-xl flex items-center justify-center transition-colors shadow-2xs"
                            title="Ver foto de entrega (solo lectura)"
                            aria-label="Ver foto de entrega"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : null}

                        {/* WhatsApp Buttons (Icon Only, only if phone saved) */}
                        {(() => {
                          const waUrl = buildWhatsAppUrl(item.phone);
                          const waPresetUrl = buildWhatsAppUrl(
                            item.phone,
                            buildLocationRequestMessage(item.originalNumber)
                          );
                          if (!waUrl) return null;
                          return (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-xl flex items-center justify-center transition-colors shadow-2xs"
                                title={`Abrir WhatsApp (${item.phone})`}
                                aria-label="Abrir WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </a>
                              {waPresetUrl && (
                                <a
                                  href={waPresetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-green-100 hover:bg-green-200 text-green-900 border border-green-300 p-2 rounded-full flex items-center justify-center transition-colors shadow-2xs"
                                  title="Enviar mensaje preestablecido para pedir ubicación"
                                  aria-label="Enviar mensaje preestablecido"
                                >
                                  <Send className="w-3.5 h-3.5 text-green-700" />
                                </a>
                              )}
                            </div>
                          );
                        })()}

                        {/* Waze Button (Icon Only, only when package has location) */}
                        {!isIncomplete && (
                          <a
                            href={`https://waze.com/ul?ll=${item.lat},${item.lng}&navigate=yes`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-sky-500 hover:bg-sky-600 text-white p-2 rounded-xl flex items-center justify-center transition-colors shadow-2xs"
                            title="Abrir ubicación en Waze"
                            aria-label="Abrir en Waze"
                          >
                            <Navigation className="w-4 h-4 transform rotate-45" />
                          </a>
                        )}

                        {/* Edit Button (Icon Only, only owner) */}
                        {isOwner && (
                          <button
                            onClick={() => onEditItem(item)}
                            className={`p-2 rounded-xl flex items-center justify-center transition-colors border ${
                              isIncomplete
                                ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500'
                                : 'bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border-gray-200'
                            }`}
                            title={isIncomplete ? 'Completar ubicación' : 'Editar paquete y ubicación'}
                            aria-label="Editar paquete"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {!isIncomplete && item.coverageStatus === 'in_coverage' && (
                          isOwner ? (
                            <select
                              value={item.status}
                              onChange={e => onUpdateStatus(item.id, e.target.value as DeliveryItem['status'])}
                              className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl border outline-none transition-colors ${
                                isDeliveredWithoutPhoto
                                  ? 'bg-yellow-200 text-yellow-950 border-yellow-400'
                                  : isDeliveredComplete
                                  ? 'bg-emerald-200 text-emerald-950 border-emerald-400'
                                  : item.status === 'in_transit'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : isFailed
                                  ? 'bg-red-200 text-red-950 border-red-400'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              <option value="pending">Pendiente</option>
                              <option value="in_transit">En camino</option>
                              <option value="delivered">Entregada</option>
                              <option value="failed">No entregada</option>
                            </select>
                          ) : (item.status === 'pending' || item.status === 'in_transit') ? (
                            <span
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                                item.status === 'in_transit'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}
                            >
                              {item.status === 'in_transit' ? 'En camino' : 'Pendiente'}
                            </span>
                          ) : null
                        )}

                        {isOwner && (
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="text-gray-400 hover:text-red-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                            title="Eliminar paquete"
                            aria-label="Eliminar paquete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

import React, { useState } from 'react';
import { Plus, MapPin, Sparkles, Navigation, CheckCircle2, AlertCircle, Clock, Trash2, Search, ShieldAlert, ShieldCheck, ChevronUp, ChevronDown, Edit3, Phone } from 'lucide-react';
import { DeliveryItem } from '../types';

interface MainDashboardProps {
  items: DeliveryItem[];
  onOpenInputModal: () => void;
  onOpenOptimizerModal: () => void;
  onOpenNavigationModal: () => void;
  onOpenSavedRoutesModal: () => void;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onEditItem: (item: DeliveryItem) => void;
  onSelectPackage: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onClearAllItems: () => void;
  showMap: boolean;
  onToggleShowMap: () => void;
}

export const MainDashboard: React.FC<MainDashboardProps> = ({
  items,
  onOpenInputModal,
  onOpenOptimizerModal,
  onOpenNavigationModal,
  onOpenSavedRoutesModal,
  onUpdateStatus,
  onEditItem,
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

  const inCoverageItems = items.filter(i => i.coverageStatus === 'in_coverage');
  const pendingCount = inCoverageItems.filter(i => i.status === 'pending' || i.status === 'in_transit').length;
  const deliveredCount = inCoverageItems.filter(i => i.status === 'delivered').length;
  const outOfCoverageCount = items.filter(i => i.coverageStatus === 'out_of_coverage').length;
  const progressPercent = inCoverageItems.length > 0 ? Math.round((deliveredCount / inCoverageItems.length) * 100) : 0;

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
    <div className="space-y-6 pb-16">
      {/* Waze-Inspired Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden border border-emerald-400/20">
        <div className="absolute right-0 top-0 transform translate-x-12 -translate-y-12 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/25 backdrop-blur-md text-white text-xs font-bold px-3.5 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
              RUTEO • Copiloto de Repartidores
            </span>
            <span className="bg-emerald-800/60 text-emerald-100 text-xs font-semibold px-3 py-1.5 rounded-full">
              Costa Rica (San José, Heredia, Cartago)
            </span>
          </div>

          <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight">
            Navega más rápido, entrega sin confusiones
          </h2>
          <p className="text-emerald-100 text-xs md:text-sm leading-relaxed max-w-2xl">
            Optimiza tus recorridos reales por carretera, oculta entregas completadas automáticamente y mantén el control total de tus paquetes personalizados.
          </p>

          {/* Main Action Buttons Grid (Waze Style) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <button
              onClick={onOpenInputModal}
              className="bg-white hover:bg-emerald-50 text-emerald-950 px-4 py-3.5 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-2 shadow-xl transition-all transform hover:-translate-y-1 group"
            >
              <div className="w-9 h-9 bg-emerald-100 group-hover:bg-emerald-600 group-hover:text-white text-emerald-700 rounded-xl flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <span>Agregar Paquete</span>
            </button>

            <button
              onClick={onOpenOptimizerModal}
              disabled={inCoverageItems.length === 0}
              className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-3.5 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-2 shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
            >
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
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
              disabled={inCoverageItems.length === 0}
              className="bg-teal-700 hover:bg-teal-600 text-white px-4 py-3.5 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-2 shadow-xl transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <Navigation className="w-5 h-5 transform rotate-45" />
              </div>
              <span>Iniciar Ruta</span>
            </button>

            <button
              onClick={onToggleShowMap}
              className="bg-emerald-950/60 hover:bg-emerald-950 text-emerald-100 border border-emerald-400/30 px-4 py-3.5 rounded-2xl text-xs font-bold flex flex-col items-center justify-center gap-2 transition-all"
            >
              <div className="w-9 h-9 bg-emerald-900 text-emerald-200 rounded-xl flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <span>{showMap ? 'Ocultar Mapa' : 'Ver Mapa'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Out of coverage alert if any */}
      {outOfCoverageCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-950">
              Aviso de Cobertura: {outOfCoverageCount} paquete(s) fuera de San José, Heredia y Cartago
            </h4>
            <p className="text-xs text-amber-900">
              Estos paquetes se muestran con alerta roja en la lista. Se conservan para tu control, pero están excluidos de la optimización y ruta de navegación automática.
            </p>
          </div>
        </div>
      )}

      {/* Progress & Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pendientes de Ruta</p>
            <p className="text-2xl font-black text-emerald-700">{pendingCount}</p>
            <p className="text-[10px] text-gray-400">En zonas autorizadas</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Entregados (Ocultos en Mapa)</p>
            <p className="text-2xl font-black text-teal-700">{deliveredCount}</p>
            <p className="text-[10px] text-gray-400">Progreso: {progressPercent}%</p>
          </div>
          <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Fuera de Cobertura</p>
            <p className="text-2xl font-black text-red-600">{outOfCoverageCount}</p>
            <p className="text-[10px] text-gray-400">Fuera de GAM</p>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Collapsible Bottom Panel for Deliveries */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden">
        <div
          onClick={() => setIsBottomSheetOpen(!isBottomSheetOpen)}
          className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/60 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center font-bold text-xs">
              {filteredItems.length}
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-900">Panel de Destinos y Paquetes</h3>
              <p className="text-[11px] text-gray-500">Haz clic en un paquete para marcarlo y centrarlo en el mapa</p>
            </div>
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
                {filteredItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onSelectPackage(item.id)}
                    className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:shadow-md ${
                      item.coverageStatus === 'out_of_coverage'
                        ? 'bg-red-50/60 border-red-200 hover:border-red-400'
                        : item.status === 'delivered'
                        ? 'bg-gray-50 border-gray-200 opacity-80 hover:border-gray-300'
                        : 'bg-white border-gray-200 hover:border-emerald-400 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-7 h-7 bg-gray-100 text-gray-700 rounded-lg font-bold text-xs flex items-center justify-center" title="Orden de visita">
                          #{item.orderIndex + 1}
                        </span>

                        <span
                          className={`w-10 h-10 rounded-2xl font-black text-xs flex items-center justify-center shadow-md text-white ${
                            item.coverageStatus === 'out_of_coverage' ? 'bg-red-600' : 'bg-emerald-600'
                          }`}
                          title={`Paquete #${item.originalNumber}`}
                        >
                          #{item.originalNumber}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className={`font-bold text-xs sm:text-sm ${item.status === 'delivered' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                            {item.address}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-500">
                          <span className={`font-bold ${item.coverageStatus === 'out_of_coverage' ? 'text-red-600' : 'text-emerald-700'}`}>
                            {item.province || 'Costa Rica'}
                          </span>
                          {item.phone && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-gray-700 font-medium">
                                <Phone className="w-3 h-3 text-emerald-600" />
                                {item.phone}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span className="font-mono">Lat: {item.lat.toFixed(4)}, Lng: {item.lng.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100" onClick={e => e.stopPropagation()}>
                      {item.coverageStatus === 'out_of_coverage' ? (
                        <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-red-200">
                          Fuera de cobertura
                        </span>
                      ) : item.status === 'delivered' ? (
                        <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-teal-200">
                          Entregado (Oculto en mapa)
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
                          En ruta
                        </span>
                      )}

                      {/* Edit Button */}
                      <button
                        onClick={() => onEditItem(item)}
                        className="bg-gray-100 hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors border border-gray-200"
                        title="Editar número y ubicación"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>

                      {item.coverageStatus === 'in_coverage' && (
                        <select
                          value={item.status}
                          onChange={e => onUpdateStatus(item.id, e.target.value as DeliveryItem['status'])}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-xl border outline-none transition-colors ${
                            item.status === 'delivered'
                              ? 'bg-teal-100 text-teal-800 border-teal-300'
                              : item.status === 'in_transit'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : item.status === 'failed'
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          <option value="pending">Pendiente</option>
                          <option value="in_transit">En camino</option>
                          <option value="delivered">Entregada</option>
                          <option value="failed">No entregada</option>
                        </select>
                      )}

                      <button
                        onClick={() => onDeleteItem(item.id)}
                        className="text-gray-400 hover:text-red-600 p-2 rounded-xl hover:bg-gray-100 transition-colors"
                        title="Eliminar paquete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

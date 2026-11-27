import React, { useState, useEffect } from 'react';
import { X, Sparkles, ArrowUpDown, ArrowUp, ArrowDown, Check, Route as RouteIcon, Loader2 } from 'lucide-react';
import { DeliveryItem, GpsPosition } from '../types';
import { optimizeRoute, optimizeCircuitByRoad } from '../utils/optimizer';

interface RouteOptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  onApplyOptimizedItems: (
    optimized: DeliveryItem[],
    totalDist: number,
    totalMins: number,
    mode?: 'auto' | 'manual'
  ) => void;
}

export const RouteOptimizationModal: React.FC<RouteOptimizationModalProps> = ({
  isOpen,
  onClose,
  items,
  currentGps,
  onApplyOptimizedItems
}) => {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [workingItems, setWorkingItems] = useState<DeliveryItem[]>([...items]);
  const [isComputingRoad, setIsComputingRoad] = useState(false);
  const [optimizationStats, setOptimizationStats] = useState<{ totalDist: number; totalMins: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();

    if (mode === 'auto') {
      const quickResult = optimizeRoute(items, currentGps);
      setWorkingItems(quickResult.optimizedItems);
      setOptimizationStats({
        totalDist: quickResult.totalDistanceKm,
        totalMins: quickResult.totalMinutes
      });
      setIsComputingRoad(true);
      optimizeCircuitByRoad(items, currentGps, controller.signal)
        .then((roadResult) => {
          if (controller.signal.aborted) return;
          setWorkingItems(roadResult.optimizedItems);
          setOptimizationStats({
            totalDist: roadResult.totalDistanceKm,
            totalMins: roadResult.totalMinutes
          });
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsComputingRoad(false);
        });
    } else {
      setIsComputingRoad(false);
      setWorkingItems([...items].sort((a, b) => a.orderIndex - b.orderIndex));
      setOptimizationStats(null);
    }

    return () => {
      controller.abort();
    };
  }, [isOpen, items]);

  if (!isOpen) return null;

  const handleRunAutoOptimize = async () => {
    const quickResult = optimizeRoute(workingItems, currentGps);
    setWorkingItems(quickResult.optimizedItems);
    setOptimizationStats({
      totalDist: quickResult.totalDistanceKm,
      totalMins: quickResult.totalMinutes
    });
    setIsComputingRoad(true);
    try {
      const roadResult = await optimizeCircuitByRoad(workingItems, currentGps);
      setWorkingItems(roadResult.optimizedItems);
      setOptimizationStats({
        totalDist: roadResult.totalDistanceKm,
        totalMins: roadResult.totalMinutes
      });
    } finally {
      setIsComputingRoad(false);
    }
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...workingItems];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Recalculate order indices
    const updated = newItems.map((item, idx) => ({ ...item, orderIndex: idx }));
    setWorkingItems(updated);
    if (mode === 'manual') setOptimizationStats(null);
  };

  const computedManualDist = Math.round(
    workingItems.reduce((acc, curr) => acc + (curr.distanceFromPrevKm || 0), 0) * 10
  ) / 10;
  const computedManualMins = workingItems.reduce(
    (acc, curr) => acc + (curr.estimatedMinutes || 0),
    0
  );

  const handleConfirm = () => {
    const stats = optimizationStats || {
      totalDist: computedManualDist,
      totalMins: computedManualMins
    };
    onApplyOptimizedItems(workingItems, stats.totalDist, stats.totalMins, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/50 dark:bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Circuito Eficiente de Entregas</h2>
              <p className="text-xs text-gray-600 dark:text-slate-300">Ordena paradas de ida y vuelta sin devolverte por la misma vía</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4 flex gap-2 border-b border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
          <button
            onClick={() => {
              setMode('auto');
              handleRunAutoOptimize();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-t border-x transition-all ${
              mode === 'auto'
                ? 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'bg-gray-100/60 dark:bg-slate-800/60 border-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-700/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Circuito Automático</span>
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-t border-x transition-all ${
              mode === 'manual'
                ? 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'bg-gray-100/60 dark:bg-slate-800/60 border-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-200/50 dark:hover:bg-slate-700/60'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            <span>Modo Manual (Reordenar)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Stats Bar */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
              {isComputingRoad ? (
                <Loader2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
              ) : (
                <RouteIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>Distancia total estimada: <strong className="font-bold">{optimizationStats ? optimizationStats.totalDist : computedManualDist} km</strong></span>
            </div>
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
              <span className="text-gray-500 dark:text-slate-500">|</span>
              <span>Tiempo estimado: <strong className="font-bold">{optimizationStats ? optimizationStats.totalMins : computedManualMins} min</strong></span>
            </div>
          </div>

          {mode === 'auto' && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {isComputingRoad
                ? 'Ajustando circuito según sentidos viales y calles reales...'
                : 'El circuito ordena las entregas de ida por una zona y de vuelta por la otra siguiendo las vías, evitando devolverse por la misma calle salvo que sea necesario.'}
            </p>
          )}

          {mode === 'manual' && (
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Usa las flechas para subir o bajar los destinos según tu preferencia personal. Los números originales de paquete (ej. #3, #8) se mantienen intactos.
            </p>
          )}

          {/* List of stops */}
          <div className="space-y-2">
            {workingItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl text-xs shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-6 h-6 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-md font-bold text-[11px] flex items-center justify-center">
                      #{index + 1}
                    </span>
                    <span className="w-7 h-7 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center justify-center shadow-xs">
                      #{item.originalNumber}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-slate-100 truncate max-w-sm">{item.address}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-slate-400">
                      <span>Estado: {item.status}</span>
                      {item.distanceFromPrevKm !== undefined && (
                        <span>• ~{item.distanceFromPrevKm} km desde parada previa</span>
                      )}
                    </div>
                  </div>
                </div>

                {mode === 'manual' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"
                      title="Subir"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveItem(index, 'down')}
                      disabled={index === workingItems.length - 1}
                      className="p-1.5 text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-colors"
                      title="Bajar"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2 shadow-emerald-600/20"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Recorrido</span>
          </button>
        </div>
      </div>
    </div>
  );
};

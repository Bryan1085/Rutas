import React, { useState } from 'react';
import { X, Plus, AlertCircle, ExternalLink, Hash, Phone, MapPin } from 'lucide-react';
import { DeliveryItem } from '../types';
import { parseGoogleMapsUrl, ParsedMapLocation } from '../utils/googleMapsParser';
import { validateGeographicalCoverage } from '../utils/coverageValidator';

interface LocationInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (newItems: DeliveryItem[]) => void;
  existingItems: DeliveryItem[];
}

export const LocationInputModal: React.FC<LocationInputModalProps> = ({
  isOpen,
  onClose,
  onAddItems,
  existingItems
}) => {
  const maxExistingNum = existingItems.reduce((max, item) => Math.max(max, item.originalNumber), 0);
  const [indivNum, setIndivNum] = useState<string>(String(maxExistingNum + 1));
  const [indivPhone, setIndivPhone] = useState<string>('');
  const [indivLocationInput, setIndivLocationInput] = useState<string>('');
  const [indivParsed, setIndivParsed] = useState<ParsedMapLocation | null>(null);
  const [indivError, setIndivError] = useState<string>('');

  if (!isOpen) return null;

  const handleTestIndividual = () => {
    setIndivError('');
    const res = parseGoogleMapsUrl(indivLocationInput, parseInt(indivNum, 10) || 1);
    if (res.location) {
      const parsedPkgNum = parseInt(indivNum, 10);
      if (!isNaN(parsedPkgNum)) {
        res.location.originalNumber = parsedPkgNum;
      }
      setIndivParsed(res.location);
    } else {
      setIndivParsed(null);
      setIndivError(res.error || 'No se pudo interpretar la ubicación o coordenadas.');
    }
  };

  const handleConfirmIndividualAdd = () => {
    if (!indivParsed) return;

    const coverage = validateGeographicalCoverage(indivParsed.lat, indivParsed.lng);
    const newItem: DeliveryItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      originalNumber: indivParsed.originalNumber,
      address: indivParsed.address,
      lat: indivParsed.lat,
      lng: indivParsed.lng,
      status: 'pending',
      coverageStatus: coverage.coverageStatus,
      province: coverage.province,
      phone: indivPhone.trim() || undefined,
      orderIndex: existingItems.length,
      notes: indivParsed.rawText
    };

    onAddItems([newItem]);
    resetAndClose();
  };

  const resetAndClose = () => {
    setIndivNum(String(maxExistingNum + 2));
    setIndivPhone('');
    setIndivLocationInput('');
    setIndivParsed(null);
    setIndivError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-sm shadow-emerald-600/20">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Agregar Nuevo Paquete</h2>
              <p className="text-xs text-emerald-800">Ingresa número, teléfono y ubicación GPS</p>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-emerald-100/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-600" />
                <span>Número de Paquete:</span>
              </label>
              <input
                type="number"
                value={indivNum}
                onChange={e => setIndivNum(e.target.value)}
                placeholder="Ej. 3"
                className="w-full bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 text-xs font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Teléfono (Opcional):</span>
              </label>
              <input
                type="tel"
                value={indivPhone}
                onChange={e => setIndivPhone(e.target.value)}
                placeholder="Ej. +506 8888 8888"
                className="w-full bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Ubicación / Enlace de Google Maps o Coordenadas:</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={indivLocationInput}
                onChange={e => {
                  setIndivLocationInput(e.target.value);
                  setIndivParsed(null);
                }}
                placeholder="Pega enlace maps.app.goo.gl, @lat,lng o coordenadas..."
                className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
              <button
                type="button"
                onClick={handleTestIndividual}
                className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-3 rounded-2xl text-xs font-bold transition-all shrink-0 shadow-sm"
              >
                Verificar
              </button>
            </div>
          </div>

          {indivError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3.5 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{indivError}</span>
            </div>
          )}

          {indivParsed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="bg-emerald-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-xs">
                  Paquete #{indivParsed.originalNumber}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${indivParsed.lat},${indivParsed.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 font-bold underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Verificar en Google Maps
                </a>
              </div>
              <p className="text-xs font-bold text-gray-900">{indivParsed.address}</p>
              <p className="text-[11px] text-gray-500 font-mono">
                Lat: {indivParsed.lat.toFixed(5)}, Lng: {indivParsed.lng.toFixed(5)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={resetAndClose}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-200/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmIndividualAdd}
            disabled={!indivParsed}
            className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
              indivParsed
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Guardar Paquete</span>
          </button>
        </div>
      </div>
    </div>
  );
};

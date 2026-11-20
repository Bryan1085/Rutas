import React, { useState } from 'react';
import { X, Save, MapPin, Hash, ShieldCheck, Phone } from 'lucide-react';
import { DeliveryItem } from '../types';
import { validateGeographicalCoverage } from '../utils/coverageValidator';

interface EditPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DeliveryItem | null;
  onSaveEdit: (updatedItem: DeliveryItem) => void;
}

export const EditPackageModal: React.FC<EditPackageModalProps> = ({
  isOpen,
  onClose,
  item,
  onSaveEdit
}) => {
  if (!isOpen || !item) return null;

  const [originalNumber, setOriginalNumber] = useState<string>(String(item.originalNumber));
  const [address, setAddress] = useState<string>(item.address);
  const [phone, setPhone] = useState<string>(item.phone || '');
  const [lat, setLat] = useState<string>(String(item.lat));
  const [lng, setLng] = useState<string>(String(item.lng));

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedNum = parseInt(originalNumber, 10);
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedNum)) {
      alert('Por favor introduce un número de paquete válido.');
      return;
    }
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      alert('Por favor introduce coordenadas (latitud y longitud) válidas.');
      return;
    }

    const coverage = validateGeographicalCoverage(parsedLat, parsedLng);

    const updated: DeliveryItem = {
      ...item,
      originalNumber: parsedNum,
      address: address.trim() || item.address,
      phone: phone.trim() || undefined,
      lat: parsedLat,
      lng: parsedLng,
      coverageStatus: coverage.coverageStatus,
      province: coverage.province
    };

    onSaveEdit(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Editar Paquete #{item.originalNumber}</h2>
              <p className="text-xs text-emerald-800">Modifica número, dirección, teléfono y coordenadas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-emerald-100/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Hash className="w-4 h-4 text-emerald-600" />
              <span>Número de Paquete:</span>
            </label>
            <input
              type="number"
              value={originalNumber}
              onChange={e => setOriginalNumber(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Dirección / Descripción:</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Teléfono de contacto (Opcional):</span>
            </label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Ej. 8888-1234"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Latitud:</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={e => setLat(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Longitud:</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={e => setLng(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                required
              />
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Al actualizar las coordenadas, la cobertura se revalidará automáticamente.</span>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

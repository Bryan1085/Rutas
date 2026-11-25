import React, { useState, useEffect } from 'react';
import { X, Save, MapPin, Hash, ShieldCheck, Phone, Link2, AlertCircle, Loader2 } from 'lucide-react';
import { DeliveryItem } from '../types';
import { validateGeographicalCoverage } from '../utils/coverageValidator';
import { resolveSharedLocationAsync } from '../utils/googleMapsParser';

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
  const [originalNumber, setOriginalNumber] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [mapLinkInput, setMapLinkInput] = useState<string>('');
  const [linkError, setLinkError] = useState<string>('');
  const [isResolvingLink, setIsResolvingLink] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && item) {
      const hasLoc = item.hasLocation !== false && item.coverageStatus !== 'incomplete';
      setOriginalNumber(String(item.originalNumber));
      setAddress(hasLoc ? item.address : '');
      setPhone(item.phone || '');
      setLat(hasLoc ? String(item.lat) : '');
      setLng(hasLoc ? String(item.lng) : '');
      setMapLinkInput('');
      setLinkError('');
      setIsResolvingLink(false);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleApplyMapLink = async (): Promise<{ lat: string; lng: string; address: string } | null> => {
    setLinkError('');
    if (!mapLinkInput.trim()) return null;
    const parsedNum = parseInt(originalNumber, 10) || item.originalNumber;
    setIsResolvingLink(true);
    try {
      const res = await resolveSharedLocationAsync(mapLinkInput, parsedNum);
      if (res.location) {
        const nextLat = String(res.location.lat);
        const nextLng = String(res.location.lng);
        const nextAddress =
          !address.trim() || address === 'Sin ubicación registrada' ? res.location.address : address;
        setLat(nextLat);
        setLng(nextLng);
        setAddress(nextAddress);
        setMapLinkInput('');
        return { lat: nextLat, lng: nextLng, address: nextAddress };
      } else {
        setLinkError(res.error || 'No se pudo extraer la ubicación del enlace.');
        return null;
      }
    } finally {
      setIsResolvingLink(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedNum = parseInt(originalNumber, 10);
    if (isNaN(parsedNum)) {
      alert('Por favor introduce un número de paquete válido.');
      return;
    }

    let latTrim = lat.trim();
    let lngTrim = lng.trim();
    let finalAddress = address.trim();

    if (mapLinkInput.trim() && (!latTrim || !lngTrim)) {
      const resolved = await handleApplyMapLink();
      if (!resolved) return;
      latTrim = resolved.lat;
      lngTrim = resolved.lng;
      finalAddress = resolved.address.trim();
    }

    if (!latTrim && !lngTrim) {
      // Save without location -> incomplete
      const updated: DeliveryItem = {
        ...item,
        originalNumber: parsedNum,
        address: finalAddress || 'Sin ubicación registrada',
        phone: phone.trim() || undefined,
        lat: 0,
        lng: 0,
        hasLocation: false,
        coverageStatus: 'incomplete',
        province: 'Sin ubicación'
      };
      onSaveEdit(updated);
      onClose();
      return;
    }

    const parsedLat = parseFloat(latTrim);
    const parsedLng = parseFloat(lngTrim);

    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      alert('Por favor introduce coordenadas (latitud y longitud) válidas, o deja ambos campos vacíos si aún no tienes ubicación.');
      return;
    }

    const coverage = validateGeographicalCoverage(parsedLat, parsedLng);

    const updated: DeliveryItem = {
      ...item,
      originalNumber: parsedNum,
      address: finalAddress || `Ubicación (${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)})`,
      phone: phone.trim() || undefined,
      lat: parsedLat,
      lng: parsedLng,
      hasLocation: true,
      coverageStatus: coverage.coverageStatus,
      province: coverage.province
    };

    onSaveEdit(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-sm">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Editar Paquete #{item.originalNumber}</h2>
              <p className="text-xs text-emerald-800">Modifica datos o pega enlace compartido de Google Maps</p>
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
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-600" />
                <span># Paquete:</span>
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
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Teléfono:</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ej. 8888-1234"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-emerald-600" />
              <span>Pegar enlace de Google Maps o WhatsApp (opcional):</span>
            </label>
            <div className="flex gap-2 items-start">
              <textarea
                rows={2}
                value={mapLinkInput}
                onChange={e => {
                  setMapLinkInput(e.target.value);
                  setLinkError('');
                }}
                placeholder="https://maps.app.goo.gl/... o coordenadas"
                className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono focus:border-emerald-500 outline-none resize-none"
              />
              <button
                type="button"
                onClick={() => void handleApplyMapLink()}
                disabled={isResolvingLink || !mapLinkInput.trim()}
                className="bg-gray-900 hover:bg-gray-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1 disabled:opacity-50"
              >
                {isResolvingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{isResolvingLink ? '...' : 'Aplicar'}</span>
              </button>
            </div>
            {linkError && (
              <p className="text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{linkError}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>Dirección / Referencia:</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Ej. Avenida Central o deja vacío si no tienes"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Latitud (Opcional):</label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={e => setLat(e.target.value)}
                placeholder="Ej. 9.9281"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Longitud (Opcional):</label>
              <input
                type="number"
                step="any"
                value={lng}
                onChange={e => setLng(e.target.value)}
                placeholder="Ej. -84.0907"
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Si dejas las coordenadas vacías, el paquete quedará marcado como Datos incompletos.</span>
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

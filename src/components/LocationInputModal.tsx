import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertCircle, ExternalLink, Hash, Phone, MapPin, AlertTriangle, Loader2, User, FileText, Sparkles } from 'lucide-react';
import { DeliveryItem } from '../types';
import { resolveSharedLocationAsync, ParsedMapLocation } from '../utils/googleMapsParser';
import { validateGeographicalCoverage } from '../utils/coverageValidator';
import { BUTTON_COLOR_STYLES, ButtonColorKey, DEFAULT_APP_SETTINGS, PackageFieldsSettings } from '../utils/appSettings';
import { buildTibasTestPackages } from '../utils/testAddressesTibas';

interface LocationInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (newItems: DeliveryItem[]) => void;
  existingItems: DeliveryItem[];
  packageFields?: PackageFieldsSettings;
  accentColor?: ButtonColorKey;
}

export const LocationInputModal: React.FC<LocationInputModalProps> = ({
  isOpen,
  onClose,
  onAddItems,
  existingItems,
  packageFields = DEFAULT_APP_SETTINGS.packageFields,
  accentColor = 'emerald'
}) => {
  const maxExistingNum = existingItems.reduce((max, item) => Math.max(max, item.originalNumber), 0);
  const [indivNum, setIndivNum] = useState<string>(String(maxExistingNum + 1));
  const [indivName, setIndivName] = useState<string>('');
  const [indivPhone, setIndivPhone] = useState<string>('');
  const [indivLocationInput, setIndivLocationInput] = useState<string>('');
  const [indivNotes, setIndivNotes] = useState<string>('');
  const [indivParsed, setIndivParsed] = useState<ParsedMapLocation | null>(null);
  const [indivError, setIndivError] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);

  const numRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const locationRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const nextNum = existingItems.reduce((max, item) => Math.max(max, item.originalNumber), 0) + 1;
    setIndivNum(String(nextNum));
    setIndivName('');
    setIndivPhone('');
    setIndivLocationInput('');
    setIndivNotes('');
    setIndivParsed(null);
    setIndivError('');
    setIsResolving(false);

    const timer = setTimeout(() => {
      const target = packageFields.autoFocusField;
      if (target === 'number') numRef.current?.focus();
      else if (target === 'phone' && packageFields.showPhone) phoneRef.current?.focus();
      else if (target === 'name' && packageFields.showName) nameRef.current?.focus();
      else if (target === 'location' && packageFields.showLocation) locationRef.current?.focus();
      else numRef.current?.focus();
    }, 60);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedNum = parseInt(indivNum, 10);
  const isValidNum = !isNaN(parsedNum) && parsedNum > 0;
  const accentStyle = BUTTON_COLOR_STYLES[accentColor];

  const handleTestIndividual = async () => {
    setIndivError('');
    if (!indivLocationInput.trim()) {
      setIndivParsed(null);
      return;
    }
    setIsResolving(true);
    try {
      const res = await resolveSharedLocationAsync(indivLocationInput, isValidNum ? parsedNum : 1);
      if (res.location) {
        if (isValidNum) {
          res.location.originalNumber = parsedNum;
        }
        setIndivParsed(res.location);
      } else {
        setIndivParsed(null);
        setIndivError(res.error || 'No se pudo interpretar la ubicación o coordenadas.');
      }
    } finally {
      setIsResolving(false);
    }
  };

  const handleConfirmIndividualAdd = async () => {
    setIndivError('');
    if (!isValidNum) {
      setIndivError('Ingresa un número de paquete válido.');
      return;
    }

    if (packageFields.showName && packageFields.requireName && !indivName.trim()) {
      setIndivError('El nombre del cliente o referencia es obligatorio.');
      return;
    }

    if (packageFields.showPhone && packageFields.requirePhone && !indivPhone.trim()) {
      setIndivError('El teléfono del cliente es obligatorio.');
      return;
    }

    let resolvedLocation = indivParsed;

    // If user typed/pasted a location but didn't click Verificar, resolve automatically
    if (packageFields.showLocation && !resolvedLocation && indivLocationInput.trim()) {
      setIsResolving(true);
      try {
        const res = await resolveSharedLocationAsync(indivLocationInput, parsedNum);
        if (res.location) {
          resolvedLocation = res.location;
        } else {
          setIndivError(res.error || 'El enlace o coordenadas no son válidos. Borra el campo para guardarlo sin ubicación.');
          return;
        }
      } finally {
        setIsResolving(false);
      }
    }

    const customNotes = packageFields.showNotes ? indivNotes.trim() : '';

    if (resolvedLocation) {
      const coverage = validateGeographicalCoverage(resolvedLocation.lat, resolvedLocation.lng);
      const newItem: DeliveryItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        originalNumber: parsedNum,
        address: resolvedLocation.address,
        lat: resolvedLocation.lat,
        lng: resolvedLocation.lng,
        hasLocation: true,
        status: 'in_transit',
        coverageStatus: coverage.coverageStatus,
        province: coverage.province,
        recipientName: packageFields.showName ? (indivName.trim() || undefined) : undefined,
        phone: packageFields.showPhone ? (indivPhone.trim() || undefined) : undefined,
        orderIndex: existingItems.length,
        notes: customNotes || resolvedLocation.rawText
      };
      onAddItems([newItem]);
    } else {
      // Save without location as incomplete
      const newItem: DeliveryItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        originalNumber: parsedNum,
        address: 'Sin ubicación registrada',
        lat: 0,
        lng: 0,
        hasLocation: false,
        status: 'pending',
        coverageStatus: 'incomplete',
        province: 'Sin ubicación',
        recipientName: packageFields.showName ? (indivName.trim() || undefined) : undefined,
        phone: packageFields.showPhone ? (indivPhone.trim() || undefined) : undefined,
        orderIndex: existingItems.length,
        notes: customNotes || undefined
      };
      onAddItems([newItem]);
    }

    onClose();
  };

  const handleLoadTibasTestSet = () => {
    const testPackages = buildTibasTestPackages(existingItems);
    onAddItems(testPackages);
    onClose();
  };

  const hasTypedLocation = packageFields.showLocation && indivLocationInput.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[92vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accentStyle.iconBg}`}>
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">Agregar Nuevo Paquete</h2>
              <p className="text-xs text-gray-600 dark:text-slate-400">Acepta ubicación de WhatsApp, Google Maps o Waze</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className={`grid grid-cols-1 ${packageFields.showPhone ? 'sm:grid-cols-2' : ''} gap-4`}>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <Hash className={`w-4 h-4 ${accentStyle.badgeText}`} />
                <span>Número de Paquete:</span>
              </label>
              <input
                ref={numRef}
                type="number"
                value={indivNum}
                onChange={e => setIndivNum(e.target.value)}
                placeholder="Ej. 3"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-3 text-xs font-bold focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>

            {packageFields.showPhone && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Phone className={`w-4 h-4 ${accentStyle.badgeText}`} />
                  <span>Teléfono ({packageFields.requirePhone ? 'Obligatorio' : 'Opcional'}):</span>
                </label>
                <input
                  ref={phoneRef}
                  type="tel"
                  value={indivPhone}
                  onChange={e => setIndivPhone(e.target.value)}
                  placeholder="Ej. 8888-8888"
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            )}
          </div>

          {packageFields.showName && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className={`w-4 h-4 ${accentStyle.badgeText}`} />
                <span>Nombre del cliente o referencia ({packageFields.requireName ? 'Obligatorio' : 'Opcional'}):</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                maxLength={120}
                value={indivName}
                onChange={e => setIndivName(e.target.value)}
                placeholder="Ej. María Pérez / Casa #4"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          )}

          {packageFields.showLocation && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className={`w-4 h-4 ${accentStyle.badgeText}`} />
                <span>Ubicación de WhatsApp, Google Maps o Waze (Opcional):</span>
              </label>
              <div className="flex gap-2 items-start">
                <textarea
                  ref={locationRef}
                  rows={2}
                  value={indivLocationInput}
                  onChange={e => {
                    setIndivLocationInput(e.target.value);
                    setIndivParsed(null);
                    setIndivError('');
                  }}
                  placeholder="Pega enlace de Google Maps (maps.app.goo.gl/...), Waze (waze.com/ul/...), texto de WhatsApp o coordenadas..."
                  className="flex-1 bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-2.5 text-xs font-mono focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                />
                {hasTypedLocation && (
                  <button
                    type="button"
                    onClick={handleTestIndividual}
                    disabled={isResolving}
                    className="bg-gray-900 dark:bg-slate-700 hover:bg-gray-800 dark:hover:bg-slate-600 text-white px-4 py-3 rounded-2xl text-xs font-bold transition-all shrink-0 shadow-sm flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>{isResolving ? 'Leyendo...' : 'Verificar'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {packageFields.showNotes && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className={`w-4 h-4 ${accentStyle.badgeText}`} />
                <span>Notas de entrega (Opcional):</span>
              </label>
              <input
                type="text"
                maxLength={250}
                value={indivNotes}
                onChange={e => setIndivNotes(e.target.value)}
                placeholder="Ej. Casa portón negro / Cobrar contraentrega"
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-2xl px-4 py-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
              />
            </div>
          )}

          {!hasTypedLocation && !indivError && (
            <div className="bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-200 p-3.5 rounded-2xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <span>
                Si guardas sin ubicación, el paquete quedará marcado en color naranja como <strong>Datos incompletos</strong> hasta que agregues su ubicación.
              </span>
            </div>
          )}

          {indivError && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3.5 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>{indivError}</span>
            </div>
          )}

          {indivParsed && (
            <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="bg-emerald-600 text-white font-black text-xs px-2.5 py-1 rounded-xl shadow-xs">
                  Paquete #{isValidNum ? parsedNum : indivParsed.originalNumber}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${indivParsed.lat},${indivParsed.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-700 dark:text-emerald-400 font-bold underline flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Verificar en Google Maps
                </a>
              </div>
              <p className="text-xs font-bold text-gray-900 dark:text-slate-100">{indivParsed.address}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/80 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleLoadTibasTestSet}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800 transition-colors inline-flex items-center gap-1.5"
            title="Cargar 20 paquetes de prueba distribuidos en Tibás"
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Cargar 20 prueba (Tibás)</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmIndividualAdd}
              disabled={!isValidNum || isResolving}
              className={`px-6 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                isValidNum && !isResolving
                  ? indivParsed || hasTypedLocation
                    ? accentStyle.solid
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20'
                  : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>
                {isResolving
                  ? 'Leyendo ubicación...'
                  : indivParsed || hasTypedLocation
                  ? 'Guardar Paquete'
                  : 'Guardar (Incompleto)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

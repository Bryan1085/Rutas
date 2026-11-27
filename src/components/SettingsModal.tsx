import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Volume2,
  Eye,
  Palette,
  PackagePlus,
  Sliders,
  Key,
  RefreshCw,
  Check,
  Shield,
  RotateCcw,
  Play,
  MessageCircle,
  MapPin,
  AlertTriangle,
  Sun,
  Moon,
  Users,
  Navigation,
  Map as MapIcon
} from 'lucide-react';
import {
  AppSettings,
  BUTTON_COLOR_STYLES,
  ButtonColorKey,
  ButtonColorsSettings,
  COLOR_PALETTE_PRESETS,
  DEFAULT_APP_SETTINGS
} from '../utils/appSettings';
import {
  DEFAULT_LOCATION_REQUEST_TEMPLATES,
  getLocationRequestTemplates,
  saveLocationRequestTemplates
} from '../utils/whatsappParser';
import { WhatsAppTemplatesEditor } from './WhatsAppTemplatesEditor';
import { buildPackageAnnouncement, isSpeechSupported, speakText } from '../utils/speechUtils';
import { DeliveryItem } from '../types';

type SettingsTab = 'speaker' | 'buttons' | 'colors' | 'fields' | 'gps' | 'general';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => void;
  speakerEnabled: boolean;
  onSetSpeakerEnabled: (enabled: boolean) => void;
  mapProvider: 'google' | 'free';
  onSetMapProvider: (provider: 'google' | 'free') => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  onResetData: () => void;
  onOpenDriversModal?: () => void;
}

const COLOR_KEYS: ButtonColorKey[] = [
  'emerald',
  'teal',
  'green',
  'sky',
  'blue',
  'indigo',
  'purple',
  'amber',
  'orange',
  'red',
  'slate',
];

const SAMPLE_PACKAGE: DeliveryItem = {
  id: 'sample-preview',
  originalNumber: 14,
  address: 'Calle 5, Avenida Central, San José',
  lat: 9.9326,
  lng: -84.0796,
  hasLocation: true,
  status: 'pending',
  coverageStatus: 'in_coverage',
  province: 'San José',
  recipientName: 'Carlos Mora',
  phone: '8888-1234',
  notes: 'Portón negro frente al parque',
  orderIndex: 0,
  distanceFromPrevKm: 2.4,
  estimatedMinutes: 7,
};

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => (
  <label
    className={`flex items-center justify-between gap-4 py-3 min-h-[44px] cursor-pointer select-none ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`}
  >
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-slate-100">{label}</p>
      {description && <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
        checked ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </label>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  speakerEnabled,
  onSetSpeakerEnabled,
  mapProvider,
  onSetMapProvider,
  apiKey,
  onSaveApiKey,
  onResetData,
  onOpenDriversModal,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('speaker');
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [draftSpeakerOn, setDraftSpeakerOn] = useState<boolean>(speakerEnabled);
  const [draftMapProvider, setDraftMapProvider] = useState<'google' | 'free'>(mapProvider);
  const [keyInput, setKeyInput] = useState<string>(apiKey);
  const [waTemplates, setWaTemplates] = useState<string[]>([...DEFAULT_LOCATION_REQUEST_TEMPLATES]);
  const [saved, setSaved] = useState<boolean>(false);
  const [confirmResetApp, setConfirmResetApp] = useState<boolean>(false);
  const [confirmClearData, setConfirmClearData] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setDraft(settings);
      setDraftSpeakerOn(speakerEnabled);
      setDraftMapProvider(mapProvider);
      setKeyInput(apiKey);
      setWaTemplates(getLocationRequestTemplates());
      setSaved(false);
      setConfirmResetApp(false);
      setConfirmClearData(false);
    }
  }, [isOpen, settings, speakerEnabled, mapProvider, apiKey]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalSettings: AppSettings = {
      ...draft,
      general: {
        ...draft.general,
        defaultMapProvider: draftMapProvider,
      },
    };
    onSaveSettings(finalSettings);
    onSetSpeakerEnabled(draftSpeakerOn);
    onSetMapProvider(draftMapProvider);
    onSaveApiKey(keyInput.trim());
    saveLocationRequestTemplates(waTemplates);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 550);
  };

  const handleTestSpeaker = () => {
    if (!isSpeechSupported()) return;
    const text = buildPackageAnnouncement(SAMPLE_PACKAGE, undefined, draft.speaker);
    speakText(text, { rate: draft.speaker.rate, pitch: draft.speaker.pitch });
  };

  const updateButtonColor = (target: keyof ButtonColorsSettings, color: ButtonColorKey) => {
    setDraft(prev => ({
      ...prev,
      buttonColors: {
        ...prev.buttonColors,
        [target]: color,
      },
    }));
  };

  const handleTestGpsSpeaker = () => {
    if (!isSpeechSupported()) return;
    speakText('En 90 metros, gira a la derecha hacia Avenida Central.', {
      rate: draft.speaker.rate,
      pitch: draft.speaker.pitch,
    });
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'speaker', label: 'Altavoz', icon: <Volume2 className="w-4 h-4 shrink-0" /> },
    { id: 'buttons', label: 'Botones', icon: <Eye className="w-4 h-4 shrink-0" /> },
    { id: 'gps', label: 'Navegador GPS', icon: <Navigation className="w-4 h-4 shrink-0" /> },
    { id: 'colors', label: 'Colores', icon: <Palette className="w-4 h-4 shrink-0" /> },
    { id: 'fields', label: 'Crear Paquete', icon: <PackagePlus className="w-4 h-4 shrink-0" /> },
    { id: 'general', label: 'Mapa y Más', icon: <Sliders className="w-4 h-4 shrink-0" /> },
  ];

  const colorTargets: { key: keyof ButtonColorsSettings; label: string; hint: string }[] = [
    { key: 'accent', label: 'Color Principal y Botón Agregar (+)', hint: 'Cabecera, botones de guardar y botón flotante' },
    { key: 'optimize', label: 'Botón Optimizar Ruta', hint: 'Acción principal para ordenar paradas' },
    { key: 'startRoute', label: 'Botón Iniciar Ruta', hint: 'Abre el modo de navegación paso a paso' },
    { key: 'shareWaze', label: 'Botón Compartir a Waze', hint: 'Comparte paradas agrupadas hacia Waze' },
    { key: 'toggleMap', label: 'Botón Ver / Ocultar Mapa', hint: 'Alterna la visibilidad del mapa superior' },
    { key: 'whatsappBtn', label: 'Botones de WhatsApp', hint: 'Pedir ubicaciones, enviar fotos y abrir chat' },
    { key: 'speakerBtn', label: 'Botón Altavoz', hint: 'Botón de voz en barra superior y mapa' },
    { key: 'photoBtn', label: 'Botón Foto de Entrega', hint: 'Botón de cámara en la lista y navegación' },
  ];

  const sampleAnnouncement = buildPackageAnnouncement(SAMPLE_PACKAGE, undefined, draft.speaker);

  return (
    <div className="fixed inset-0 z-[1200] bg-black/55 dark:bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-3xl w-full h-[92vh] sm:h-[85vh] max-h-[820px] shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                BUTTON_COLOR_STYLES[draft.buttonColors.accent].iconBg
              }`}
            >
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 truncate">Configuración RUTEO</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                Personaliza altavoz, botones, colores, formulario y mapa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar configuración"
            className="text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-gray-200/70 dark:hover:bg-slate-700/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mapa predeterminado al inicio de la configuración */}
        <div className="px-5 sm:px-6 py-3 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                <MapIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Mapa predeterminado al iniciar</span>
              </p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400">
                Elige si la app abre en el mapa 2D con lista o directo en el navegador GPS.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 sm:w-72">
              <button
                type="button"
                onClick={() =>
                  setDraft(prev => ({
                    ...prev,
                    general: { ...prev.general, defaultMapMode: '2d' },
                  }))
                }
                className={`py-2 px-3 min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  draft.general.defaultMapMode === '2d'
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5 shrink-0" />
                <span>Mapa 2D</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft(prev => ({
                    ...prev,
                    general: { ...prev.general, defaultMapMode: 'gps' },
                  }))
                }
                className={`py-2 px-3 min-h-[38px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  draft.general.defaultMapMode === 'gps'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span>Navegador GPS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Body Layout: Mobile horizontal tabs / Desktop left sidebar */}
        <form onSubmit={handleSave} className="flex-1 min-h-0 flex flex-col md:flex-row">
          {/* Navigation */}
          <nav
            aria-label="Secciones de configuración"
            data-allow-pan-x="true"
            className="flex md:flex-col gap-1.5 px-4 py-3 md:p-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/80 overflow-x-auto md:overflow-y-auto md:w-56 shrink-0"
          >
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-gray-900 dark:bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Scrollable Tab Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* TAB 1: ALTAVOZ */}
            {activeTab === 'speaker' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Lectura por voz (Altavoz)</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Elige qué datos pronuncia el altavoz y cuándo se activa automáticamente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestSpeaker}
                    disabled={!isSpeechSupported()}
                    className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 ${
                      BUTTON_COLOR_STYLES[draft.buttonColors.speakerBtn].solid
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Probar Altavoz</span>
                  </button>
                </div>

                {!isSpeechSupported() && (
                  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 p-3.5 rounded-2xl text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span>Este navegador no admite síntesis de voz (Web Speech API).</span>
                  </div>
                )}

                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  <ToggleRow
                    label="Altavoz activado"
                    description="Enciende o apaga la lectura automática en toda la aplicación"
                    checked={draftSpeakerOn}
                    onChange={setDraftSpeakerOn}
                  />
                  <ToggleRow
                    label="Leer al avanzar en Navegación Activa"
                    description="Anuncia automáticamente el siguiente paquete al marcar una entrega"
                    checked={draft.speaker.autoReadOnNavigation}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, autoReadOnNavigation: val } }))
                    }
                  />
                  <ToggleRow
                    label="Leer al tocar un paquete de la lista"
                    description="Requiere que el altavoz esté encendido"
                    checked={draft.speaker.autoReadOnListTap}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, autoReadOnListTap: val } }))
                    }
                  />
                  <ToggleRow
                    label="Leer al tocar un marcador en el mapa"
                    description="Funciona tanto en Google Maps como en Mapa Gratis"
                    checked={draft.speaker.autoReadOnMapPin}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, autoReadOnMapPin: val } }))
                    }
                  />
                  <ToggleRow
                    label="Celebración por altavoz al cumplir metas"
                    description="Suena fanfarria y mensaje motivacional cada 25% de la barra de recorrido"
                    checked={draft.speaker.celebrateMilestonesSound}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, celebrateMilestonesSound: val } }))
                    }
                  />
                </div>

                {/* Sección dedicada al altavoz dentro del Navegador GPS */}
                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Altavoz en Navegador GPS</span>
                    </h4>
                    <button
                      type="button"
                      onClick={handleTestGpsSpeaker}
                      disabled={!isSpeechSupported()}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      <span>Probar voz GPS</span>
                    </button>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Indicaciones por voz en Navegador GPS"
                      description="Pronuncia giros, distancias y llegada durante la ruta en vivo"
                      checked={draft.speaker.gpsTurnByTurnVoice}
                      onChange={val =>
                        setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, gpsTurnByTurnVoice: val } }))
                      }
                    />
                    <ToggleRow
                      label="Anunciar inicio de ruta y paquete"
                      description="Dice el número de paquete y primera instrucción al iniciar"
                      checked={draft.speaker.gpsAnnounceStreetStart}
                      disabled={!draft.speaker.gpsTurnByTurnVoice}
                      onChange={val =>
                        setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, gpsAnnounceStreetStart: val } }))
                      }
                    />
                    <ToggleRow
                      label="Avisos anticipados antes de cada giro"
                      description="Anuncia con anticipación y a ~115 m antes de doblar"
                      checked={draft.speaker.gpsAnnounceApproach}
                      disabled={!draft.speaker.gpsTurnByTurnVoice}
                      onChange={val =>
                        setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, gpsAnnounceApproach: val } }))
                      }
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Datos que reproducirá el altavoz</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Número de paquete"
                      description="Ej. Paquete número 14"
                      checked={draft.speaker.fields.packageNumber}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, packageNumber: val } },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Nombre del cliente o referencia"
                      description="Ej. para Carlos Mora"
                      checked={draft.speaker.fields.recipientName}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, recipientName: val } },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Dirección o referencia del destino"
                      checked={draft.speaker.fields.address}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, address: val } },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Provincia / Cantón"
                      checked={draft.speaker.fields.province}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, province: val } },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Distancia aproximada desde la parada anterior"
                      checked={draft.speaker.fields.distance}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, distance: val } },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Teléfono del cliente"
                      checked={draft.speaker.fields.phone}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, phone: val } },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Notas adicionales del paquete"
                      description="Lee notas de texto personalizadas (omite enlaces web)"
                      checked={draft.speaker.fields.notes}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          speaker: { ...prev.speaker, fields: { ...prev.speaker.fields, notes: val } },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block">Velocidad de lectura:</label>
                    <div className="grid grid-cols-4 gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                      {[
                        { label: 'Lenta', value: 0.8 },
                        { label: 'Normal', value: 1 },
                        { label: 'Rápida', value: 1.2 },
                        { label: 'Muy ráp.', value: 1.4 },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, rate: opt.value } }))
                          }
                          className={`py-2 px-1 rounded-lg text-[11px] font-bold transition-colors ${
                            draft.speaker.rate === opt.value
                              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block">Tono de voz:</label>
                    <div className="grid grid-cols-3 gap-1.5 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
                      {[
                        { label: 'Grave', value: 0.85 },
                        { label: 'Normal', value: 1 },
                        { label: 'Agudo', value: 1.15 },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setDraft(prev => ({ ...prev, speaker: { ...prev.speaker, pitch: opt.value } }))
                          }
                          className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-colors ${
                            draft.speaker.pitch === opt.value
                              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block">
                    Frase inicial opcional antes de cada paquete:
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={draft.speaker.customPrefix}
                    onChange={e =>
                      setDraft(prev => ({
                        ...prev,
                        speaker: { ...prev.speaker, customPrefix: e.target.value },
                      }))
                    }
                    placeholder="Ej. Atención conductor / Siguiente entrega (opcional)"
                    className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>

                <div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400">Vista previa de lo que dirá el altavoz:</span>
                  <p className="text-xs text-gray-900 dark:text-slate-100 font-medium leading-relaxed">{sampleAnnouncement}</p>
                </div>
              </div>
            )}

            {/* TAB 2: BOTONES VISIBLES */}
            {activeTab === 'buttons' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Botones visibles en pantalla</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Oculta botones que no uses para mantener tu pantalla limpia y cómoda.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...DEFAULT_APP_SETTINGS.visibleButtons },
                        }))
                      }
                      className="px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 whitespace-nowrap transition-colors"
                    >
                      Mostrar todos
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: {
                            headerInstall: false,
                            headerSpeaker: true,
                            headerGps: false,
                            headerSavedRoutes: false,
                            optimize: false,
                            startRoute: false,
                            shareWaze: false,
                            requestLocations: true,
                            sendPhotos: true,
                            toggleMap: true,
                            editWhatsApp: false,
                            fabAdd: true,
                            rowPhoto: true,
                            rowWhatsApp: true,
                            rowEdit: true,
                            rowStatus: true,
                            rowDelete: true,
                          },
                        }))
                      }
                      className="px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-gray-900 dark:bg-emerald-600 hover:bg-gray-800 dark:hover:bg-emerald-700 text-white whitespace-nowrap transition-colors"
                    >
                      Modo esencial
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Barra superior</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Botón Instalar App"
                      description="Acceso en la barra superior para instalar RUTEO"
                      checked={draft.visibleButtons.headerInstall}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, headerInstall: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Altavoz / Silencio"
                      checked={draft.visibleButtons.headerSpeaker}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, headerSpeaker: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón GPS"
                      checked={draft.visibleButtons.headerGps}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, headerGps: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Guardar / Recorridos Guardados"
                      checked={draft.visibleButtons.headerSavedRoutes}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, headerSavedRoutes: val },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Barra de acciones principales</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Botón Optimizar Ruta"
                      checked={draft.visibleButtons.optimize}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, optimize: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Iniciar Ruta"
                      checked={draft.visibleButtons.startRoute}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, startRoute: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Compartir a Waze"
                      checked={draft.visibleButtons.shareWaze}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, shareWaze: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Pedir Ubicaciones a Todos"
                      description="Envía el mensaje preestablecido por WhatsApp a los paquetes creados"
                      checked={draft.visibleButtons.requestLocations}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, requestLocations: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Enviar Fotos a WhatsApp"
                      description="Envía todas las fotos de entrega juntas al finalizar"
                      checked={draft.visibleButtons.sendPhotos}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, sendPhotos: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Pestaña para ocultar / ver mapa"
                      description="Pequeña pestaña en la orilla del mapa para colapsarlo"
                      checked={draft.visibleButtons.toggleMap}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, toggleMap: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Editar mensaje WhatsApp"
                      description="También puedes editar la plantilla aquí en Mapa y Más"
                      checked={draft.visibleButtons.editWhatsApp}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, editWhatsApp: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón flotante (+) Agregar Paquete"
                      description="Botón fijo en la esquina inferior derecha"
                      checked={draft.visibleButtons.fabAdd}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, fabAdd: val },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Iconos en cada paquete de la lista</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Icono de Foto / Cámara"
                      checked={draft.visibleButtons.rowPhoto}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, rowPhoto: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Icono de Abrir WhatsApp"
                      checked={draft.visibleButtons.rowWhatsApp}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, rowWhatsApp: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Icono de Editar paquete"
                      checked={draft.visibleButtons.rowEdit}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, rowEdit: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Selector rápido de estado (Pendiente / Entregada)"
                      checked={draft.visibleButtons.rowStatus}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, rowStatus: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Icono de Eliminar paquete"
                      checked={draft.visibleButtons.rowDelete}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          visibleButtons: { ...prev.visibleButtons, rowDelete: val },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: COLORES */}
            {activeTab === 'colors' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Colores de los botones</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Elige una paleta rápida o personaliza el color de cada botón por separado.
                  </p>
                </div>

                {/* Paletas rápidas */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Paletas rápidas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {COLOR_PALETTE_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setDraft(prev => ({
                            ...prev,
                            buttonColors: { ...preset.colors },
                          }))
                        }
                        className="p-3 rounded-2xl border border-gray-200 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-500 bg-gray-50/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 text-left transition-all flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-slate-100">{preset.name}</p>
                          <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{preset.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`w-4 h-4 rounded-full ${BUTTON_COLOR_STYLES[preset.colors.optimize].swatch}`} />
                          <span className={`w-4 h-4 rounded-full ${BUTTON_COLOR_STYLES[preset.colors.startRoute].swatch}`} />
                          <span className={`w-4 h-4 rounded-full ${BUTTON_COLOR_STYLES[preset.colors.shareWaze].swatch}`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vista previa en vivo */}
                <div className="bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 space-y-2.5">
                  <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block">Vista previa rápida:</span>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-3 py-2 rounded-xl text-xs font-bold ${BUTTON_COLOR_STYLES[draft.buttonColors.optimize].solid}`}>
                      Optimizar
                    </span>
                    <span className={`px-3 py-2 rounded-xl text-xs font-bold ${BUTTON_COLOR_STYLES[draft.buttonColors.startRoute].solid}`}>
                      Iniciar Ruta
                    </span>
                    <span className={`px-3 py-2 rounded-xl text-xs font-bold ${BUTTON_COLOR_STYLES[draft.buttonColors.shareWaze].solid}`}>
                      Waze
                    </span>
                    <span className={`px-3 py-2 rounded-xl text-xs font-bold ${BUTTON_COLOR_STYLES[draft.buttonColors.toggleMap].outline}`}>
                      Ocultar Mapa
                    </span>
                    <span className={`px-3 py-2 rounded-xl text-xs font-bold ${BUTTON_COLOR_STYLES[draft.buttonColors.whatsappBtn].soft}`}>
                      WhatsApp
                    </span>
                  </div>
                </div>

                {/* Colores individuales */}
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {colorTargets.map(item => {
                    const currentColor = draft.buttonColors[item.key];
                    return (
                      <div key={item.key} className="py-3.5 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-gray-900 dark:text-slate-100">{item.label}</p>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400">{item.hint}</p>
                          </div>
                          <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-300">
                            {BUTTON_COLOR_STYLES[currentColor].label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {COLOR_KEYS.map(colorKey => {
                            const style = BUTTON_COLOR_STYLES[colorKey];
                            const selected = currentColor === colorKey;
                            return (
                              <button
                                key={colorKey}
                                type="button"
                                onClick={() => updateButtonColor(item.key, colorKey)}
                                title={style.label}
                                aria-label={`${item.label}: ${style.label}`}
                                className={`w-8 h-8 rounded-full ${style.swatch} flex items-center justify-center transition-transform ${
                                  selected
                                    ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white dark:ring-offset-slate-900 scale-110'
                                    : 'opacity-80 hover:opacity-100 hover:scale-105'
                                }`}
                              >
                                {selected && <Check className="w-4 h-4 text-white drop-shadow-xs" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: CASILLAS PARA CREAR PAQUETES */}
            {activeTab === 'fields' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Casillas para crear paquetes</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Define qué campos aparecen al tocar "+ Agregar Paquete" y cuáles son obligatorios.
                  </p>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  <ToggleRow
                    label="Casilla: Nombre del cliente o referencia"
                    description="Permite escribir el nombre de quien recibe el paquete"
                    checked={draft.packageFields.showName}
                    onChange={val =>
                      setDraft(prev => ({
                        ...prev,
                        packageFields: {
                          ...prev.packageFields,
                          showName: val,
                          requireName: val ? prev.packageFields.requireName : false,
                        },
                      }))
                    }
                  />
                  {draft.packageFields.showName && (
                    <ToggleRow
                      label="Hacer obligatorio el Nombre"
                      description="Impide guardar el paquete si el campo Nombre está vacío"
                      checked={draft.packageFields.requireName}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          packageFields: { ...prev.packageFields, requireName: val },
                        }))
                      }
                    />
                  )}
                  <ToggleRow
                    label="Casilla: Teléfono del cliente"
                    description="Necesario si deseas usar los botones rápidos de WhatsApp"
                    checked={draft.packageFields.showPhone}
                    onChange={val =>
                      setDraft(prev => ({
                        ...prev,
                        packageFields: {
                          ...prev.packageFields,
                          showPhone: val,
                          requirePhone: val ? prev.packageFields.requirePhone : false,
                        },
                      }))
                    }
                  />
                  {draft.packageFields.showPhone && (
                    <ToggleRow
                      label="Hacer obligatorio el Teléfono"
                      description="Impide guardar si no se ingresa número telefónico"
                      checked={draft.packageFields.requirePhone}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          packageFields: { ...prev.packageFields, requirePhone: val },
                        }))
                      }
                    />
                  )}
                  <ToggleRow
                    label="Casilla: Ubicación (WhatsApp o Google Maps)"
                    description="Si la ocultas, podrás crear paquetes rápidos solo con número y datos básicos"
                    checked={draft.packageFields.showLocation}
                    onChange={val =>
                      setDraft(prev => ({
                        ...prev,
                        packageFields: { ...prev.packageFields, showLocation: val },
                      }))
                    }
                  />
                  <ToggleRow
                    label="Casilla adicional: Notas de entrega"
                    description="Agrega un campo extra para color de casa, indicaciones o monto"
                    checked={draft.packageFields.showNotes}
                    onChange={val =>
                      setDraft(prev => ({
                        ...prev,
                        packageFields: { ...prev.packageFields, showNotes: val },
                      }))
                    }
                  />
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-gray-800 dark:text-slate-200 block">
                    Casilla que se selecciona automáticamente al abrir "Agregar Paquete":
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'number', label: '# Paquete' },
                      { id: 'phone', label: 'Teléfono', hidden: !draft.packageFields.showPhone },
                      { id: 'name', label: 'Nombre', hidden: !draft.packageFields.showName },
                      { id: 'location', label: 'Ubicación', hidden: !draft.packageFields.showLocation },
                    ]
                      .filter(opt => !opt.hidden)
                      .map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            setDraft(prev => ({
                              ...prev,
                              packageFields: {
                                ...prev.packageFields,
                                autoFocusField: opt.id as AppSettings['packageFields']['autoFocusField'],
                              },
                            }))
                          }
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors ${
                            draft.packageFields.autoFocusField === opt.id
                              ? 'bg-gray-900 dark:bg-emerald-600 text-white border-gray-900 dark:border-emerald-600'
                              : 'bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: NAVEGADOR GPS (QUÉ MOSTRAR Y QUÉ OCULTAR) */}
            {activeTab === 'gps' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Opciones del Navegador GPS</h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Elige qué cuadros, botones e información se muestran o se ocultan en el navegador GPS.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...DEFAULT_APP_SETTINGS.gpsNavigator },
                        }))
                      }
                      className="px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-200 whitespace-nowrap transition-colors"
                    >
                      Mostrar todo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: {
                            showTurnBanner: true,
                            startBannerHidden: false,
                            showNextStepStrip: false,
                            showSpeedometer: true,
                            showZoomControls: false,
                            showSimulateButton: false,
                            showCompassButton: true,
                            showRerouteButton: false,
                            showNoGpsBanner: true,
                            showBottomEta: true,
                            showBottomAddress: true,
                            showBottomDeliveredBtn: true,
                            showBottomPhotoBtn: true,
                            showBottomFailedBtn: true,
                            showBottomWhatsAppBtn: true,
                            showBottomWazeBtn: false,
                            showBottomGoogleMapsBtn: false,
                          },
                        }))
                      }
                      className="px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-gray-900 dark:bg-emerald-600 hover:bg-gray-800 dark:hover:bg-emerald-700 text-white whitespace-nowrap transition-colors"
                    >
                      Modo limpio
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Indicaciones superiores</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Cuadro verde de dirección"
                      description="Muestra distancia, flecha de giro y calle actual en la parte superior"
                      checked={draft.gpsNavigator.showTurnBanner}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showTurnBanner: val },
                        }))
                      }
                    />
                    {draft.gpsNavigator.showTurnBanner && (
                      <>
                        <ToggleRow
                          label="Iniciar con cuadro verde minimizado"
                          description="Abre con la pastilla compacta para dejar más mapa visible en celular"
                          checked={draft.gpsNavigator.startBannerHidden}
                          onChange={val =>
                            setDraft(prev => ({
                              ...prev,
                              gpsNavigator: { ...prev.gpsNavigator, startBannerHidden: val },
                            }))
                          }
                        />
                        <ToggleRow
                          label='Franja "Luego" y botón de Pasos'
                          description="Muestra el giro siguiente y la lista completa de pasos"
                          checked={draft.gpsNavigator.showNextStepStrip}
                          onChange={val =>
                            setDraft(prev => ({
                              ...prev,
                              gpsNavigator: { ...prev.gpsNavigator, showNextStepStrip: val },
                            }))
                          }
                        />
                      </>
                    )}
                    <ToggleRow
                      label='Aviso "Sin GPS activo"'
                      description="Recordatorio superior cuando la ubicación del teléfono está apagada"
                      checked={draft.gpsNavigator.showNoGpsBanner}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showNoGpsBanner: val },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Controles flotantes sobre el mapa</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Velocímetro (km/h)"
                      checked={draft.gpsNavigator.showSpeedometer}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showSpeedometer: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botones de Zoom (+ y -)"
                      checked={draft.gpsNavigator.showZoomControls}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showZoomControls: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Simular recorrido"
                      checked={draft.gpsNavigator.showSimulateButton}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showSimulateButton: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Brújula (rotar / norte fijo)"
                      checked={draft.gpsNavigator.showCompassButton}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showCompassButton: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Recalcular ruta"
                      checked={draft.gpsNavigator.showRerouteButton}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showRerouteButton: val },
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-gray-800 dark:text-slate-200">Tarjeta inferior y botones de acción</h4>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    <ToggleRow
                      label="Tiempo estimado (ETA) y distancia"
                      checked={draft.gpsNavigator.showBottomEta}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomEta: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Dirección del paquete"
                      checked={draft.gpsNavigator.showBottomAddress}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomAddress: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Entregado"
                      checked={draft.gpsNavigator.showBottomDeliveredBtn}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomDeliveredBtn: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Foto"
                      checked={draft.gpsNavigator.showBottomPhotoBtn}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomPhotoBtn: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón Fallida"
                      checked={draft.gpsNavigator.showBottomFailedBtn}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomFailedBtn: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón WhatsApp"
                      checked={draft.gpsNavigator.showBottomWhatsAppBtn}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomWhatsAppBtn: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón abrir en Waze externo"
                      checked={draft.gpsNavigator.showBottomWazeBtn}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomWazeBtn: val },
                        }))
                      }
                    />
                    <ToggleRow
                      label="Botón abrir en Google Maps externo"
                      checked={draft.gpsNavigator.showBottomGoogleMapsBtn}
                      onChange={val =>
                        setDraft(prev => ({
                          ...prev,
                          gpsNavigator: { ...prev.gpsNavigator, showBottomGoogleMapsBtn: val },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: MAPA, WHATSAPP Y DATOS */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="pb-4 border-b border-gray-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">Apariencia, mapa y opciones generales</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Elige Modo Día o Modo Oscuro, proveedor de mapa, mensaje preestablecido y respaldo local.
                  </p>
                </div>

                {/* Apariencia: Modo Día / Modo Oscuro */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                    {draft.general.theme === 'dark' ? (
                      <Moon className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500" />
                    )}
                    <span>Modo de interfaz:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({ ...prev, general: { ...prev.general, theme: 'light' } }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        draft.general.theme === 'light'
                          ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-xs'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <Sun className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">Modo Día</p>
                        <p className="text-[11px] opacity-80 truncate">Claro para rutas de sol</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft(prev => ({ ...prev, general: { ...prev.general, theme: 'dark' } }))
                      }
                      className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        draft.general.theme === 'dark'
                          ? 'bg-slate-900 dark:bg-slate-800 border-emerald-500 text-white shadow-xs'
                          : 'bg-gray-50 dark:bg-slate-800/70 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-800 dark:bg-slate-700 text-amber-300 flex items-center justify-center shrink-0">
                        <Moon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold">Modo Oscuro</p>
                        <p className="text-[11px] opacity-80 truncate">Cómodo de noche</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Proveedor de Mapa */}
                <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-slate-800">
                  <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Proveedor de mapa activo:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDraftMapProvider('free')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        draftMapProvider === 'free'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-950 dark:text-emerald-200'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold">Mapa Gratis (OpenStreetMap)</p>
                      <p className="text-[11px] opacity-80 mt-0.5">Sin límite de cuota ni pagos</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftMapProvider('google')}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        draftMapProvider === 'google'
                          ? 'bg-gray-900 dark:bg-emerald-600 border-gray-900 dark:border-emerald-600 text-white'
                          : 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold">Google Maps</p>
                      <p className="text-[11px] opacity-80 mt-0.5">Rutas viales con cuota diaria</p>
                    </button>
                  </div>
                </div>

                {/* Comportamiento general */}
                <div className="divide-y divide-gray-100 dark:divide-slate-800 border-t border-gray-200 dark:border-slate-800 pt-2">
                  <ToggleRow
                    label="Mostrar el mapa al abrir la aplicación"
                    checked={draft.general.defaultShowMap}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, general: { ...prev.general, defaultShowMap: val } }))
                    }
                  />
                  <ToggleRow
                    label="Lista de paquetes compacta"
                    description="Muestra tarjetas más pequeñas para ver más paquetes al mismo tiempo"
                    checked={draft.general.compactList}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, general: { ...prev.general, compactList: val } }))
                    }
                  />
                  <ToggleRow
                    label="Lista de paquetes expandida al abrir"
                    checked={draft.general.defaultListExpanded}
                    onChange={val =>
                      setDraft(prev => ({ ...prev, general: { ...prev.general, defaultListExpanded: val } }))
                    }
                  />
                  <ToggleRow
                    label="Mostrar aviso de paquetes fuera de cobertura"
                    checked={draft.general.showOutOfCoverageBanner}
                    onChange={val =>
                      setDraft(prev => ({
                        ...prev,
                        general: { ...prev.general, showOutOfCoverageBanner: val },
                      }))
                    }
                  />
                  <ToggleRow
                    label="Pedir confirmación antes de eliminar un paquete"
                    description="Evita borrados accidentales al tocar el basurero"
                    checked={draft.general.confirmBeforeDelete}
                    onChange={val =>
                      setDraft(prev => ({
                        ...prev,
                        general: { ...prev.general, confirmBeforeDelete: val },
                      }))
                    }
                  />
                </div>

                {/* Plantillas rotativas de WhatsApp */}
                <div className="pt-3 border-t border-gray-200 dark:border-slate-800">
                  <WhatsAppTemplatesEditor
                    templates={waTemplates}
                    onChange={setWaTemplates}
                  />
                </div>

                {/* API Key */}
                <div className="pt-3 border-t border-gray-200 dark:border-slate-800 space-y-1.5">
                  <label className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Google Maps API Key (opcional):</span>
                  </label>
                  <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 rounded-xl border border-gray-300 dark:border-slate-700 p-3 text-xs focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono"
                  />
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Si se deja en blanco, se usa la configuración estándar o el Mapa Gratis sin límites.
                  </p>
                </div>

                {/* Conductores activos */}
                {onOpenDriversModal && (
                  <div className="pt-3 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                        Conductores activos en la app
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Cambia de conductor o elimina a quienes ya no estén trabajando.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDriversModal();
                      }}
                      className="px-3.5 py-2.5 min-h-[40px] rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Conductores</span>
                    </button>
                  </div>
                )}

                {/* Privacidad y acciones de reinicio */}
                <div className="bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p>
                    Tus preferencias se guardan en este dispositivo y los paquetes se sincronizan en tiempo real con los conductores activos.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  {!confirmResetApp ? (
                    <button
                      type="button"
                      onClick={() => setConfirmResetApp(true)}
                      className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-gray-700 dark:text-slate-200 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restablecer configuración</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(DEFAULT_APP_SETTINGS);
                        setDraftMapProvider(DEFAULT_APP_SETTINGS.general.defaultMapProvider);
                        setWaTemplates([...DEFAULT_LOCATION_REQUEST_TEMPLATES]);
                        setConfirmResetApp(false);
                      }}
                      className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmar restablecimiento</span>
                    </button>
                  )}

                  {!confirmClearData ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearData(true)}
                      className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border border-red-200 dark:border-red-800/70 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Borrar paquetes locales</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        onResetData();
                        setConfirmClearData(false);
                        onClose();
                      }}
                      className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Sí, borrar todo</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/80 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 hover:bg-gray-200/70 dark:hover:bg-slate-700/70 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              BUTTON_COLOR_STYLES[draft.buttonColors.accent].solid
            }`}
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            <span>{saved ? 'Guardado' : 'Guardar cambios'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

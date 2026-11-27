export type ButtonColorKey =
  | 'emerald'
  | 'teal'
  | 'green'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'amber'
  | 'orange'
  | 'red'
  | 'slate';

export interface ButtonColorStyle {
  label: string;
  swatch: string;
  solid: string;
  soft: string;
  outline: string;
  iconBg: string;
  badgeText: string;
}

export const BUTTON_COLOR_STYLES: Record<ButtonColorKey, ButtonColorStyle> = {
  emerald: {
    label: 'Esmeralda',
    swatch: 'bg-emerald-600',
    solid: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20',
    soft: 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    iconBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20',
    badgeText: 'text-emerald-600 dark:text-emerald-400',
  },
  teal: {
    label: 'Turquesa',
    swatch: 'bg-teal-600',
    solid: 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-600/20',
    soft: 'bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/70 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-slate-700 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
    iconBg: 'bg-teal-600 text-white shadow-md shadow-teal-600/20',
    badgeText: 'text-teal-600 dark:text-teal-400',
  },
  green: {
    label: 'Verde',
    swatch: 'bg-green-600',
    solid: 'bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-600/20',
    soft: 'bg-green-50 dark:bg-green-950/60 hover:bg-green-100 dark:hover:bg-green-900/70 text-green-900 dark:text-green-200 border border-green-300 dark:border-green-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-slate-700 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800',
    iconBg: 'bg-green-600 text-white shadow-md shadow-green-600/20',
    badgeText: 'text-green-600 dark:text-green-400',
  },
  sky: {
    label: 'Celeste',
    swatch: 'bg-sky-500',
    solid: 'bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-500/20',
    soft: 'bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/70 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
    iconBg: 'bg-sky-500 text-white shadow-md shadow-sky-500/20',
    badgeText: 'text-sky-600 dark:text-sky-400',
  },
  blue: {
    label: 'Azul',
    swatch: 'bg-blue-600',
    solid: 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20',
    soft: 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/70 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    iconBg: 'bg-blue-600 text-white shadow-md shadow-blue-600/20',
    badgeText: 'text-blue-600 dark:text-blue-400',
  },
  indigo: {
    label: 'Índigo',
    swatch: 'bg-indigo-600',
    solid: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20',
    soft: 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 text-indigo-900 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
    iconBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
  },
  purple: {
    label: 'Morado',
    swatch: 'bg-purple-600',
    solid: 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20',
    soft: 'bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/70 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-600 text-white shadow-md shadow-purple-600/20',
    badgeText: 'text-purple-600 dark:text-purple-400',
  },
  amber: {
    label: 'Ámbar',
    swatch: 'bg-amber-500',
    solid: 'bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-md shadow-amber-500/20',
    soft: 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    iconBg: 'bg-amber-500 text-amber-950 shadow-md shadow-amber-500/20',
    badgeText: 'text-amber-600 dark:text-amber-400',
  },
  orange: {
    label: 'Naranja',
    swatch: 'bg-orange-500',
    solid: 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/20',
    soft: 'bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 dark:hover:bg-orange-900/70 text-orange-900 dark:text-orange-200 border border-orange-300 dark:border-orange-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-slate-700 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    iconBg: 'bg-orange-500 text-white shadow-md shadow-orange-500/20',
    badgeText: 'text-orange-600 dark:text-orange-400',
  },
  red: {
    label: 'Rojo',
    swatch: 'bg-red-600',
    solid: 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/20',
    soft: 'bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/70 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700',
    outline: 'bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-slate-700 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800',
    iconBg: 'bg-red-600 text-white shadow-md shadow-red-600/20',
    badgeText: 'text-red-600 dark:text-red-400',
  },
  slate: {
    label: 'Oscuro',
    swatch: 'bg-gray-900',
    solid: 'bg-gray-900 dark:bg-slate-700 hover:bg-gray-800 dark:hover:bg-slate-600 text-white shadow-md shadow-gray-900/20 dark:border dark:border-slate-600',
    soft: 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-slate-100 border border-gray-300 dark:border-slate-600',
    outline: 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700',
    iconBg: 'bg-gray-900 dark:bg-slate-700 text-white shadow-md shadow-gray-900/20',
    badgeText: 'text-gray-700 dark:text-slate-300',
  },
};

export interface SpeakerSettings {
  fields: {
    packageNumber: boolean;
    recipientName: boolean;
    address: boolean;
    province: boolean;
    distance: boolean;
    phone: boolean;
    notes: boolean;
  };
  autoReadOnNavigation: boolean;
  autoReadOnListTap: boolean;
  autoReadOnMapPin: boolean;
  celebrateMilestonesSound: boolean;
  gpsTurnByTurnVoice: boolean;
  gpsAnnounceStreetStart: boolean;
  gpsAnnounceApproach: boolean;
  rate: number; // 0.8 | 1 | 1.2 | 1.4
  pitch: number; // 0.85 | 1 | 1.15
  customPrefix: string;
}

export interface ButtonColorsSettings {
  accent: ButtonColorKey;
  optimize: ButtonColorKey;
  startRoute: ButtonColorKey;
  shareWaze: ButtonColorKey;
  toggleMap: ButtonColorKey;
  whatsappBtn: ButtonColorKey;
  wazeBtn: ButtonColorKey;
  speakerBtn: ButtonColorKey;
  photoBtn: ButtonColorKey;
}

export interface PackageFieldsSettings {
  showName: boolean;
  showPhone: boolean;
  showLocation: boolean;
  showNotes: boolean;
  requireName: boolean;
  requirePhone: boolean;
  autoFocusField: 'number' | 'name' | 'phone' | 'location';
}

export interface VisibleButtonsSettings {
  headerInstall: boolean;
  headerSpeaker: boolean;
  headerGps: boolean;
  headerSavedRoutes: boolean;
  optimize: boolean;
  startRoute: boolean;
  shareWaze: boolean;
  requestLocations: boolean;
  sendPhotos: boolean;
  toggleMap: boolean;
  editWhatsApp: boolean;
  fabAdd: boolean;
  rowPhoto: boolean;
  rowWhatsApp: boolean;
  rowEdit: boolean;
  rowStatus: boolean;
  rowDelete: boolean;
}

export interface GpsNavigatorSettings {
  showTurnBanner: boolean;
  startBannerHidden: boolean;
  showNextStepStrip: boolean;
  showSpeedometer: boolean;
  showZoomControls: boolean;
  showSimulateButton: boolean;
  showCompassButton: boolean;
  showRerouteButton: boolean;
  showNoGpsBanner: boolean;
  showBottomEta: boolean;
  showBottomAddress: boolean;
  showBottomDeliveredBtn: boolean;
  showBottomPhotoBtn: boolean;
  showBottomFailedBtn: boolean;
  showBottomWhatsAppBtn: boolean;
  showBottomWazeBtn: boolean;
  showBottomGoogleMapsBtn: boolean;
}

export type AppTheme = 'light' | 'dark';
export type DefaultMapMode = '2d' | 'gps';

export interface GeneralSettings {
  theme: AppTheme;
  defaultMapMode: DefaultMapMode;
  defaultMapProvider: 'google' | 'free';
  defaultShowMap: boolean;
  defaultListExpanded: boolean;
  compactList: boolean;
  confirmBeforeDelete: boolean;
  showOutOfCoverageBanner: boolean;
}

export interface AppSettings {
  version?: number;
  speaker: SpeakerSettings;
  buttonColors: ButtonColorsSettings;
  packageFields: PackageFieldsSettings;
  visibleButtons: VisibleButtonsSettings;
  gpsNavigator: GpsNavigatorSettings;
  general: GeneralSettings;
}

export const CURRENT_APP_SETTINGS_VERSION = 6;

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: CURRENT_APP_SETTINGS_VERSION,
  speaker: {
    fields: {
      packageNumber: true,
      recipientName: true,
      address: true,
      province: true,
      distance: true,
      phone: false,
      notes: false,
    },
    autoReadOnNavigation: true,
    autoReadOnListTap: true,
    autoReadOnMapPin: true,
    celebrateMilestonesSound: true,
    gpsTurnByTurnVoice: true,
    gpsAnnounceStreetStart: true,
    gpsAnnounceApproach: true,
    rate: 1,
    pitch: 1,
    customPrefix: '',
  },
  buttonColors: {
    accent: 'emerald',
    optimize: 'emerald',
    startRoute: 'teal',
    shareWaze: 'sky',
    toggleMap: 'slate',
    whatsappBtn: 'green',
    wazeBtn: 'sky',
    speakerBtn: 'amber',
    photoBtn: 'indigo',
  },
  packageFields: {
    showName: true,
    showPhone: true,
    showLocation: true,
    showNotes: false,
    requireName: false,
    requirePhone: false,
    autoFocusField: 'location',
  },
  visibleButtons: {
    headerInstall: false,
    headerSpeaker: true,
    headerGps: false,
    headerSavedRoutes: false,
    optimize: false,
    startRoute: true,
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
  gpsNavigator: {
    showTurnBanner: true,
    startBannerHidden: false,
    showNextStepStrip: true,
    showSpeedometer: true,
    showZoomControls: true,
    showSimulateButton: true,
    showCompassButton: true,
    showRerouteButton: true,
    showNoGpsBanner: true,
    showBottomEta: true,
    showBottomAddress: true,
    showBottomDeliveredBtn: true,
    showBottomPhotoBtn: true,
    showBottomFailedBtn: true,
    showBottomWhatsAppBtn: true,
    showBottomWazeBtn: true,
    showBottomGoogleMapsBtn: true,
  },
  general: {
    theme: 'light',
    defaultMapMode: '2d',
    defaultMapProvider: 'google',
    defaultShowMap: true,
    defaultListExpanded: true,
    compactList: true,
    confirmBeforeDelete: false,
    showOutOfCoverageBanner: true,
  },
};

export const COLOR_PALETTE_PRESETS: {
  id: string;
  name: string;
  description: string;
  colors: ButtonColorsSettings;
}[] = [
  {
    id: 'ruteo',
    name: 'Clásico RUTEO',
    description: 'Esmeralda, turquesa y celeste Waze',
    colors: { ...DEFAULT_APP_SETTINGS.buttonColors },
  },
  {
    id: 'ocean',
    name: 'Azul Corporativo',
    description: 'Tonos azules, índigo y cian',
    colors: {
      accent: 'blue',
      optimize: 'blue',
      startRoute: 'indigo',
      shareWaze: 'sky',
      toggleMap: 'slate',
      whatsappBtn: 'green',
      wazeBtn: 'sky',
      speakerBtn: 'amber',
      photoBtn: 'purple',
    },
  },
  {
    id: 'express',
    name: 'Naranja Express',
    description: 'Alta visibilidad diurna en ruta',
    colors: {
      accent: 'orange',
      optimize: 'orange',
      startRoute: 'red',
      shareWaze: 'sky',
      toggleMap: 'slate',
      whatsappBtn: 'green',
      wazeBtn: 'blue',
      speakerBtn: 'amber',
      photoBtn: 'indigo',
    },
  },
  {
    id: 'contrast',
    name: 'Oscuro Sobrio',
    description: 'Botones principales oscuros de alto contraste',
    colors: {
      accent: 'slate',
      optimize: 'slate',
      startRoute: 'emerald',
      shareWaze: 'blue',
      toggleMap: 'slate',
      whatsappBtn: 'green',
      wazeBtn: 'sky',
      speakerBtn: 'amber',
      photoBtn: 'indigo',
    },
  },
];

const APP_SETTINGS_STORAGE_KEY = 'ruteo_app_settings';

function isValidColorKey(val: unknown): val is ButtonColorKey {
  return typeof val === 'string' && val in BUTTON_COLOR_STYLES;
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw);
    const savedVersion = typeof parsed?.version === 'number' ? parsed.version : 1;

    const { headerDriverFilter: _removedDriverFilter, ...parsedVisibleButtons } = parsed?.visibleButtons || {};
    const mergedVisibleButtons: VisibleButtonsSettings = {
      ...DEFAULT_APP_SETTINGS.visibleButtons,
      ...parsedVisibleButtons,
    };

    if (savedVersion < 2) {
      mergedVisibleButtons.optimize = false;
      mergedVisibleButtons.startRoute = false;
      mergedVisibleButtons.shareWaze = false;
      mergedVisibleButtons.editWhatsApp = false;
      mergedVisibleButtons.sendPhotos = true;
      mergedVisibleButtons.toggleMap = true;
    }

    if (savedVersion < 3) {
      mergedVisibleButtons.headerInstall = false;
      mergedVisibleButtons.headerGps = false;
      mergedVisibleButtons.headerSavedRoutes = false;
    }

    if (savedVersion < 4) {
      mergedVisibleButtons.requestLocations = true;
    }

    if (savedVersion < 5) {
      mergedVisibleButtons.startRoute = true;
    }

    const result: AppSettings = {
      version: CURRENT_APP_SETTINGS_VERSION,
      speaker: {
        fields: {
          ...DEFAULT_APP_SETTINGS.speaker.fields,
          ...(parsed?.speaker?.fields || {}),
        },
        autoReadOnNavigation:
          typeof parsed?.speaker?.autoReadOnNavigation === 'boolean'
            ? parsed.speaker.autoReadOnNavigation
            : DEFAULT_APP_SETTINGS.speaker.autoReadOnNavigation,
        autoReadOnListTap:
          typeof parsed?.speaker?.autoReadOnListTap === 'boolean'
            ? parsed.speaker.autoReadOnListTap
            : DEFAULT_APP_SETTINGS.speaker.autoReadOnListTap,
        autoReadOnMapPin:
          typeof parsed?.speaker?.autoReadOnMapPin === 'boolean'
            ? parsed.speaker.autoReadOnMapPin
            : DEFAULT_APP_SETTINGS.speaker.autoReadOnMapPin,
        celebrateMilestonesSound:
          typeof parsed?.speaker?.celebrateMilestonesSound === 'boolean'
            ? parsed.speaker.celebrateMilestonesSound
            : DEFAULT_APP_SETTINGS.speaker.celebrateMilestonesSound,
        gpsTurnByTurnVoice:
          typeof parsed?.speaker?.gpsTurnByTurnVoice === 'boolean'
            ? parsed.speaker.gpsTurnByTurnVoice
            : DEFAULT_APP_SETTINGS.speaker.gpsTurnByTurnVoice,
        gpsAnnounceStreetStart:
          typeof parsed?.speaker?.gpsAnnounceStreetStart === 'boolean'
            ? parsed.speaker.gpsAnnounceStreetStart
            : DEFAULT_APP_SETTINGS.speaker.gpsAnnounceStreetStart,
        gpsAnnounceApproach:
          typeof parsed?.speaker?.gpsAnnounceApproach === 'boolean'
            ? parsed.speaker.gpsAnnounceApproach
            : DEFAULT_APP_SETTINGS.speaker.gpsAnnounceApproach,
        rate:
          typeof parsed?.speaker?.rate === 'number' && parsed.speaker.rate >= 0.6 && parsed.speaker.rate <= 1.8
            ? parsed.speaker.rate
            : DEFAULT_APP_SETTINGS.speaker.rate,
        pitch:
          typeof parsed?.speaker?.pitch === 'number' && parsed.speaker.pitch >= 0.7 && parsed.speaker.pitch <= 1.5
            ? parsed.speaker.pitch
            : DEFAULT_APP_SETTINGS.speaker.pitch,
        customPrefix:
          typeof parsed?.speaker?.customPrefix === 'string'
            ? parsed.speaker.customPrefix.slice(0, 60)
            : DEFAULT_APP_SETTINGS.speaker.customPrefix,
      },
      buttonColors: {
        accent: isValidColorKey(parsed?.buttonColors?.accent) ? parsed.buttonColors.accent : DEFAULT_APP_SETTINGS.buttonColors.accent,
        optimize: isValidColorKey(parsed?.buttonColors?.optimize) ? parsed.buttonColors.optimize : DEFAULT_APP_SETTINGS.buttonColors.optimize,
        startRoute: isValidColorKey(parsed?.buttonColors?.startRoute) ? parsed.buttonColors.startRoute : DEFAULT_APP_SETTINGS.buttonColors.startRoute,
        shareWaze: isValidColorKey(parsed?.buttonColors?.shareWaze) ? parsed.buttonColors.shareWaze : DEFAULT_APP_SETTINGS.buttonColors.shareWaze,
        toggleMap: isValidColorKey(parsed?.buttonColors?.toggleMap) ? parsed.buttonColors.toggleMap : DEFAULT_APP_SETTINGS.buttonColors.toggleMap,
        whatsappBtn: isValidColorKey(parsed?.buttonColors?.whatsappBtn) ? parsed.buttonColors.whatsappBtn : DEFAULT_APP_SETTINGS.buttonColors.whatsappBtn,
        wazeBtn: isValidColorKey(parsed?.buttonColors?.wazeBtn) ? parsed.buttonColors.wazeBtn : DEFAULT_APP_SETTINGS.buttonColors.wazeBtn,
        speakerBtn: isValidColorKey(parsed?.buttonColors?.speakerBtn) ? parsed.buttonColors.speakerBtn : DEFAULT_APP_SETTINGS.buttonColors.speakerBtn,
        photoBtn: isValidColorKey(parsed?.buttonColors?.photoBtn) ? parsed.buttonColors.photoBtn : DEFAULT_APP_SETTINGS.buttonColors.photoBtn,
      },
      packageFields: {
        ...DEFAULT_APP_SETTINGS.packageFields,
        ...(parsed?.packageFields || {}),
      },
      visibleButtons: mergedVisibleButtons,
      gpsNavigator: {
        ...DEFAULT_APP_SETTINGS.gpsNavigator,
        ...(parsed?.gpsNavigator || {}),
      },
      general: {
        ...DEFAULT_APP_SETTINGS.general,
        ...(parsed?.general || {}),
        theme:
          parsed?.general?.theme === 'dark' || parsed?.general?.theme === 'light'
            ? parsed.general.theme
            : DEFAULT_APP_SETTINGS.general.theme,
        defaultMapMode:
          parsed?.general?.defaultMapMode === 'gps' || parsed?.general?.defaultMapMode === '2d'
            ? parsed.general.defaultMapMode
            : DEFAULT_APP_SETTINGS.general.defaultMapMode,
        defaultMapProvider:
          parsed?.general?.defaultMapProvider === 'free' || parsed?.general?.defaultMapProvider === 'google'
            ? parsed.general.defaultMapProvider
            : DEFAULT_APP_SETTINGS.general.defaultMapProvider,
      },
    };

    if (savedVersion < CURRENT_APP_SETTINGS_VERSION) {
      saveAppSettings(result);
    }

    return result;
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...settings, version: CURRENT_APP_SETTINGS_VERSION })
    );
  } catch {
    // ignore storage quota errors
  }
}

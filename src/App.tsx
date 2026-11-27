import React, { useState, useEffect } from 'react';
import { DeliveryItem, DriverProfile, RouteSession, GpsPosition } from './types';
import { QuotaBanner } from './components/QuotaBanner';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { MapView } from './components/MapView';
import { FreeMapView } from './components/FreeMapView';
import { LocationInputModal } from './components/LocationInputModal';
import { RouteOptimizationModal } from './components/RouteOptimizationModal';
import { ActiveNavigationModal } from './components/ActiveNavigationModal';
import { LiveNavigationView } from './components/LiveNavigationView';
import { SavedRoutesModal } from './components/SavedRoutesModal';
import { SettingsModal } from './components/SettingsModal';
import { EditPackageModal } from './components/EditPackageModal';
import { DeliveryPhotoModal } from './components/DeliveryPhotoModal';
import { DeliveryConfirmModal } from './components/DeliveryConfirmModal';
import { DeliveryFailedModal } from './components/DeliveryFailedModal';
import { SendAllPhotosModal } from './components/SendAllPhotosModal';
import { RequestAllLocationsModal } from './components/RequestAllLocationsModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ConfettiBurst } from './components/ConfettiBurst';
import { MotivationalProgressBar } from './components/MotivationalProgressBar';
import { DriverManagerModal, DriverOnboardingModal } from './components/DriverModals';
import { Plus, CheckCircle2, RotateCcw, MapPin, ChevronUp, ChevronDown, Award, X, AlertTriangle } from 'lucide-react';
import {
  isSpeechSupported,
  playMilestoneCelebrationAudio,
  speakText,
  stopSpeaking,
  unlockCelebrationAudio,
} from './utils/speechUtils';
import {
  buildCircuitSignature,
  isActiveRoutableItem,
  optimizeCircuitByRoad,
  optimizeRoute,
} from './utils/optimizer';
import {
  MilestoneTier,
  buildMilestoneSpeechText,
  getMilestoneCelebrationCopy,
} from './utils/motivationalRewards';
import { AppSettings, BUTTON_COLOR_STYLES, loadAppSettings, saveAppSettings } from './utils/appSettings';
import {
  clearAllDeliveryPhotosFromDB,
  deleteDeliveryPhotoFromDB,
  loadAllDeliveryPhotosFromDB,
  saveDeliveryPhotoToDB,
} from './utils/photoStorage';
import {
  createDeliveriesInCloud,
  deleteAllRoutesFromCloud,
  deleteDeliveriesFromCloud,
  deleteDeliveryItemFromCloud,
  deleteDriverFromCloud,
  deleteRouteSessionFromCloud,
  registerOrSelectDriverInCloud,
  replaceActiveDeliveriesInCloud,
  resetFirestoreSyncCache,
  sanitizeDocId,
  saveRouteSessionToCloud,
  subscribeToActiveDrivers,
  subscribeToSharedDeliveries,
  subscribeToSharedRoutes,
  syncOptimizedOrderInCloud,
  updateDeliveryDetailsInCloud,
  updateDeliveryPhotoInCloud,
  updateDeliveryStatusInCloud,
} from './utils/firestoreSync';

const DRIVER_STORAGE_KEY = 'ruteo_driver_profile';

function loadSavedDriver(): DriverProfile | null {
  try {
    const raw = localStorage.getItem(DRIVER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriverProfile>;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.driverName === 'string' && parsed.driverName.trim()) {
      return {
        id: sanitizeDocId(parsed.id, 'drv'),
        driverName: parsed.driverName.trim(),
        active: true,
        createdAtMs: parsed.createdAtMs,
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export default function App() {
  const [items, setItems] = useState<DeliveryItem[]>(() => {
    const saved = localStorage.getItem('ruteo_current_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((item: any) => ({
          ...item,
          coverageStatus: item.coverageStatus || 'in_coverage',
          province: item.province || 'San José'
        }));
      } catch (e) {
        console.error('Error parsing saved items', e);
      }
    }
    return [
      {
        id: 'demo-1',
        originalNumber: 3,
        address: 'Avenida Central, San José Centro',
        lat: 9.9281,
        lng: -84.0907,
        status: 'in_transit',
        coverageStatus: 'in_coverage',
        province: 'San José',
        orderIndex: 0,
        distanceFromPrevKm: 1.2,
        estimatedMinutes: 5
      },
      {
        id: 'demo-2',
        originalNumber: 8,
        address: 'Parque Central de Heredia',
        lat: 10.0023,
        lng: -84.1165,
        status: 'in_transit',
        coverageStatus: 'in_coverage',
        province: 'Heredia',
        orderIndex: 1,
        distanceFromPrevKm: 3.5,
        estimatedMinutes: 10
      },
      {
        id: 'demo-3',
        originalNumber: 12,
        address: 'Ruinas de Cartago',
        lat: 9.8644,
        lng: -83.9194,
        status: 'in_transit',
        coverageStatus: 'in_coverage',
        province: 'Cartago',
        orderIndex: 2,
        distanceFromPrevKm: 5.1,
        estimatedMinutes: 15
      }
    ];
  });

  const [savedRoutes, setSavedRoutes] = useState<RouteSession[]>(() => {
    const saved = localStorage.getItem('ruteo_saved_routes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved routes', e);
      }
    }
    return [];
  });

  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('ruteo_api_key') || '';
  });

  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadAppSettings());
  const [currentGps, setCurrentGps] = useState<GpsPosition | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(() => loadAppSettings().general.defaultShowMap);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [mapProvider, setMapProvider] = useState<'google' | 'free'>(() => {
    const saved = localStorage.getItem('ruteo_map_provider');
    if (saved === 'free' || saved === 'google') return saved;
    return loadAppSettings().general.defaultMapProvider;
  });
  const [speakerEnabled, setSpeakerEnabled] = useState<boolean>(() => {
    return localStorage.getItem('ruteo_speaker_enabled') === 'true';
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [pendingDeliveryConfirmItem, setPendingDeliveryConfirmItem] = useState<DeliveryItem | null>(null);
  const [pendingFailedItem, setPendingFailedItem] = useState<DeliveryItem | null>(null);
  const [lastDeliveryFeedback, setLastDeliveryFeedback] = useState<{
    id: string;
    originalNumber: number;
    recipientName?: string;
    prevStatus: DeliveryItem['status'];
  } | null>(null);
  const [confettiBurstKey, setConfettiBurstKey] = useState<number>(0);
  const [confettiMilestone, setConfettiMilestone] = useState<number | null>(null);
  const [milestoneBanner, setMilestoneBanner] = useState<{
    tier: MilestoneTier;
    title: string;
    message: string;
    deliveredCount: number;
    totalCount: number;
  } | null>(null);
  const [currentDriver, setCurrentDriver] = useState<DriverProfile | null>(() => loadSavedDriver());
  const [activeDrivers, setActiveDrivers] = useState<DriverProfile[]>([]);
  const [isDriversModalOpen, setIsDriversModalOpen] = useState<boolean>(false);
  const [removedDriverNotice, setRemovedDriverNotice] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState<boolean>(false);
  const [syncQuotaMessage, setSyncQuotaMessage] = useState<string | null>(null);
  const milestoneInitRef = React.useRef<boolean>(false);
  const prevDeliveredCountRef = React.useRef<number>(0);
  const highestCelebratedTierRef = React.useRef<number>(0);
  const lastAutoOptimizedSigRef = React.useRef<string>('');
  const manualOverrideSigRef = React.useRef<string | null>(null);
  const itemsRef = React.useRef<DeliveryItem[]>(items);
  itemsRef.current = items;
  const savedRoutesRef = React.useRef<RouteSession[]>(savedRoutes);
  savedRoutesRef.current = savedRoutes;
  const currentGpsRef = React.useRef<GpsPosition | null>(currentGps);
  currentGpsRef.current = currentGps;
  const currentDriverRef = React.useRef<DriverProfile | null>(currentDriver);
  currentDriverRef.current = currentDriver;
  const activeDriversRef = React.useRef<DriverProfile[]>(activeDrivers);
  activeDriversRef.current = activeDrivers;
  const initialCloudDeliveriesHandledRef = React.useRef<boolean>(false);
  const initialCloudRoutesHandledRef = React.useRef<boolean>(false);
  const pendingLocalOrderSyncRef = React.useRef<boolean>(false);
  const suppressAutoOptimizeSyncRef = React.useRef<boolean>(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    let cancelled = false;
    loadAllDeliveryPhotosFromDB().then(photoMap => {
      if (cancelled) return;
      const hasAnyDbPhotos = Object.keys(photoMap).length > 0;
      setItems(prev => {
        let changed = false;
        const next = prev.map(item => {
          if (item.deliveryPhoto && !photoMap[item.id]) {
            void saveDeliveryPhotoToDB(item.id, item.deliveryPhoto);
            return item;
          }
          if (!item.deliveryPhoto && photoMap[item.id]) {
            changed = true;
            return { ...item, deliveryPhoto: photoMap[item.id] };
          }
          return item;
        });
        return changed || !hasAnyDbPhotos ? (changed ? next : prev) : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to active driver roster (enforces driver removal across devices in real time)
  useEffect(() => {
    const handleDriverRosterError = (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('quota exceeded')) {
        setSyncQuotaMessage(
          'Se alcanzó el límite diario gratuito de sincronización en la nube. Tus cambios siguen guardándose en este dispositivo y la cuota se restablece mañana.'
        );
      } else {
        showToast('No se pudo conectar con la lista de conductores. Verifica tu conexión.');
      }
    };

    const unsubDrivers = subscribeToActiveDrivers((drivers, meta) => {
      setActiveDrivers(drivers);
      const activeLocal = currentDriverRef.current;
      if (!meta.fromCache && activeLocal && !drivers.some(d => d.id === activeLocal.id)) {
        try {
          localStorage.removeItem(DRIVER_STORAGE_KEY);
        } catch {
          // ignore storage errors
        }
        resetFirestoreSyncCache();
        setCurrentDriver(null);
        setIsDriversModalOpen(false);
        setRemovedDriverNotice(
          `El conductor "${activeLocal.driverName}" fue eliminado de los conductores activos. Ingresa tu nombre para continuar.`
        );
      }
    }, handleDriverRosterError);

    return () => unsubDrivers();
  }, []);

  // Real-time shared fleet subscriptions (all active drivers see & manage the same packages and routes)
  useEffect(() => {
    if (!currentDriver) return;

    initialCloudDeliveriesHandledRef.current = false;
    initialCloudRoutesHandledRef.current = false;

    const handleSyncError = (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('quota exceeded')) {
        setSyncQuotaMessage(
          'Se alcanzó el límite diario gratuito de sincronización en la nube. Tus cambios siguen guardándose en este dispositivo y la cuota se restablece mañana.'
        );
      } else {
        showToast('No se pudo sincronizar en este momento. Verifica tu conexión.');
      }
    };

    const unsubDeliveries = subscribeToSharedDeliveries(
      async cloudItems => {
        const syncedOnceKey = 'ruteo_cloud_synced_once';
        const hadSyncedBefore = localStorage.getItem(syncedOnceKey) === '1';

        if (!initialCloudDeliveriesHandledRef.current) {
          initialCloudDeliveriesHandledRef.current = true;
          if (cloudItems.length === 0) {
            const localRealItems = itemsRef.current.filter(i => !i.id.startsWith('demo-'));
            if (!hadSyncedBefore && localRealItems.length > 0) {
              try {
                setSyncBusy(true);
                const dbPhotos = await loadAllDeliveryPhotosFromDB();
                const itemsWithPhotos = localRealItems.map(item => ({
                  ...item,
                  id: sanitizeDocId(item.id, 'item'),
                  deliveryPhoto: item.deliveryPhoto || dbPhotos[item.id],
                }));
                await createDeliveriesInCloud(itemsWithPhotos, currentDriver);
                localStorage.setItem(syncedOnceKey, '1');
                showToast('Tus paquetes se sincronizaron con los conductores');
              } catch (err) {
                handleSyncError(err);
              } finally {
                setSyncBusy(false);
              }
              return;
            }
            if (hadSyncedBefore) {
              setItems([]);
            } else {
              localStorage.setItem(syncedOnceKey, '1');
            }
            return;
          }
        }

        try {
          localStorage.setItem(syncedOnceKey, '1');
        } catch {
          // ignore storage errors
        }

        // Cache cloud delivery photos locally in IndexedDB so offline mode & WhatsApp modals have them
        const localById = new Map<string, DeliveryItem>();
        itemsRef.current.forEach(item => localById.set(item.id, item));

        const merged = cloudItems.map(cloudItem => {
          if (cloudItem.deliveryPhoto) {
            void saveDeliveryPhotoToDB(cloudItem.id, cloudItem.deliveryPhoto);
            return cloudItem;
          }
          const prevLocal = localById.get(cloudItem.id);
          if (prevLocal?.deliveryPhoto && prevLocal.deliveryPhoto.length > 600000) {
            return { ...cloudItem, deliveryPhoto: prevLocal.deliveryPhoto };
          }
          return cloudItem;
        });

        suppressAutoOptimizeSyncRef.current = true;
        lastAutoOptimizedSigRef.current = buildCircuitSignature(merged, currentGpsRef.current);
        setItems(merged);
      },
      handleSyncError
    );

    const unsubRoutes = subscribeToSharedRoutes(
      cloudRoutes => {
        if (!initialCloudRoutesHandledRef.current) {
          initialCloudRoutesHandledRef.current = true;
          if (cloudRoutes.length === 0 && savedRoutesRef.current.length > 0) {
            savedRoutesRef.current.forEach(route => {
              void saveRouteSessionToCloud(route, currentDriver).catch(handleSyncError);
            });
            return;
          }
        }
        setSavedRoutes(cloudRoutes);
      },
      handleSyncError
    );

    return () => {
      unsubDeliveries();
      unsubRoutes();
    };
  }, [currentDriver?.id]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    if (!lastDeliveryFeedback) return;
    const t = setTimeout(() => setLastDeliveryFeedback(null), 6000);
    return () => clearTimeout(t);
  }, [lastDeliveryFeedback]);

  useEffect(() => {
    if (!milestoneBanner) return;
    const t = setTimeout(() => setMilestoneBanner(null), 6000);
    return () => clearTimeout(t);
  }, [milestoneBanner]);

  // Unlock Web Audio on first user gesture for mobile speaker celebration playback
  useEffect(() => {
    const handleUnlock = () => unlockCelebrationAudio();
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };
  }, []);

  const speakerSettingsRef = React.useRef(appSettings.speaker);
  speakerSettingsRef.current = appSettings.speaker;

  // Detect 25% delivery milestones (25%, 50%, 75%, 100%)
  useEffect(() => {
    const total = items.length;
    const delivered = items.filter(i => i.status === 'delivered').length;
    const percentage = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const currentTier = Math.floor(percentage / 25) * 25;

    if (!milestoneInitRef.current) {
      milestoneInitRef.current = true;
      prevDeliveredCountRef.current = delivered;
      highestCelebratedTierRef.current = currentTier;
      return;
    }

    if (total === 0) {
      prevDeliveredCountRef.current = 0;
      highestCelebratedTierRef.current = 0;
      setMilestoneBanner(null);
      return;
    }

    if (delivered > prevDeliveredCountRef.current) {
      if (currentTier >= 25 && currentTier > highestCelebratedTierRef.current) {
        const tier = currentTier as MilestoneTier;
        const copy = getMilestoneCelebrationCopy(tier, delivered + total);
        highestCelebratedTierRef.current = currentTier;
        setConfettiMilestone(tier);
        setConfettiBurstKey(prev => prev + 1);
        setMilestoneBanner({
          ...copy,
          deliveredCount: delivered,
          totalCount: total,
        });

        const spk = speakerSettingsRef.current;
        if (spk.celebrateMilestonesSound) {
          playMilestoneCelebrationAudio(tier, buildMilestoneSpeechText(tier, copy.message), {
            rate: spk.rate,
            pitch: spk.pitch,
          });
        }
      }
    } else if (currentTier < highestCelebratedTierRef.current) {
      highestCelebratedTierRef.current = currentTier;
    }

    prevDeliveredCountRef.current = delivered;
  }, [items]);

  const circuitSignature = React.useMemo(
    () => buildCircuitSignature(items, currentGps),
    [items, currentGps]
  );

  // Automatically arrange active located stops into an efficient non-backtracking out-and-back circuit
  useEffect(() => {
    if (!circuitSignature || circuitSignature.endsWith('__')) return;
    if (manualOverrideSigRef.current === circuitSignature) return;
    if (lastAutoOptimizedSigRef.current === circuitSignature) return;

    lastAutoOptimizedSigRef.current = circuitSignature;
    const shouldSyncCloudOrder =
      pendingLocalOrderSyncRef.current || !suppressAutoOptimizeSyncRef.current;
    pendingLocalOrderSyncRef.current = false;
    suppressAutoOptimizeSyncRef.current = false;

    const latestItems = itemsRef.current;
    const latestGps = currentGpsRef.current;
    const activeCount = latestItems.filter(isActiveRoutableItem).length;
    if (activeCount === 0) return;

    const applyIfOrderDiffers = (candidate: DeliveryItem[]) => {
      const currentList = itemsRef.current;
      if (buildCircuitSignature(currentList, currentGpsRef.current) !== circuitSignature) {
        return;
      }
      const prevOrder = currentList
        .filter(isActiveRoutableItem)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(i => `${i.id}:${i.orderIndex}`)
        .join(',');
      const nextOrder = candidate
        .filter(isActiveRoutableItem)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(i => `${i.id}:${i.orderIndex}`)
        .join(',');
      if (prevOrder === nextOrder) return;

      const prevById: Record<string, DeliveryItem> = {};
      currentList.forEach(p => {
        prevById[p.id] = p;
      });
      const nextList = candidate.map(c => ({
        ...(prevById[c.id] || c),
        orderIndex: c.orderIndex,
        distanceFromPrevKm: c.distanceFromPrevKm,
        estimatedMinutes: c.estimatedMinutes,
      }));

      setItems(nextList);

      if (shouldSyncCloudOrder && currentDriverRef.current) {
        const activeDriver = currentDriverRef.current;
        const payload = nextList.filter(i => !i.id.startsWith('demo-'));
        if (payload.length > 0) {
          void syncOptimizedOrderInCloud(payload, activeDriver).catch(() => {});
        }
      }
    };

    const quickResult = optimizeRoute(latestItems, latestGps);
    applyIfOrderDiffers(quickResult.optimizedItems);

    if (activeCount < 2) return;

    const controller = new AbortController();
    optimizeCircuitByRoad(latestItems, latestGps, controller.signal).then(roadResult => {
      if (controller.signal.aborted) return;
      if (manualOverrideSigRef.current === circuitSignature) return;
      if (roadResult.usedRoadNetwork) {
        applyIfOrderDiffers(roadResult.optimizedItems);
      }
    });

    return () => {
      controller.abort();
    };
  }, [circuitSignature]);

  useEffect(() => {
    try {
      localStorage.setItem('ruteo_map_provider', mapProvider);
    } catch {
      // ignore storage errors
    }
  }, [mapProvider]);

  useEffect(() => {
    try {
      localStorage.setItem('ruteo_speaker_enabled', String(speakerEnabled));
    } catch {
      // ignore storage errors
    }
  }, [speakerEnabled]);

  const handleSaveAppSettings = (next: AppSettings) => {
    if (next.general.defaultShowMap !== appSettings.general.defaultShowMap) {
      setShowMap(next.general.defaultShowMap);
    }
    setAppSettings(next);
    saveAppSettings(next);
  };

  useEffect(() => {
    const isDark = appSettings.general.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0f172a' : '#059669');
    }
  }, [appSettings.general.theme]);

  const handleToggleTheme = () => {
    const nextTheme = appSettings.general.theme === 'dark' ? 'light' : 'dark';
    handleSaveAppSettings({
      ...appSettings,
      general: {
        ...appSettings.general,
        theme: nextTheme,
      },
    });
  };

  const handleToggleSpeaker = () => {
    if (!isSpeechSupported()) {
      showToast('Tu navegador o dispositivo no admite lectura por voz (altavoz).');
      return;
    }
    setSpeakerEnabled(prev => {
      const next = !prev;
      if (next) {
        speakText('Altavoz activado');
      } else {
        stopSpeaking();
      }
      return next;
    });
  };

  useEffect(() => {
    const handleQuotaFallback = () => {
      setMapProvider('free');
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaFallback);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaFallback);
    };
  }, []);

  // Prevent zoom on app UI while preserving zoom inside the map container
  useEffect(() => {
    const isInsideMap = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('[data-allow-map-zoom="true"]'));

    const handleGesture = (e: Event) => {
      if (!isInsideMap(e.target)) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 && !isInsideMap(e.target)) {
        e.preventDefault();
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && !isInsideMap(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener('gesturestart', handleGesture, { passive: false });
    document.addEventListener('gesturechange', handleGesture, { passive: false });
    document.addEventListener('gestureend', handleGesture, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
      document.removeEventListener('gestureend', handleGesture);
      document.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Modals state
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState<boolean>(false);
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [isLiveNavOpen, setIsLiveNavOpen] = useState<boolean>(false);
  const [liveNavFocusId, setLiveNavFocusId] = useState<string | null>(null);
  const hasAutoOpenedDefaultGpsRef = React.useRef<boolean>(false);
  const [isSavedRoutesOpen, setIsSavedRoutesOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isRequestLocationsOpen, setIsRequestLocationsOpen] = useState<boolean>(false);
  const [isSendPhotosOpen, setIsSendPhotosOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null);
  const [photoModalItemId, setPhotoModalItemId] = useState<string | null>(null);
  const photoModalItem = items.find(i => i.id === photoModalItemId) || null;

  useEffect(() => {
    if (hasAutoOpenedDefaultGpsRef.current) return;
    if (!currentDriver) return;
    hasAutoOpenedDefaultGpsRef.current = true;
    if (appSettings.general.defaultMapMode === 'gps') {
      setIsLiveNavOpen(true);
    }
  }, [currentDriver, appSettings.general.defaultMapMode]);

  const handleStartInAppNavigation = (focusItem?: DeliveryItem) => {
    setLiveNavFocusId(focusItem?.id || null);
    setIsLiveNavOpen(true);
  };

  // Sync items metadata to localStorage cleanly (photos are stored in IndexedDB so localStorage never overflows)
  useEffect(() => {
    try {
      const compact = items.map(({ deliveryPhoto: _photo, ...rest }) => rest);
      localStorage.setItem('ruteo_current_items', JSON.stringify(compact));
    } catch {
      // ignore if storage is completely full
    }
  }, [items]);

  useEffect(() => {
    try {
      localStorage.setItem('ruteo_saved_routes', JSON.stringify(savedRoutes));
    } catch {
      // ignore storage errors
    }
  }, [savedRoutes]);

  useEffect(() => {
    try {
      localStorage.setItem('ruteo_api_key', apiKey);
    } catch {
      // ignore storage errors
    }
  }, [apiKey]);

  // Geolocation tracking
  useEffect(() => {
    if (!navigator.geolocation) return;

    const handleSuccess = (position: GeolocationPosition) => {
      setCurrentGps({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
        timestamp: position.timestamp
      });
      setGpsActive(true);
    };

    const handleError = (error: GeolocationPositionError) => {
      console.warn('Geolocation warning:', error.message);
      setGpsActive(false);
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const handleToggleGps = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setCurrentGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading ?? undefined,
            speed: pos.coords.speed ?? undefined,
            timestamp: pos.timestamp
          });
          setGpsActive(true);
        },
        () => {
          showToast('No se pudo obtener la ubicación GPS. Verifica los permisos del navegador.');
          setGpsActive(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      showToast('La geolocalización no está soportada en tu navegador.');
    }
  };

  const persistLocalDriver = (driver: DriverProfile | null) => {
    try {
      if (driver) {
        localStorage.setItem(DRIVER_STORAGE_KEY, JSON.stringify(driver));
      } else {
        localStorage.removeItem(DRIVER_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  };

  const handleRegisterDriver = async (name: string) => {
    setSyncBusy(true);
    try {
      const driver = await registerOrSelectDriverInCloud(name, activeDriversRef.current);
      persistLocalDriver(driver);
      setRemovedDriverNotice(null);
      setCurrentDriver(driver);
      showToast(`Conectado como conductor: ${driver.driverName}`);
    } catch {
      showToast('No se pudo registrar el conductor. Verifica tu conexión.');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSelectExistingDriver = (driver: DriverProfile) => {
    persistLocalDriver(driver);
    setRemovedDriverNotice(null);
    setCurrentDriver(driver);
    showToast(`Conductor activo: ${driver.driverName}`);
  };

  const handleDeleteDriver = async (driver: DriverProfile) => {
    setSyncBusy(true);
    try {
      await deleteDriverFromCloud(driver.id);
      if (currentDriverRef.current?.id === driver.id) {
        persistLocalDriver(null);
        resetFirestoreSyncCache();
        setCurrentDriver(null);
        setIsDriversModalOpen(false);
        setRemovedDriverNotice('Tu perfil fue eliminado. Ingresa un nombre para volver a conectarte.');
      } else {
        showToast(`Conductor "${driver.driverName}" eliminado`);
      }
    } catch {
      showToast('No se pudo eliminar el conductor en este momento.');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleAddItems = (newItems: DeliveryItem[]) => {
    const sanitized = newItems.map(item => ({
      ...item,
      id: sanitizeDocId(item.id, 'item'),
    }));
    pendingLocalOrderSyncRef.current = true;
    suppressAutoOptimizeSyncRef.current = false;
    setItems(prev => [...prev, ...sanitized]);
    const driver = currentDriverRef.current;
    if (driver && sanitized.length > 0) {
      void createDeliveriesInCloud(sanitized, driver).catch(() => {
        showToast('No se pudieron subir los paquetes nuevos a la nube.');
      });
    }
  };

  const handleUpdateStatus = (id: string, status: DeliveryItem['status']) => {
    const target = items.find(i => i.id === id);
    if (!target) return;

    if (status === 'delivered' && target.status !== 'delivered') {
      setPendingDeliveryConfirmItem(target);
      return;
    }

    if (status === 'failed') {
      setPendingFailedItem(target);
      return;
    }

    setItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              status,
              failureReason: undefined,
            }
          : item
      )
    );
    const driver = currentDriverRef.current;
    if (driver) {
      void updateDeliveryStatusInCloud(target, status, undefined, driver).catch(() => {
        showToast('Error al sincronizar el estado en la nube.');
      });
    }
  };

  const handleConfirmDelivery = (confirmedItem: DeliveryItem) => {
    const prevStatus = confirmedItem.status;
    setItems(prev =>
      prev.map(item =>
        item.id === confirmedItem.id
          ? {
              ...item,
              status: 'delivered',
              failureReason: undefined,
            }
          : item
      )
    );
    setPendingDeliveryConfirmItem(null);
    setLastDeliveryFeedback({
      id: confirmedItem.id,
      originalNumber: confirmedItem.originalNumber,
      recipientName: confirmedItem.recipientName,
      prevStatus
    });
    const driver = currentDriverRef.current;
    if (driver) {
      void updateDeliveryStatusInCloud(confirmedItem, 'delivered', undefined, driver).catch(() => {
        showToast('Error al sincronizar la entrega en la nube.');
      });
    }
  };

  const handleConfirmFailed = (failedItem: DeliveryItem, reason: string) => {
    const cleanReason = reason || undefined;
    setItems(prev =>
      prev.map(item =>
        item.id === failedItem.id
          ? {
              ...item,
              status: 'failed',
              failureReason: cleanReason,
            }
          : item
      )
    );
    setPendingFailedItem(null);
    showToast(`Paquete #${failedItem.originalNumber} marcado como no entregado`);
    const driver = currentDriverRef.current;
    if (driver) {
      void updateDeliveryStatusInCloud(failedItem, 'failed', cleanReason, driver).catch(() => {
        showToast('Error al sincronizar el estado en la nube.');
      });
    }
  };

  const handleUndoDelivery = () => {
    if (!lastDeliveryFeedback) return;
    const { id, prevStatus } = lastDeliveryFeedback;
    const target = itemsRef.current.find(item => item.id === id);
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, status: prevStatus } : item))
    );
    setLastDeliveryFeedback(null);
    showToast('Entrega deshecha');
    const driver = currentDriverRef.current;
    if (driver && target) {
      void updateDeliveryStatusInCloud(target, prevStatus, target.failureReason, driver).catch(() => {
        showToast('Error al deshacer entrega en la nube.');
      });
    }
  };

  const handleSaveEditItem = (updated: DeliveryItem) => {
    pendingLocalOrderSyncRef.current = true;
    suppressAutoOptimizeSyncRef.current = false;
    setItems(prev =>
      prev.map(item => (item.id === updated.id ? updated : item))
    );
    const driver = currentDriverRef.current;
    if (driver) {
      void updateDeliveryDetailsInCloud(updated, driver).catch(() => {
        showToast('Error al guardar cambios en la nube.');
      });
    }
  };

  const handleSaveDeliveryPhoto = (id: string, photoDataUrl: string | undefined, markDelivered?: boolean) => {
    const target = items.find(i => i.id === id);
    const prevStatus = target?.status;
    const photoAt = photoDataUrl ? new Date().toISOString() : undefined;
    if (photoDataUrl) {
      void saveDeliveryPhotoToDB(id, photoDataUrl);
    } else {
      void deleteDeliveryPhotoFromDB(id);
    }
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          deliveryPhoto: photoDataUrl,
          deliveryPhotoAt: photoAt,
          status: markDelivered ? 'delivered' : item.status,
          failureReason: markDelivered ? undefined : item.failureReason,
        };
      })
    );
    if (markDelivered && target && prevStatus && prevStatus !== 'delivered') {
      setLastDeliveryFeedback({
        id: target.id,
        originalNumber: target.originalNumber,
        recipientName: target.recipientName,
        prevStatus
      });
    }
    const driver = currentDriverRef.current;
    if (driver && target) {
      void updateDeliveryPhotoInCloud(
        target,
        photoDataUrl,
        photoAt,
        Boolean(markDelivered),
        driver
      )
        .then(res => {
          if (res.skippedPhotoTooLarge) {
            showToast('La foto se guardó en este dispositivo, pero supera el límite de tamaño para sincronizarse.');
          }
        })
        .catch(() => {
          showToast('Error al sincronizar la foto en la nube.');
        });
    }
  };

  const handleDeleteItem = (id: string) => {
    void deleteDeliveryPhotoFromDB(id);
    pendingLocalOrderSyncRef.current = true;
    suppressAutoOptimizeSyncRef.current = false;
    setItems(prev => prev.filter(item => item.id !== id));
    if (currentDriverRef.current) {
      void deleteDeliveryItemFromCloud(id).catch(() => {
        showToast('Error al eliminar el paquete en la nube.');
      });
    }
  };

  const handleClearAllItems = () => {
    if (confirm('¿Estás seguro de eliminar todos los paquetes actuales?')) {
      const currentIds = itemsRef.current.map(i => i.id);
      void clearAllDeliveryPhotosFromDB();
      setItems([]);
      if (currentDriverRef.current && currentIds.length > 0) {
        void deleteDeliveriesFromCloud(currentIds).catch(() => {
          showToast('Error al vaciar los paquetes en la nube.');
        });
      }
    }
  };

  const handleApplyOptimizedItems = (
    optimized: DeliveryItem[],
    _totalDist?: number,
    _totalMins?: number,
    mode?: 'auto' | 'manual'
  ) => {
    const sig = buildCircuitSignature(optimized, currentGps);
    if (mode === 'manual') {
      manualOverrideSigRef.current = sig;
    } else {
      manualOverrideSigRef.current = null;
      lastAutoOptimizedSigRef.current = sig;
    }
    suppressAutoOptimizeSyncRef.current = false;
    setItems(optimized);
    const driver = currentDriverRef.current;
    if (driver && optimized.length > 0) {
      void syncOptimizedOrderInCloud(optimized, driver).catch(() => {
        showToast('Error al sincronizar el orden optimizado en la nube.');
      });
    }
  };

  const handleSaveCurrentRoute = () => {
    if (items.length === 0) return;
    const stats = optimizeRoute(items, currentGps);
    const snapshotItems = items.map(({ deliveryPhoto: _photo, ...rest }) => rest);
    const newSession: RouteSession = {
      id: `session-${Date.now()}`,
      name: `Recorrido CR ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
      date: new Date().toISOString(),
      items: snapshotItems,
      status: 'saved',
      totalDistanceKm: stats.totalDistanceKm,
      totalMinutes: stats.totalMinutes,
      createdAt: Date.now()
    };
    setSavedRoutes(prev => [newSession, ...prev]);
    showToast('¡Recorrido guardado exitosamente en el historial!');
    const driver = currentDriverRef.current;
    if (driver) {
      void saveRouteSessionToCloud(newSession, driver).catch(() => {
        showToast('Error al guardar el recorrido en la nube.');
      });
    }
  };

  const handleLoadRoute = (route: RouteSession) => {
    const prevIds = itemsRef.current.map(i => i.id);
    const nextItems = route.items.map(item => ({
      ...item,
      id: sanitizeDocId(item.id, 'item'),
    }));
    milestoneInitRef.current = false;
    setMilestoneBanner(null);
    pendingLocalOrderSyncRef.current = true;
    suppressAutoOptimizeSyncRef.current = false;
    setItems(nextItems);
    const driver = currentDriverRef.current;
    if (driver) {
      void replaceActiveDeliveriesInCloud(prevIds, nextItems, driver).catch(() => {
        showToast('Error al cargar el recorrido en la nube.');
      });
    }
  };

  const handleDeleteRoute = (id: string) => {
    setSavedRoutes(prev => prev.filter(r => r.id !== id));
    if (currentDriverRef.current) {
      void deleteRouteSessionFromCloud(id).catch(() => {
        showToast('Error al eliminar el recorrido en la nube.');
      });
    }
  };

  const handleResetData = () => {
    const prevItemIds = itemsRef.current.map(i => i.id);
    const prevRouteIds = savedRoutesRef.current.map(r => r.id);
    void clearAllDeliveryPhotosFromDB();
    setItems([]);
    setSavedRoutes([]);
    localStorage.removeItem('ruteo_current_items');
    localStorage.removeItem('ruteo_saved_routes');
    if (currentDriverRef.current) {
      void deleteDeliveriesFromCloud(prevItemIds).catch(() => {});
      void deleteAllRoutesFromCloud(prevRouteIds).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col font-sans text-gray-900 dark:text-slate-100 selection:bg-emerald-500 selection:text-white relative overflow-x-hidden transition-colors">
      {/* GMP Quota Banner */}
      <QuotaBanner
        mapProvider={mapProvider}
        onSwitchToFreeMap={() => setMapProvider('free')}
      />

      {/* Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSavedRoutes={() => setIsSavedRoutesOpen(true)}
        gpsActive={gpsActive}
        onToggleGps={handleToggleGps}
        speakerEnabled={speakerEnabled}
        onToggleSpeaker={handleToggleSpeaker}
        theme={appSettings.general.theme}
        onToggleTheme={handleToggleTheme}
        appSettings={appSettings}
        currentDriver={currentDriver}
        activeDriversCount={activeDrivers.length}
        syncBusy={syncBusy}
        onOpenDriversModal={() => setIsDriversModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-5 flex-1 w-full space-y-2.5 sm:space-y-5">
        {/* Firestore daily quota notice if exceeded */}
        {syncQuotaMessage && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>{syncQuotaMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncQuotaMessage(null)}
              aria-label="Cerrar aviso"
              className="p-1 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Compact Motivational Delivery Progress Bar at Top */}
        <MotivationalProgressBar items={items} />

        {/* Interactive Map Section with Edge Collapse Tab */}
        <div className={`relative ${showMap ? 'mb-2.5 sm:mb-3' : 'mb-1'}`}>
          {showMap ? (
            <div
              data-allow-map-zoom="true"
              className="w-full h-[235px] sm:h-[340px] md:h-[440px] shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden transition-all border border-gray-200 dark:border-slate-800 relative isolate z-0"
            >
              {/* Map Provider Switcher (Google Maps vs 100% Free OpenStreetMap) */}
              <div className="absolute top-3 right-14 z-[460] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-gray-200 dark:border-slate-700 rounded-xl p-1 shadow-md flex items-center gap-1 text-[11px] font-bold">
                <button
                  onClick={() => setMapProvider('free')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    mapProvider === 'free'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title="Mapa 100% gratuito sin límites ni facturación (OpenStreetMap)"
                >
                  Mapa Gratis
                </button>
                <button
                  onClick={() => setMapProvider('google')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    mapProvider === 'google'
                      ? 'bg-gray-900 dark:bg-slate-700 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                  title="Usar Google Maps (cuota gratuita diaria)"
                >
                  Google Maps
                </button>
              </div>

              {mapProvider === 'free' ? (
                <FreeMapView
                  items={items}
                  currentGps={currentGps}
                  selectedPackageId={selectedPackageId}
                  onClearSelectedPackage={() => setSelectedPackageId(null)}
                  speakerEnabled={speakerEnabled}
                  autoReadOnMapPin={appSettings.speaker.autoReadOnMapPin}
                  onUpdateStatus={handleUpdateStatus}
                  onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
                  onStartInAppNavigation={handleStartInAppNavigation}
                />
              ) : (
                <MapView
                  items={items}
                  currentGps={currentGps}
                  selectedPackageId={selectedPackageId}
                  onClearSelectedPackage={() => setSelectedPackageId(null)}
                  speakerEnabled={speakerEnabled}
                  autoReadOnMapPin={appSettings.speaker.autoReadOnMapPin}
                  onUpdateStatus={handleUpdateStatus}
                  onStartNavigation={item => {
                    const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
                    const a = document.createElement('a');
                    a.href = url;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    a.click();
                  }}
                  onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
                  onStartInAppNavigation={handleStartInAppNavigation}
                  apiKey={apiKey}
                  theme={appSettings.general.theme}
                />
              )}
            </div>
          ) : (
            <div className="w-full border-t border-dashed border-gray-300 dark:border-slate-700/80" />
          )}

          {appSettings.visibleButtons.toggleMap && (
            <button
              type="button"
              onClick={() => setShowMap(prev => !prev)}
              aria-expanded={showMap}
              title={showMap ? 'Colapsar mapa' : 'Mostrar mapa'}
              className={`${
                showMap
                  ? 'absolute left-1/2 -translate-x-1/2 -bottom-3.5 z-20 rounded-b-xl rounded-t-md border-t-0'
                  : 'mx-auto rounded-b-xl rounded-t-none border-t-0'
              } bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-md px-3.5 py-1 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors`}
            >
              <MapPin className={`w-3 h-3 ${BUTTON_COLOR_STYLES[appSettings.buttonColors.accent].badgeText}`} />
              <span>{showMap ? 'Ocultar mapa' : 'Mostrar mapa'}</span>
              {showMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Dashboard Content */}
        <MainDashboard
          items={items}
          currentGps={currentGps}
          speakerEnabled={speakerEnabled}
          appSettings={appSettings}
          onOpenInputModal={() => setIsInputOpen(true)}
          onOpenOptimizerModal={() => setIsOptimizerOpen(true)}
          onOpenNavigationModal={() => handleStartInAppNavigation()}
          onOpenSavedRoutesModal={() => setIsSavedRoutesOpen(true)}
          onOpenRequestLocationsModal={() => setIsRequestLocationsOpen(true)}
          onOpenSendPhotosModal={() => setIsSendPhotosOpen(true)}
          onUpdateStatus={handleUpdateStatus}
          onEditItem={item => setEditingItem(item)}
          onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
          onSelectPackage={id => {
            setSelectedPackageId(null);
            setTimeout(() => setSelectedPackageId(id), 10);
          }}
          onDeleteItem={handleDeleteItem}
          onClearAllItems={handleClearAllItems}
        />
      </main>

      {/* Floating Action Button (FAB) - Agregar Paquete fixed in bottom right */}
      {appSettings.visibleButtons.fabAdd && (
        <button
          onClick={() => setIsInputOpen(true)}
          className={`fixed bottom-6 right-6 z-40 ${BUTTON_COLOR_STYLES[appSettings.buttonColors.accent].solid} p-4 rounded-full shadow-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all transform hover:scale-105 active:scale-95 group border-2 border-white dark:border-slate-800`}
          title="Agregar Paquete"
        >
          <Plus className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-300" />
          <span className="hidden sm:inline pr-2">Agregar Paquete</span>
        </button>
      )}

      {/* Modals */}
      <LocationInputModal
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        onAddItems={handleAddItems}
        existingItems={items}
        packageFields={appSettings.packageFields}
        accentColor={appSettings.buttonColors.accent}
      />

      <RouteOptimizationModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        items={items}
        currentGps={currentGps}
        onApplyOptimizedItems={handleApplyOptimizedItems}
      />

      <ActiveNavigationModal
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        items={items}
        onUpdateStatus={handleUpdateStatus}
        onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
        onFinishRoute={handleSaveCurrentRoute}
        onOpenSendPhotosModal={() => setIsSendPhotosOpen(true)}
        speakerEnabled={speakerEnabled}
        speakerSettings={appSettings.speaker}
        onToggleSpeaker={handleToggleSpeaker}
      />

      <LiveNavigationView
        isOpen={isLiveNavOpen}
        onClose={() => {
          setIsLiveNavOpen(false);
          setLiveNavFocusId(null);
        }}
        items={items}
        currentGps={currentGps}
        focusPackageId={liveNavFocusId}
        speakerEnabled={speakerEnabled}
        speakerSettings={appSettings.speaker}
        gpsSettings={appSettings.gpsNavigator}
        theme={appSettings.general.theme}
        onToggleSpeaker={handleToggleSpeaker}
        onToggleGps={handleToggleGps}
        onUpdateStatus={handleUpdateStatus}
        onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
        onFinishRoute={handleSaveCurrentRoute}
      />

      <SavedRoutesModal
        isOpen={isSavedRoutesOpen}
        onClose={() => setIsSavedRoutesOpen(false)}
        savedRoutes={savedRoutes}
        onLoadRoute={handleLoadRoute}
        onDeleteRoute={handleDeleteRoute}
        onSaveCurrentRoute={handleSaveCurrentRoute}
        hasCurrentItems={items.length > 0}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={appSettings}
        onSaveSettings={handleSaveAppSettings}
        speakerEnabled={speakerEnabled}
        onSetSpeakerEnabled={(enabled) => {
          if (enabled && !isSpeechSupported()) {
            showToast('Tu navegador o dispositivo no admite lectura por voz (altavoz).');
            return;
          }
          setSpeakerEnabled(enabled);
          if (!enabled) stopSpeaking();
        }}
        mapProvider={mapProvider}
        onSetMapProvider={setMapProvider}
        apiKey={apiKey}
        onSaveApiKey={setApiKey}
        onResetData={handleResetData}
        onOpenDriversModal={() => setIsDriversModalOpen(true)}
      />

      <DriverOnboardingModal
        isOpen={!currentDriver}
        activeDrivers={activeDrivers}
        busy={syncBusy}
        removedNotice={removedDriverNotice}
        onRegisterDriver={handleRegisterDriver}
        onSelectExistingDriver={handleSelectExistingDriver}
      />

      <DriverManagerModal
        isOpen={isDriversModalOpen}
        onClose={() => setIsDriversModalOpen(false)}
        currentDriver={currentDriver}
        activeDrivers={activeDrivers}
        busy={syncBusy}
        onSwitchOrAddDriver={handleRegisterDriver}
        onSelectDriver={handleSelectExistingDriver}
        onDeleteDriver={handleDeleteDriver}
      />

      <EditPackageModal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        item={editingItem}
        onSaveEdit={handleSaveEditItem}
      />

      <DeliveryPhotoModal
        isOpen={!!photoModalItem}
        onClose={() => setPhotoModalItemId(null)}
        item={photoModalItem}
        onSavePhoto={handleSaveDeliveryPhoto}
      />

      <DeliveryConfirmModal
        isOpen={!!pendingDeliveryConfirmItem}
        item={pendingDeliveryConfirmItem}
        onCancel={() => setPendingDeliveryConfirmItem(null)}
        onConfirmDelivery={handleConfirmDelivery}
        onOpenPhotoFirst={item => {
          setPendingDeliveryConfirmItem(null);
          setPhotoModalItemId(item.id);
        }}
      />

      <DeliveryFailedModal
        isOpen={!!pendingFailedItem}
        item={pendingFailedItem}
        onCancel={() => setPendingFailedItem(null)}
        onConfirmFailed={handleConfirmFailed}
      />

      <RequestAllLocationsModal
        isOpen={isRequestLocationsOpen}
        onClose={() => setIsRequestLocationsOpen(false)}
        items={items}
        onEditItem={item => setEditingItem(item)}
      />

      <SendAllPhotosModal
        isOpen={isSendPhotosOpen}
        onClose={() => setIsSendPhotosOpen(false)}
        items={items}
      />

      {lastDeliveryFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1400] bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-2xl border-2 border-white/90 flex items-center gap-3 max-w-[92vw] sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-black leading-tight truncate">
              ¡Paquete #{lastDeliveryFeedback.originalNumber} entregado!
            </p>
            {lastDeliveryFeedback.recipientName && (
              <p className="text-[11px] text-emerald-100 font-semibold truncate">
                {lastDeliveryFeedback.recipientName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleUndoDelivery}
            className="bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shrink-0 shadow-xs transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Deshacer</span>
          </button>
        </div>
      )}

      {milestoneBanner && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-[1500] w-[92vw] max-w-md rounded-2xl px-4 py-3 shadow-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 ${
            milestoneBanner.tier === 100
              ? 'bg-slate-900 dark:bg-slate-800 text-white border-amber-400/80'
              : 'bg-slate-900 dark:bg-slate-800 text-white border-emerald-400/70'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              milestoneBanner.tier === 100
                ? 'bg-amber-400 text-amber-950'
                : 'bg-emerald-500 text-white'
            }`}
          >
            <Award className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm font-black tracking-tight truncate">
                {milestoneBanner.title}
              </p>
              <span className="text-[11px] font-bold text-slate-300 tabular-nums shrink-0">
                {milestoneBanner.deliveredCount}/{milestoneBanner.totalCount}
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-snug mt-0.5">
              {milestoneBanner.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMilestoneBanner(null)}
            aria-label="Cerrar mensaje motivacional"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1400] bg-gray-900 text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold border border-gray-700 max-w-sm text-center animate-in fade-in duration-200">
          {toastMsg}
        </div>
      )}

      <ConfettiBurst triggerKey={confettiBurstKey} milestone={confettiMilestone} />
      <OfflineIndicator />
    </div>
  );
}

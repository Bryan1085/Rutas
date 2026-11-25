import React, { useState, useEffect, useMemo } from 'react';
import { DeliveryItem, RouteSession, GpsPosition } from './types';
import { QuotaBanner } from './components/QuotaBanner';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { MapView } from './components/MapView';
import { FreeMapView } from './components/FreeMapView';
import { LocationInputModal } from './components/LocationInputModal';
import { RouteOptimizationModal } from './components/RouteOptimizationModal';
import { ActiveNavigationModal } from './components/ActiveNavigationModal';
import { SavedRoutesModal } from './components/SavedRoutesModal';
import { SettingsModal } from './components/SettingsModal';
import { EditPackageModal } from './components/EditPackageModal';
import { DeliveryPhotoModal } from './components/DeliveryPhotoModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Plus } from 'lucide-react';
import { useFirebaseSync } from './hooks/useFirebaseSync';

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
        status: 'pending',
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
        status: 'pending',
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
        status: 'pending',
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

  const [currentGps, setCurrentGps] = useState<GpsPosition | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [mapProvider, setMapProvider] = useState<'google' | 'free'>(() => {
    const saved = localStorage.getItem('ruteo_map_provider');
    if (saved === 'free' || saved === 'google') return saved;
    return 'google';
  });

  useEffect(() => {
    localStorage.setItem('ruteo_map_provider', mapProvider);
  }, [mapProvider]);

  useEffect(() => {
    const handleQuotaFallback = () => {
      setMapProvider('free');
    };
    window.addEventListener('gmp-quota-exceeded', handleQuotaFallback);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaFallback);
    };
  }, []);

  // Firebase Realtime Sync Hook
  const { user, signIn, signOut, remoteDrivers, syncItemToFirestore, deleteItemFromFirestore } = useFirebaseSync(
    items,
    setItems,
    currentGps
  );

  // Ownership helper: when signed in, only packages assigned to user.uid are editable
  const canEditItem = (item: DeliveryItem) =>
    user ? item.assignedDriverId === user.uid : !item.assignedDriverId;

  // Combined list of other drivers (active GPS drivers + owners of synced packages)
  const routeDrivers = useMemo(() => {
    const map = new Map<string, { id: string; driverName: string }>();
    remoteDrivers.forEach(d => {
      map.set(d.id, { id: d.id, driverName: d.driverName });
    });
    items.forEach(item => {
      if (item.assignedDriverId && item.assignedDriverId !== user?.uid) {
        if (!map.has(item.assignedDriverId)) {
          map.set(item.assignedDriverId, {
            id: item.assignedDriverId,
            driverName: item.assignedDriverName || 'Otro conductor'
          });
        }
      }
    });
    return Array.from(map.values());
  }, [remoteDrivers, items, user?.uid]);

  // Filtered items based on selected driver route
  const displayedItems = selectedDriverId
    ? items.filter(i => i.assignedDriverId === selectedDriverId)
    : items;

  const editableDisplayedItems = displayedItems.filter(canEditItem);

  // Modals state
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState<boolean>(false);
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [isSavedRoutesOpen, setIsSavedRoutesOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null);
  const [photoModalItemId, setPhotoModalItemId] = useState<string | null>(null);
  const photoModalItem = items.find(i => i.id === photoModalItemId) || null;

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('ruteo_current_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('ruteo_saved_routes', JSON.stringify(savedRoutes));
  }, [savedRoutes]);

  useEffect(() => {
    localStorage.setItem('ruteo_api_key', apiKey);
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
      maximumAge: 10000,
      timeout: 15000
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
            timestamp: pos.timestamp
          });
          setGpsActive(true);
        },
        err => {
          alert('No se pudo obtener la ubicación GPS. Verifica los permisos del navegador.');
          setGpsActive(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('La geolocalización no está soportada en tu navegador.');
    }
  };

  const handleAddItems = (newItems: DeliveryItem[]) => {
    const ownerName = user?.displayName || user?.email?.split('@')[0] || undefined;
    const assignedNewItems = newItems.map(item => ({
      ...item,
      assignedDriverId: user?.uid || undefined,
      assignedDriverName: ownerName
    }));

    setItems(prev => {
      const combined = [...prev, ...assignedNewItems];
      assignedNewItems.forEach(item => syncItemToFirestore(item));
      return combined;
    });

    if (selectedDriverId && selectedDriverId !== user?.uid) {
      setSelectedDriverId(null);
    }
  };

  const handleUpdateStatus = (id: string, status: DeliveryItem['status']) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (!canEditItem(item)) return item;
        const newItem = { ...item, status };
        syncItemToFirestore(newItem);
        return newItem;
      })
    );
  };

  const handleSaveEditItem = (updated: DeliveryItem) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== updated.id) return item;
        if (!canEditItem(item)) return item;
        const nextItem: DeliveryItem = {
          ...updated,
          assignedDriverId: item.assignedDriverId,
          assignedDriverName: item.assignedDriverName
        };
        syncItemToFirestore(nextItem);
        return nextItem;
      })
    );
  };

  const handleSaveDeliveryPhoto = (id: string, photoDataUrl: string | undefined, markDelivered?: boolean) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        if (!canEditItem(item)) return item;
        const updated: DeliveryItem = {
          ...item,
          deliveryPhoto: photoDataUrl,
          deliveryPhotoAt: photoDataUrl ? new Date().toISOString() : undefined,
          status: markDelivered ? 'delivered' : item.status
        };
        syncItemToFirestore(updated);
        return updated;
      })
    );
  };

  const handleDeleteItem = (id: string) => {
    const target = items.find(item => item.id === id);
    if (!target || !canEditItem(target)) return;
    setItems(prev => prev.filter(item => item.id !== id));
    deleteItemFromFirestore(id, target.assignedDriverId);
  };

  const handleClearAllItems = () => {
    if (confirm('¿Estás seguro de eliminar tus paquetes actuales?')) {
      items.filter(canEditItem).forEach(i => deleteItemFromFirestore(i.id, i.assignedDriverId));
      setItems(prev => prev.filter(i => !canEditItem(i)));
    }
  };

  const handleApplyOptimizedItems = (optimized: DeliveryItem[]) => {
    const safeOptimized = optimized.filter(canEditItem);
    const optimizedMap = new Map(safeOptimized.map(item => [item.id, item]));
    setItems(prev => {
      const others = prev.filter(item => !optimizedMap.has(item.id) && !canEditItem(item));
      return [...safeOptimized, ...others];
    });
    safeOptimized.forEach(item => syncItemToFirestore(item));
  };

  const handleSaveCurrentRoute = () => {
    const ownItems = items.filter(canEditItem);
    if (ownItems.length === 0) return;
    const newSession: RouteSession = {
      id: `session-${Date.now()}`,
      name: `Recorrido CR ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
      date: new Date().toISOString(),
      items: [...ownItems],
      status: 'saved',
      totalDistanceKm: 18.5,
      totalMinutes: 65,
      createdAt: Date.now()
    };
    setSavedRoutes(prev => [newSession, ...prev]);
    alert('¡Recorrido guardado exitosamente en el historial!');
  };

  const handleLoadRoute = (route: RouteSession) => {
    const ownerName = user?.displayName || user?.email?.split('@')[0] || undefined;
    const assignedLoaded = route.items.map(item => ({
      ...item,
      assignedDriverId: user?.uid || undefined,
      assignedDriverName: ownerName
    }));
    setItems(prev => {
      const otherDriversItems = user ? prev.filter(i => i.assignedDriverId && i.assignedDriverId !== user.uid) : [];
      return [...assignedLoaded, ...otherDriversItems];
    });
    assignedLoaded.forEach(item => syncItemToFirestore(item));
  };

  const handleDeleteRoute = (id: string) => {
    setSavedRoutes(prev => prev.filter(r => r.id !== id));
  };

  const handleResetData = () => {
    setItems([]);
    setSavedRoutes([]);
    localStorage.removeItem('ruteo_current_items');
    localStorage.removeItem('ruteo_saved_routes');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 selection:bg-emerald-500 selection:text-white relative">
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
        user={user}
        onSignIn={signIn}
        onSignOut={signOut}
        remoteDrivers={remoteDrivers}
        routeDrivers={routeDrivers}
        selectedDriverId={selectedDriverId}
        onSelectDriver={setSelectedDriverId}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex-1 w-full space-y-6">
        {/* Interactive Map Section */}
        {showMap && (
          <div className="w-full h-[400px] md:h-[500px] shadow-2xl rounded-3xl overflow-hidden transition-all border border-gray-200 relative isolate z-0">
            {/* Map Provider Switcher (Google Maps vs 100% Free OpenStreetMap) */}
            <div className="absolute top-3 right-14 z-[460] bg-white/95 backdrop-blur-xs border border-gray-200 rounded-xl p-1 shadow-md flex items-center gap-1 text-[11px] font-bold">
              <button
                onClick={() => setMapProvider('free')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  mapProvider === 'free'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Mapa 100% gratuito sin límites ni facturación (OpenStreetMap)"
              >
                Mapa Gratis
              </button>
              <button
                onClick={() => setMapProvider('google')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  mapProvider === 'google'
                    ? 'bg-gray-900 text-white shadow-2xs'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Usar Google Maps (cuota gratuita diaria)"
              >
                Google Maps
              </button>
            </div>

            {mapProvider === 'free' ? (
              <FreeMapView
                items={displayedItems}
                currentUserId={user?.uid || null}
                currentGps={currentGps}
                selectedPackageId={selectedPackageId}
                onUpdateStatus={handleUpdateStatus}
                onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
                remoteDrivers={selectedDriverId ? remoteDrivers.filter(d => d.id === selectedDriverId) : remoteDrivers}
              />
            ) : (
              <MapView
                items={displayedItems}
                currentUserId={user?.uid || null}
                currentGps={currentGps}
                selectedPackageId={selectedPackageId}
                onUpdateStatus={handleUpdateStatus}
                onStartNavigation={item => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
                  window.open(url, '_blank');
                }}
                onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
                apiKey={apiKey}
                remoteDrivers={selectedDriverId ? remoteDrivers.filter(d => d.id === selectedDriverId) : remoteDrivers}
              />
            )}
          </div>
        )}

        {/* Dashboard Content */}
        <MainDashboard
          items={displayedItems}
          currentUserId={user?.uid || null}
          currentGps={currentGps}
          onOpenInputModal={() => setIsInputOpen(true)}
          onOpenOptimizerModal={() => setIsOptimizerOpen(true)}
          onOpenNavigationModal={() => setIsNavOpen(true)}
          onOpenSavedRoutesModal={() => setIsSavedRoutesOpen(true)}
          onUpdateStatus={handleUpdateStatus}
          onEditItem={item => {
            if (canEditItem(item)) setEditingItem(item);
          }}
          onOpenPhotoModal={item => setPhotoModalItemId(item.id)}
          onSelectPackage={id => {
            setSelectedPackageId(null);
            setTimeout(() => setSelectedPackageId(id), 10);
          }}
          onDeleteItem={handleDeleteItem}
          onClearAllItems={handleClearAllItems}
          showMap={showMap}
          onToggleShowMap={() => setShowMap(!showMap)}
        />
      </main>

      {/* Floating Action Button (FAB) - Agregar Paquete fixed in bottom right */}
      <button
        onClick={() => setIsInputOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-4 rounded-full shadow-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all transform hover:scale-105 active:scale-95 group border-2 border-white"
        title="Agregar Paquete"
      >
        <Plus className="w-6 h-6 transform group-hover:rotate-90 transition-transform duration-300" />
        <span className="hidden sm:inline pr-2">Agregar Paquete</span>
      </button>

      {/* Modals */}
      <LocationInputModal
        isOpen={isInputOpen}
        onClose={() => setIsInputOpen(false)}
        onAddItems={handleAddItems}
        existingItems={items.filter(canEditItem)}
      />

      <RouteOptimizationModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        items={editableDisplayedItems}
        currentGps={currentGps}
        onApplyOptimizedItems={handleApplyOptimizedItems}
      />

      <ActiveNavigationModal
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        items={editableDisplayedItems}
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
        hasCurrentItems={items.some(canEditItem)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        onSaveApiKey={setApiKey}
        onResetData={handleResetData}
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
        readOnly={photoModalItem ? !canEditItem(photoModalItem) : false}
      />

      <OfflineIndicator />
    </div>
  );
}

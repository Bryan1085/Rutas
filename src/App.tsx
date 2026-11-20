import React, { useState, useEffect } from 'react';
import { DeliveryItem, RouteSession, GpsPosition } from './types';
import { QuotaBanner } from './components/QuotaBanner';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { MapView } from './components/MapView';
import { LocationInputModal } from './components/LocationInputModal';
import { RouteOptimizationModal } from './components/RouteOptimizationModal';
import { ActiveNavigationModal } from './components/ActiveNavigationModal';
import { SavedRoutesModal } from './components/SavedRoutesModal';
import { SettingsModal } from './components/SettingsModal';
import { EditPackageModal } from './components/EditPackageModal';
import { Plus } from 'lucide-react';

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

  // Modals state
  const [isInputOpen, setIsInputOpen] = useState<boolean>(false);
  const [isOptimizerOpen, setIsOptimizerOpen] = useState<boolean>(false);
  const [isNavOpen, setIsNavOpen] = useState<boolean>(false);
  const [isSavedRoutesOpen, setIsSavedRoutesOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null);

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
    setItems(prev => [...prev, ...newItems]);
  };

  const handleUpdateStatus = (id: string, status: DeliveryItem['status']) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, status } : item))
    );
  };

  const handleSaveEditItem = (updated: DeliveryItem) => {
    setItems(prev => prev.map(item => (item.id === updated.id ? updated : item)));
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllItems = () => {
    if (confirm('¿Estás seguro de eliminar todas las ubicaciones actuales?')) {
      setItems([]);
    }
  };

  const handleApplyOptimizedItems = (optimized: DeliveryItem[]) => {
    setItems(optimized);
  };

  const handleSaveCurrentRoute = () => {
    if (items.length === 0) return;
    const newSession: RouteSession = {
      id: `session-${Date.now()}`,
      name: `Recorrido CR ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
      date: new Date().toISOString(),
      items: [...items],
      status: 'saved',
      totalDistanceKm: 18.5,
      totalMinutes: 65,
      createdAt: Date.now()
    };
    setSavedRoutes(prev => [newSession, ...prev]);
    alert('¡Recorrido guardado exitosamente en el historial!');
  };

  const handleLoadRoute = (route: RouteSession) => {
    setItems(route.items);
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
      <QuotaBanner />

      {/* Header */}
      <Header
        items={items}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSavedRoutes={() => setIsSavedRoutesOpen(true)}
        gpsActive={gpsActive}
        onToggleGps={handleToggleGps}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex-1 w-full space-y-6">
        {/* Interactive Map Section */}
        {showMap && (
          <div className="w-full h-[400px] md:h-[500px] shadow-2xl rounded-3xl overflow-hidden transition-all border border-gray-200">
            <MapView
              items={items}
              currentGps={currentGps}
              selectedPackageId={selectedPackageId}
              onUpdateStatus={handleUpdateStatus}
              onStartNavigation={item => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}`;
                window.open(url, '_blank');
              }}
              apiKey={apiKey}
            />
          </div>
        )}

        {/* Dashboard Content */}
        <MainDashboard
          items={items}
          onOpenInputModal={() => setIsInputOpen(true)}
          onOpenOptimizerModal={() => setIsOptimizerOpen(true)}
          onOpenNavigationModal={() => setIsNavOpen(true)}
          onOpenSavedRoutesModal={() => setIsSavedRoutesOpen(true)}
          onUpdateStatus={handleUpdateStatus}
          onEditItem={item => setEditingItem(item)}
          onSelectPackage={id => {
            setSelectedPackageId(null); // reset trigger
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
        existingItems={items}
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
    </div>
  );
}

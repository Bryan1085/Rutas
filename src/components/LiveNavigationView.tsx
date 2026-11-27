import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  Flag,
  Compass,
  Navigation,
  Volume2,
  VolumeX,
  X,
  CheckCircle2,
  Camera,
  AlertCircle,
  LocateFixed,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Play,
  Square,
  ExternalLink,
  List,
  Loader2,
  Plus,
  Minus,
  EyeOff,
  MessageCircle,
} from 'lucide-react';
import { DeliveryItem, GpsPosition } from '../types';
import {
  SpeakerSettings,
  AppTheme,
  GpsNavigatorSettings,
  DEFAULT_APP_SETTINGS,
} from '../utils/appSettings';
import { speakText, stopSpeaking } from '../utils/speechUtils';
import { buildWhatsAppUrl } from '../utils/whatsappParser';
import {
  TurnByTurnRoute,
  RouteStepInstruction,
  ManeuverIconKind,
  fetchTurnByTurnRoute,
  findNearestRouteProgress,
  distanceMetersBetween,
  bearingDegreesBetween,
  lookAheadBearingOnRoute,
  roadDistanceToPoint,
  formatDistanceEs,
  formatDurationEs,
} from '../utils/turnByTurnRouter';

interface LiveNavigationViewProps {
  isOpen: boolean;
  onClose: () => void;
  items: DeliveryItem[];
  currentGps: GpsPosition | null;
  focusPackageId?: string | null;
  speakerEnabled: boolean;
  speakerSettings: SpeakerSettings;
  gpsSettings?: GpsNavigatorSettings;
  theme?: AppTheme;
  onToggleSpeaker: () => void;
  onToggleGps: () => void;
  onUpdateStatus: (id: string, status: DeliveryItem['status']) => void;
  onOpenPhotoModal: (item: DeliveryItem) => void;
  onFinishRoute: () => void;
}

function unwrapAngle(prev: number, nextDeg: number): number {
  const normalizedNext = ((nextDeg % 360) + 360) % 360;
  const normalizedPrev = ((prev % 360) + 360) % 360;
  let delta = normalizedNext - normalizedPrev;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return prev + delta;
}

function renderManeuverIcon(kind: ManeuverIconKind, className = 'w-9 h-9') {
  switch (kind) {
    case 'left':
    case 'sharp-left':
      return <CornerUpLeft className={className} strokeWidth={2.75} />;
    case 'right':
    case 'sharp-right':
      return <CornerUpRight className={className} strokeWidth={2.75} />;
    case 'slight-left':
      return <ArrowUpLeft className={className} strokeWidth={2.75} />;
    case 'slight-right':
      return <ArrowUpRight className={className} strokeWidth={2.75} />;
    case 'uturn':
      return <RotateCcw className={className} strokeWidth={2.75} />;
    case 'roundabout':
      return <RefreshCw className={className} strokeWidth={2.75} />;
    case 'arrive':
      return <Flag className={className} strokeWidth={2.5} />;
    case 'depart':
    case 'straight':
    default:
      return <ArrowUp className={className} strokeWidth={2.75} />;
  }
}

export const LiveNavigationView: React.FC<LiveNavigationViewProps> = ({
  isOpen,
  onClose,
  items,
  currentGps,
  focusPackageId,
  speakerEnabled,
  speakerSettings,
  gpsSettings = DEFAULT_APP_SETTINGS.gpsNavigator,
  theme = 'light',
  onToggleSpeaker,
  onToggleGps,
  onUpdateStatus,
  onOpenPhotoModal,
  onFinishRoute,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const compassIconRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const circuitLayerRef = useRef<L.LayerGroup | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);

  // Persistent route polylines & maneuver node so GPS ticks never destroy/recreate DOM layers
  const drivenPolylineRef = useRef<L.Polyline | null>(null);
  const casingPolylineRef = useRef<L.Polyline | null>(null);
  const remainingPolylineRef = useRef<L.Polyline | null>(null);
  const turnDotMarkerRef = useRef<L.Marker | null>(null);

  const [stageSize, setStageSize] = useState<number>(() =>
    typeof window !== 'undefined'
      ? Math.max(900, Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) * 1.65))
      : 1600
  );

  const [isFollowing, setIsFollowing] = useState(true);
  const isFollowingRef = useRef(true);
  isFollowingRef.current = isFollowing;

  const [compassMode, setCompassMode] = useState<'heading' | 'north' | 'manual'>('heading');
  const compassModeRef = useRef<'heading' | 'north' | 'manual'>('heading');
  compassModeRef.current = compassMode;

  const [mapRotationDeg, setMapRotationDeg] = useState(0);
  const mapRotationRef = useRef(0);
  const puckRotationRef = useRef(0);
  const hasInitialHeadingRef = useRef(false);

  const [isUserDragging, setIsUserDragging] = useState(false);
  const isGesturingRef = useRef(false);
  const isZoomAnimatingRef = useRef(false);
  const mouseDragRef = useRef<{ pointerId: number; x: number; y: number; active: boolean } | null>(null);
  const touchStateRef = useRef<
    | {
        mode: 'one';
        x: number;
        y: number;
        startX: number;
        startY: number;
        startTime: number;
        moved: boolean;
        startedOnMarker: boolean;
      }
    | {
        mode: 'two';
        dist: number;
        midX: number;
        midY: number;
        angleDeg: number;
        twistAccumDeg: number;
        rotationUnlocked: boolean;
      }
    | null
  >(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const driverPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Target & 60fps interpolated visual state for zero-stutter puck, camera, and heading glide
  const targetNavRef = useRef<{
    lat: number;
    lng: number;
    heading: number;
    hasHeading: boolean;
    speedKmh: number;
    isLiveGps: boolean;
  } | null>(null);
  const visualStateRef = useRef<{
    initialized: boolean;
    lat: number;
    lng: number;
    cameraLat: number;
    cameraLng: number;
    mapDeg: number;
    puckDeg: number;
  }>({
    initialized: false,
    lat: 0,
    lng: 0,
    cameraLat: 0,
    cameraLng: 0,
    mapDeg: 0,
    puckDeg: 0,
  });

  const prevGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const gpsMovementBearingRef = useRef<number | null>(null);
  const offRouteCountRef = useRef<number>(0);

  const [isBannerHidden, setIsBannerHidden] = useState(false);
  const [showStepsDrawer, setShowStepsDrawer] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const isSimulatingRef = useRef(false);
  isSimulatingRef.current = isSimulating;
  const [simPos, setSimPos] = useState<{ lat: number; lng: number; heading: number; speedKmh: number } | null>(null);
  const simProgressRef = useRef<{ segIdx: number; t: number }>({ segIdx: 0, t: 0 });
  const lastSimUiSyncRef = useRef<number>(0);

  const [routeData, setRouteData] = useState<TurnByTurnRoute | null>(null);
  const routeDataRef = useRef<TurnByTurnRoute | null>(null);
  routeDataRef.current = routeData;

  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [rerouteNonce, setRerouteNonce] = useState(0);
  const lastRerouteAtRef = useRef<number>(0);

  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [distanceToTurnMeters, setDistanceToTurnMeters] = useState(0);
  const [remainingDistMeters, setRemainingDistMeters] = useState(0);
  const [remainingSec, setRemainingSec] = useState(0);
  const [arrivedAtStop, setArrivedAtStop] = useState(false);
  const [targetOverrideId, setTargetOverrideId] = useState<string | null>(focusPackageId || null);

  const lastSpokenStepKeyRef = useRef<string>('');
  const lastRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const routeUsedLiveGpsRef = useRef<boolean>(false);

  useEffect(() => {
    setTargetOverrideId(focusPackageId || null);
  }, [focusPackageId, isOpen]);

  // If live GPS locks on after opening in preview mode, recompute route from real position
  useEffect(() => {
    if (isOpen && currentGps && !isSimulating && !routeUsedLiveGpsRef.current && !routeLoading) {
      routeUsedLiveGpsRef.current = true;
      setRerouteNonce((n) => n + 1);
    }
  }, [isOpen, currentGps, isSimulating, routeLoading]);

  const activeStops = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.coverageStatus === 'in_coverage' &&
            i.hasLocation !== false &&
            (i.status === 'pending' || i.status === 'in_transit')
        )
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [items]
  );

  const targetStop = useMemo(() => {
    if (activeStops.length === 0) return null;
    if (targetOverrideId) {
      const found = activeStops.find((s) => s.id === targetOverrideId);
      if (found) return found;
    }
    return activeStops[0];
  }, [activeStops, targetOverrideId]);

  const targetIndexInCircuit = useMemo(() => {
    if (!targetStop) return 0;
    const idx = activeStops.findIndex((s) => s.id === targetStop.id);
    return idx >= 0 ? idx : 0;
  }, [activeStops, targetStop]);

  // Fallback anchor when driver GPS is unavailable (e.g. desktop preview)
  const previewAnchor = useMemo<{ lat: number; lng: number } | null>(() => {
    if (!targetStop) return null;
    if (activeStops.length >= 2) {
      if (targetIndexInCircuit > 0) {
        const prev = activeStops[targetIndexInCircuit - 1];
        return { lat: prev.lat, lng: prev.lng };
      }
      // If navigating to stop #1 with no GPS, offset 450m south-west on local grid to compute approach
      return { lat: targetStop.lat - 0.0035, lng: targetStop.lng - 0.003 };
    }
    return { lat: targetStop.lat - 0.0035, lng: targetStop.lng - 0.003 };
  }, [activeStops, targetStop, targetIndexInCircuit]);

  // Active vehicle position: simulated position if simulating, else live GPS, else preview anchor
  const driverPosition = useMemo(() => {
    if (isSimulating && simPos) {
      return {
        lat: simPos.lat,
        lng: simPos.lng,
        heading: simPos.heading,
        speedKmh: simPos.speedKmh,
        isLiveGps: false,
      };
    }
    if (currentGps) {
      return {
        lat: currentGps.lat,
        lng: currentGps.lng,
        heading: typeof currentGps.heading === 'number' && !Number.isNaN(currentGps.heading)
          ? currentGps.heading
          : null,
        speedKmh:
          typeof currentGps.speed === 'number' && !Number.isNaN(currentGps.speed)
            ? Math.round(currentGps.speed * 3.6)
            : 0,
        isLiveGps: true,
      };
    }
    if (previewAnchor) {
      return {
        lat: previewAnchor.lat,
        lng: previewAnchor.lng,
        heading: null,
        speedKmh: 0,
        isLiveGps: false,
      };
    }
    return null;
  }, [isSimulating, simPos, currentGps, previewAnchor]);

  driverPositionRef.current = driverPosition
    ? { lat: driverPosition.lat, lng: driverPosition.lng }
    : null;

  // Track movement bearing from consecutive GPS points when native heading is missing
  useEffect(() => {
    if (!currentGps) return;
    const prev = prevGpsRef.current;
    if (prev) {
      const moved = distanceMetersBetween(prev.lat, prev.lng, currentGps.lat, currentGps.lng);
      if (moved >= 3) {
        gpsMovementBearingRef.current = bearingDegreesBetween(
          prev.lat,
          prev.lng,
          currentGps.lat,
          currentGps.lng
        );
        prevGpsRef.current = { lat: currentGps.lat, lng: currentGps.lng };
      }
    } else {
      prevGpsRef.current = { lat: currentGps.lat, lng: currentGps.lng };
    }
  }, [currentGps?.lat, currentGps?.lng]);

  // Clean reset when modal closes or initializes banner state on open
  useEffect(() => {
    if (isOpen) {
      setIsBannerHidden(Boolean(gpsSettings.startBannerHidden));
    } else {
      setIsSimulating(false);
      setSimPos(null);
      setShowStepsDrawer(false);
      setIsBannerHidden(false);
      setIsFollowing(true);
      setCompassMode('heading');
      setMapRotationDeg(0);
      mapRotationRef.current = 0;
      puckRotationRef.current = 0;
      hasInitialHeadingRef.current = false;
      isGesturingRef.current = false;
      isZoomAnimatingRef.current = false;
      touchStateRef.current = null;
      mouseDragRef.current = null;
      lastSpokenStepKeyRef.current = '';
      routeUsedLiveGpsRef.current = false;
      offRouteCountRef.current = 0;
      targetNavRef.current = null;
      visualStateRef.current = {
        initialized: false,
        lat: 0,
        lng: 0,
        cameraLat: 0,
        cameraLng: 0,
        mapDeg: 0,
        puckDeg: 0,
      };
      stopSpeaking();
    }
  }, [isOpen, gpsSettings.startBannerHidden]);

  // Keep square map stage oversized to cover full viewport at any rotation angle
  useEffect(() => {
    if (!isOpen || !viewportRef.current) return;
    const el = viewportRef.current;
    const updateSize = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      const needed = Math.max(900, Math.ceil(Math.hypot(w, h) * 1.65));
      setStageSize(needed);
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isOpen]);

  // Initialize Leaflet map inside LiveNavigationView (dragging handled rotation-aware)
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return;

    const initCenter: [number, number] = driverPosition
      ? [driverPosition.lat, driverPosition.lng]
      : targetStop
      ? [targetStop.lat, targetStop.lng]
      : [9.9614, -84.0793];

    const map = L.map(mapContainerRef.current, {
      center: initCenter,
      zoom: 17,
      minZoom: 4,
      maxZoom: 19,
      zoomSnap: 0,
      zoomDelta: 0.75,
      zoomControl: false,
      dragging: false,
      touchZoom: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    const circuitLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    map.on('zoomstart', () => {
      isZoomAnimatingRef.current = true;
    });
    map.on('zoomend', () => {
      isZoomAnimatingRef.current = false;
    });

    mapRef.current = map;
    circuitLayerRef.current = circuitLayer;
    routeLayerRef.current = routeLayer;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapRef.current = null;
      circuitLayerRef.current = null;
      routeLayerRef.current = null;
      markersLayerRef.current = null;
      driverMarkerRef.current = null;
      drivenPolylineRef.current = null;
      casingPolylineRef.current = null;
      remainingPolylineRef.current = null;
      turnDotMarkerRef.current = null;
      isZoomAnimatingRef.current = false;
    };
  }, [isOpen]);

  // Recalculate Leaflet container dimensions when stageSize changes
  useEffect(() => {
    const map = mapRef.current;
    if (!isOpen || !map) return;
    map.invalidateSize({ animate: false });
    if (isFollowingRef.current && driverPositionRef.current) {
      map.setView([driverPositionRef.current.lat, driverPositionRef.current.lng], map.getZoom(), {
        animate: false,
      });
    }
  }, [isOpen, stageSize]);

  // Helper to map screen (clientX, clientY) into exact geographic LatLng even when map stage is rotated
  const screenPointToMapLatLng = (clientX: number, clientY: number): L.LatLng | null => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return null;
    const rect = container.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const sx = clientX - cx;
    const sy = clientY - cy;
    const thetaRad = (-mapRotationRef.current * Math.PI) / 180;
    const cos = Math.cos(thetaRad);
    const sin = Math.sin(thetaRad);
    const lx = sx * cos + sy * sin;
    const ly = -sx * sin + sy * cos;
    const size = map.getSize();
    return map.containerPointToLatLng(L.point(size.x / 2 + lx, size.y / 2 + ly));
  };

  const applyMapStageTransform = (deg: number, puckDeg?: number) => {
    mapRotationRef.current = deg;
    if (mapContainerRef.current) {
      mapContainerRef.current.style.transition = 'none';
      mapContainerRef.current.style.transform = `translate(-50%, -50%) rotate(${-deg}deg)`;
      mapContainerRef.current.style.setProperty('--ruteo-pin-rotate', `${deg}deg`);
      if (typeof puckDeg === 'number') {
        mapContainerRef.current.style.setProperty('--ruteo-puck-rotate', `${puckDeg}deg`);
      }
    }
    if (compassIconRef.current) {
      compassIconRef.current.style.transition = 'none';
      compassIconRef.current.style.transform = `rotate(${-deg}deg)`;
    }
  };

  // Native non-passive wheel zoom (supports mouse wheel + trackpad pinch without browser page zoom)
  useEffect(() => {
    if (!isOpen || !viewportRef.current) return;
    const el = viewportRef.current;
    const handleWheel = (e: WheelEvent) => {
      const map = mapRef.current;
      if (!map) return;
      e.preventDefault();
      const zoomStep = e.ctrlKey ? -e.deltaY * 0.012 : e.deltaY < 0 ? 0.75 : -0.75;
      const nextZoom = Math.max(4, Math.min(19, map.getZoom() + zoomStep));
      if (isFollowingRef.current && driverPositionRef.current) {
        map.setView([driverPositionRef.current.lat, driverPositionRef.current.lng], nextZoom, {
          animate: !e.ctrlKey,
        });
      } else {
        const anchor = screenPointToMapLatLng(e.clientX, e.clientY);
        if (anchor) {
          map.setZoomAround(anchor, nextZoom, { animate: !e.ctrlKey });
        } else {
          map.setZoom(nextZoom, { animate: !e.ctrlKey });
        }
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  // Universal non-passive Touch & Safari Gesture handlers for iOS (iPhone/iPad) and Android phones/tablets
  useEffect(() => {
    if (!isOpen || !viewportRef.current) return;
    const el = viewportRef.current;

    const getTwoFingerMetrics = (t0: Touch, t1: Touch) => {
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      return {
        dist: Math.hypot(dx, dy),
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
        angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
      };
    };

    const preventSafariGesture = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        const m = getTwoFingerMetrics(e.touches[0], e.touches[1]);
        touchStateRef.current = {
          mode: 'two',
          dist: m.dist,
          midX: m.midX,
          midY: m.midY,
          angleDeg: m.angleDeg,
          twistAccumDeg: 0,
          rotationUnlocked: false,
        };
        isGesturingRef.current = true;
        setIsUserDragging(true);
        if (mapContainerRef.current) {
          mapContainerRef.current.style.transition = 'none';
        }
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        const targetEl = e.target as HTMLElement | null;
        const startedOnMarker = Boolean(targetEl?.closest('.leaflet-marker-icon'));
        touchStateRef.current = {
          mode: 'one',
          x: t.clientX,
          y: t.clientY,
          startX: t.clientX,
          startY: t.clientY,
          startTime: Date.now(),
          moved: false,
          startedOnMarker,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      const map = mapRef.current;
      if (!map) return;

      if (e.touches.length >= 2) {
        const m = getTwoFingerMetrics(e.touches[0], e.touches[1]);
        isGesturingRef.current = true;
        if (mapContainerRef.current) {
          mapContainerRef.current.style.transition = 'none';
        }

        if (!touchStateRef.current || touchStateRef.current.mode !== 'two') {
          touchStateRef.current = {
            mode: 'two',
            dist: m.dist,
            midX: m.midX,
            midY: m.midY,
            angleDeg: m.angleDeg,
            twistAccumDeg: 0,
            rotationUnlocked: false,
          };
          setIsUserDragging(true);
          return;
        }

        const prev = touchStateRef.current;
        let dAngle = m.angleDeg - prev.angleDeg;
        if (dAngle > 180) dAngle -= 360;
        if (dAngle < -180) dAngle += 360;

        const nextTwistAccum = prev.twistAccumDeg + dAngle;
        const rotationUnlocked = prev.rotationUnlocked || Math.abs(nextTwistAccum) >= 3.5;

        let appliedClockwiseDeg = 0;
        if (rotationUnlocked && Math.abs(dAngle) > 0.03) {
          appliedClockwiseDeg = dAngle;
          const nextMapDeg = mapRotationRef.current - dAngle;
          visualStateRef.current.mapDeg = nextMapDeg;
          applyMapStageTransform(nextMapDeg);
          if (compassModeRef.current !== 'manual') {
            compassModeRef.current = 'manual';
            setCompassMode('manual');
          }
        }

        const canZoom = prev.dist > 10 && m.dist > 10;
        const dz = canZoom ? Math.log2(m.dist / prev.dist) : 0;
        const nextZoom = Math.max(4, Math.min(19, map.getZoom() + dz));

        if (isFollowingRef.current && driverPositionRef.current) {
          if (Math.abs(dz) > 0.0005) {
            map.setView([driverPositionRef.current.lat, driverPositionRef.current.lng], nextZoom, {
              animate: false,
            });
          }
        } else {
          let panScreenDx = m.midX - prev.midX;
          let panScreenDy = m.midY - prev.midY;

          if (appliedClockwiseDeg !== 0 && mapContainerRef.current) {
            const rect = mapContainerRef.current.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const rx = m.midX - cx;
            const ry = m.midY - cy;
            const dRad = (appliedClockwiseDeg * Math.PI) / 180;
            const arcDx = rx * (Math.cos(dRad) - 1) - ry * Math.sin(dRad);
            const arcDy = rx * Math.sin(dRad) + ry * (Math.cos(dRad) - 1);
            panScreenDx -= arcDx;
            panScreenDy -= arcDy;
          }

          if (Math.abs(panScreenDx) > 0.15 || Math.abs(panScreenDy) > 0.15) {
            const thetaRad = (-mapRotationRef.current * Math.PI) / 180;
            const cos = Math.cos(thetaRad);
            const sin = Math.sin(thetaRad);
            const localDx = panScreenDx * cos + panScreenDy * sin;
            const localDy = -panScreenDx * sin + panScreenDy * cos;
            map.panBy([-localDx, -localDy], { animate: false });
          }

          if (Math.abs(dz) > 0.0005) {
            const anchor = screenPointToMapLatLng(m.midX, m.midY);
            if (anchor) {
              map.setZoomAround(anchor, nextZoom, { animate: false });
            } else {
              map.setZoom(nextZoom, { animate: false });
            }
          }
        }

        touchStateRef.current = {
          mode: 'two',
          dist: m.dist,
          midX: m.midX,
          midY: m.midY,
          angleDeg: m.angleDeg,
          twistAccumDeg: nextTwistAccum,
          rotationUnlocked,
        };
        return;
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        if (!touchStateRef.current || touchStateRef.current.mode !== 'one') {
          touchStateRef.current = {
            mode: 'one',
            x: t.clientX,
            y: t.clientY,
            startX: t.clientX,
            startY: t.clientY,
            startTime: Date.now(),
            moved: true,
            startedOnMarker: false,
          };
          return;
        }

        const prev = touchStateRef.current;
        const dx = t.clientX - prev.x;
        const dy = t.clientY - prev.y;

        if (!prev.moved) {
          const threshold = prev.startedOnMarker ? 7 : 3;
          if (Math.hypot(t.clientX - prev.startX, t.clientY - prev.startY) <= threshold) {
            return;
          }
          prev.moved = true;
          isGesturingRef.current = true;
          setIsUserDragging(true);
          setIsFollowing(false);
          if (mapContainerRef.current) {
            mapContainerRef.current.style.transition = 'none';
          }
        }

        prev.x = t.clientX;
        prev.y = t.clientY;

        const thetaRad = (-mapRotationRef.current * Math.PI) / 180;
        const cos = Math.cos(thetaRad);
        const sin = Math.sin(thetaRad);
        const localDx = dx * cos + dy * sin;
        const localDy = -dx * sin + dy * cos;
        map.panBy([-localDx, -localDy], { animate: false });
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStateRef.current = {
          mode: 'one',
          x: t.clientX,
          y: t.clientY,
          startX: t.clientX,
          startY: t.clientY,
          startTime: Date.now(),
          moved: true,
          startedOnMarker: false,
        };
        return;
      }

      if (e.touches.length === 0) {
        const finished = touchStateRef.current;
        if (
          finished &&
          finished.mode === 'one' &&
          !finished.moved &&
          !finished.startedOnMarker &&
          Date.now() - finished.startTime < 260
        ) {
          const now = Date.now();
          const prevTap = lastTapRef.current;
          if (
            prevTap &&
            now - prevTap.time < 280 &&
            Math.hypot(finished.startX - prevTap.x, finished.startY - prevTap.y) < 30
          ) {
            lastTapRef.current = null;
            const map = mapRef.current;
            if (map) {
              const nextZoom = Math.min(19, map.getZoom() + 1);
              if (isFollowingRef.current && driverPositionRef.current) {
                map.setView(
                  [driverPositionRef.current.lat, driverPositionRef.current.lng],
                  nextZoom,
                  { animate: true }
                );
              } else {
                const anchor = screenPointToMapLatLng(finished.startX, finished.startY);
                if (anchor) {
                  map.setZoomAround(anchor, nextZoom, { animate: true });
                } else {
                  map.setZoom(nextZoom, { animate: true });
                }
              }
            }
          } else {
            lastTapRef.current = { time: now, x: finished.startX, y: finished.startY };
          }
        }

        touchStateRef.current = null;
        isGesturingRef.current = false;
        setIsUserDragging(false);
        setMapRotationDeg(mapRotationRef.current);
      }
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: false });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    el.addEventListener('gesturestart', preventSafariGesture, { passive: false });
    el.addEventListener('gesturechange', preventSafariGesture, { passive: false });
    el.addEventListener('gestureend', preventSafariGesture, { passive: false });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('gesturestart', preventSafariGesture);
      el.removeEventListener('gesturechange', preventSafariGesture);
      el.removeEventListener('gestureend', preventSafariGesture);
    };
  }, [isOpen]);

  // Fetch turn-by-turn route whenever targetStop changes or reroute is requested
  const routeTargetId = targetStop?.id || '';
  useEffect(() => {
    if (!isOpen || !targetStop || !driverPosition) {
      setRouteData(null);
      return;
    }

    // Avoid spamming OSRM when only moving slightly along the existing route
    const origin = { lat: driverPosition.lat, lng: driverPosition.lng };
    lastRouteOriginRef.current = origin;
    routeUsedLiveGpsRef.current = driverPosition.isLiveGps;

    const controller = new AbortController();
    setRouteLoading(true);
    setRouteError(null);
    setArrivedAtStop(false);
    setActiveStepIdx(0);
    setIsSimulating(false);
    setSimPos(null);
    simProgressRef.current = { segIdx: 0, t: 0 };
    lastSpokenStepKeyRef.current = '';

    fetchTurnByTurnRoute(origin, { lat: targetStop.lat, lng: targetStop.lng }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        if (!res) {
          setRouteError('No se pudo cargar la guía por calles. Verifica tu conexión.');
          setRouteData(null);
          return;
        }
        setRouteData(res);
        setRemainingDistMeters(res.totalDistanceMeters);
        setRemainingSec(res.totalDurationSeconds);
        const firstTurn = res.steps[1] || res.steps[0];
        setDistanceToTurnMeters(res.steps[0]?.distanceMeters || res.totalDistanceMeters);

        if (speakerEnabled && speakerSettings.gpsTurnByTurnVoice && speakerSettings.gpsAnnounceStreetStart && firstTurn) {
          const intro = `Iniciando ruta al paquete ${targetStop.originalNumber}. ${res.steps[0]?.instruction || ''}`;
          speakText(intro, { rate: speakerSettings.rate, pitch: speakerSettings.pitch });
          lastSpokenStepKeyRef.current = `${targetStop.id}-0-far`;
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRouteLoading(false);
          setIsRecalculating(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, routeTargetId, rerouteNonce]);

  // Draw overview of remaining circuit stops ahead (subtle emerald)
  useEffect(() => {
    const circuitLayer = circuitLayerRef.current;
    if (!circuitLayer) return;
    circuitLayer.clearLayers();

    if (activeStops.length < 2) return;
    const startIdx = Math.max(0, targetIndexInCircuit);
    const upcoming = activeStops.slice(startIdx, startIdx + 12);
    if (upcoming.length < 2) return;

    const coords = upcoming.map((s) => `${s.lng},${s.lat}`).join(';');
    const controller = new AbortController();
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        if (controller.signal.aborted) return;
        const raw = d?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(raw) && raw.length > 1) {
          const latLngs: [number, number][] = raw.map(([lng, lat]: [number, number]) => [lat, lng]);
          L.polyline(latLngs, {
            color: '#10b981',
            weight: 4,
            opacity: 0.45,
            dashArray: '8, 8',
          }).addTo(circuitLayer);
        }
      })
      .catch(() => {
        // silent fallback
      });

    return () => controller.abort();
  }, [isOpen, activeStops, targetIndexInCircuit]);

  // 60fps Fluid Interpolation & Simulation Loop (zero React re-renders per frame)
  useEffect(() => {
    if (!isOpen) return;

    let rafId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.06, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      // 1. Advance smooth 60fps simulation along route polyline when Simular is active
      if (isSimulatingRef.current && routeDataRef.current && routeDataRef.current.coordinates.length >= 2) {
        const coords = routeDataRef.current.coordinates;
        let { segIdx, t } = simProgressRef.current;

        if (segIdx >= coords.length - 1) {
          isSimulatingRef.current = false;
          setIsSimulating(false);
        } else {
          const speedMps = 13.5; // ~49 km/h smooth preview
          let stepBudget = speedMps * dt;

          while (stepBudget > 0 && segIdx < coords.length - 1) {
            const a = coords[segIdx];
            const b = coords[segIdx + 1];
            const segLen = Math.max(0.5, distanceMetersBetween(a[0], a[1], b[0], b[1]));
            const remainingInSeg = segLen * (1 - t);
            if (stepBudget < remainingInSeg) {
              t += stepBudget / segLen;
              stepBudget = 0;
            } else {
              stepBudget -= remainingInSeg;
              segIdx += 1;
              t = 0;
            }
          }

          simProgressRef.current = { segIdx, t };
          const curA = coords[Math.min(segIdx, coords.length - 1)];
          const curB = coords[Math.min(segIdx + 1, coords.length - 1)];
          const lat = curA[0] + (curB[0] - curA[0]) * t;
          const lng = curA[1] + (curB[1] - curA[1]) * t;
          const heading = lookAheadBearingOnRoute(coords, Math.min(segIdx, coords.length - 2), [lat, lng], 28);
          const speedKmh = segIdx >= coords.length - 1 ? 0 : 48;

          targetNavRef.current = {
            lat,
            lng,
            heading,
            hasHeading: true,
            speedKmh,
            isLiveGps: false,
          };
          driverPositionRef.current = { lat, lng };

          // Throttled ~5Hz React UI metrics sync for speed, ETA, step tracking, and voice prompts
          if (now - lastSimUiSyncRef.current >= 180 || segIdx >= coords.length - 1) {
            lastSimUiSyncRef.current = now;
            setSimPos({ lat, lng, heading, speedKmh });
          }
        }
      }

      // 2. Interpolate car position, camera follow, puck angle, and stage rotation at 60fps
      const map = mapRef.current;
      const target = targetNavRef.current;
      if (map && target) {
        const v = visualStateRef.current;

        if (!v.initialized) {
          v.initialized = true;
          v.lat = target.lat;
          v.lng = target.lng;
          v.cameraLat = target.lat;
          v.cameraLng = target.lng;
          v.puckDeg = target.heading;
          v.mapDeg = compassModeRef.current === 'heading' ? target.heading : 0;
          hasInitialHeadingRef.current = target.hasHeading;
          puckRotationRef.current = v.puckDeg;
          applyMapStageTransform(v.mapDeg, v.puckDeg);
        } else {
          const jumpDist = distanceMetersBetween(v.lat, v.lng, target.lat, target.lng);
          if (jumpDist > 280) {
            // Snap cleanly across large jumps (initial GPS lock or target switch)
            v.lat = target.lat;
            v.lng = target.lng;
            if (isFollowingRef.current) {
              v.cameraLat = target.lat;
              v.cameraLng = target.lng;
            }
          } else {
            const posAlpha = isSimulatingRef.current
              ? 1 - Math.exp(-18 * dt)
              : 1 - Math.exp(-6.5 * dt);
            v.lat += (target.lat - v.lat) * posAlpha;
            v.lng += (target.lng - v.lng) * posAlpha;
          }

          const rotAlpha = 1 - Math.exp(-8.5 * dt);
          const nextPuckTarget = unwrapAngle(v.puckDeg, target.heading);
          v.puckDeg += (nextPuckTarget - v.puckDeg) * rotAlpha;
          puckRotationRef.current = v.puckDeg;

          if (!isGesturingRef.current) {
            const desiredMapDeg =
              compassModeRef.current === 'heading'
                ? isFollowingRef.current
                  ? target.heading
                  : v.mapDeg
                : compassModeRef.current === 'north'
                ? 0
                : v.mapDeg;
            const nextMapTarget = unwrapAngle(v.mapDeg, desiredMapDeg);
            v.mapDeg += (nextMapTarget - v.mapDeg) * rotAlpha;
            applyMapStageTransform(v.mapDeg, v.puckDeg);
          } else if (mapContainerRef.current) {
            mapContainerRef.current.style.setProperty('--ruteo-puck-rotate', `${v.puckDeg}deg`);
          }
        }

        if (driverMarkerRef.current) {
          driverMarkerRef.current.setLatLng([v.lat, v.lng]);
        }

        if (isFollowingRef.current && !isGesturingRef.current && !isZoomAnimatingRef.current) {
          const camGap = distanceMetersBetween(v.cameraLat, v.cameraLng, v.lat, v.lng);
          if (camGap < 0.08 || camGap > 1500) {
            v.cameraLat = v.lat;
            v.cameraLng = v.lng;
          } else {
            const camAlpha = 1 - Math.exp(-12 * dt);
            v.cameraLat += (v.lat - v.cameraLat) * camAlpha;
            v.cameraLng += (v.lng - v.cameraLng) * camAlpha;
          }
          map.setView([v.cameraLat, v.cameraLng], map.getZoom(), { animate: false });
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  // Track real-time progress, road-snapping, look-ahead heading, step advancement, off-route auto-recalc, and voice prompts
  useEffect(() => {
    if (!isOpen || !driverPosition) return;

    let displayLat = driverPosition.lat;
    let displayLng = driverPosition.lng;
    let resolvedHeading: number | null = null;
    let snappedProgress: ReturnType<typeof findNearestRouteProgress> | null = null;

    if (routeData && routeData.coordinates.length > 1) {
      const coords = routeData.coordinates;
      const progress = findNearestRouteProgress(driverPosition.lat, driverPosition.lng, coords);
      snappedProgress = progress;

      // Snap vehicle onto route street when within 28m and GPS accuracy is reliable (<= 45m)
      const gpsAccuracy = currentGps?.accuracy ?? 20;
      const isSnappedToRoad =
        isSimulating ||
        (driverPosition.isLiveGps && progress.distanceMeters <= 28 && gpsAccuracy <= 45);

      if (isSnappedToRoad) {
        displayLat = progress.snappedPoint[0];
        displayLng = progress.snappedPoint[1];
      }

      // Compute smooth look-ahead road bearing when on-route; lock heading when stopped
      const lookAheadDeg = lookAheadBearingOnRoute(
        coords,
        progress.segmentIndex,
        progress.snappedPoint,
        28
      );

      if (isSimulating && simPos) {
        resolvedHeading = lookAheadDeg;
      } else if (driverPosition.isLiveGps) {
        if (driverPosition.speedKmh < 4 && hasInitialHeadingRef.current) {
          // Lock heading at red lights / stops so compass noise does not spin the map
          resolvedHeading = puckRotationRef.current;
        } else if (isSnappedToRoad) {
          if (driverPosition.heading !== null && driverPosition.speedKmh >= 6) {
            const diff = Math.abs(unwrapAngle(lookAheadDeg, driverPosition.heading) - lookAheadDeg);
            resolvedHeading = diff <= 45 ? lookAheadDeg : driverPosition.heading;
          } else {
            resolvedHeading = lookAheadDeg;
          }
        } else if (driverPosition.heading !== null && driverPosition.speedKmh >= 4) {
          resolvedHeading = driverPosition.heading;
        } else if (gpsMovementBearingRef.current !== null && driverPosition.speedKmh >= 4) {
          resolvedHeading = gpsMovementBearingRef.current;
        } else {
          resolvedHeading = lookAheadDeg;
        }
      } else {
        resolvedHeading = lookAheadDeg;
      }

      if (targetStop) {
        // Remaining distance along road segments
        let remDist = 0;
        if (progress.segmentIndex < coords.length - 1) {
          remDist += distanceMetersBetween(
            progress.snappedPoint[0],
            progress.snappedPoint[1],
            coords[progress.segmentIndex + 1][0],
            coords[progress.segmentIndex + 1][1]
          );
          for (let i = progress.segmentIndex + 1; i < coords.length - 1; i++) {
            remDist += distanceMetersBetween(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
          }
        }
        setRemainingDistMeters(remDist);

        const ratio = routeData.totalDistanceMeters > 0 ? remDist / routeData.totalDistanceMeters : 0;
        setRemainingSec(Math.max(15, Math.round(routeData.totalDurationSeconds * ratio)));

        // Check arrival within 35 meters of destination
        const distToDest = distanceMetersBetween(
          displayLat,
          displayLng,
          targetStop.lat,
          targetStop.lng
        );
        if (distToDest <= 35) {
          setArrivedAtStop(true);
          const arriveIdx = Math.max(0, routeData.steps.length - 1);
          setActiveStepIdx(arriveIdx);
          setDistanceToTurnMeters(Math.round(distToDest));

          const arriveKey = `${targetStop.id}-arrived`;
          if (speakerEnabled && speakerSettings.gpsTurnByTurnVoice && lastSpokenStepKeyRef.current !== arriveKey) {
            lastSpokenStepKeyRef.current = arriveKey;
            speakText(`Has llegado al paquete número ${targetStop.originalNumber}.`, {
              rate: speakerSettings.rate,
              pitch: speakerSettings.pitch,
            });
          }
        } else {
          setArrivedAtStop(false);

          // Sequential step advancement (avoids jumping to crossing streets)
          const steps = routeData.steps;
          let matchedStep = activeStepIdx;
          for (let s = activeStepIdx; s < steps.length - 1; s++) {
            const nextManeuver = steps[s + 1].maneuverLocation;
            const distToNext = distanceMetersBetween(
              displayLat,
              displayLng,
              nextManeuver[0],
              nextManeuver[1]
            );
            const curSnap = findNearestRouteProgress(displayLat, displayLng, steps[s].geometry);
            const nextSnap = findNearestRouteProgress(displayLat, displayLng, steps[s + 1].geometry);
            if (
              distToNext < 24 ||
              (steps[s + 1].geometry.length > 1 &&
                nextSnap.distanceMeters + 6 < curSnap.distanceMeters &&
                distToNext < 90)
            ) {
              matchedStep = s + 1;
            } else {
              break;
            }
          }

          if (matchedStep !== activeStepIdx) {
            setActiveStepIdx(matchedStep);
          }

          const upcomingStep = steps[Math.min(matchedStep + 1, steps.length - 1)] || steps[matchedStep];
          const distNext = upcomingStep
            ? progress.distanceMeters <= 60
              ? roadDistanceToPoint(
                  coords,
                  progress.segmentIndex,
                  progress.snappedPoint,
                  upcomingStep.maneuverLocation
                )
              : distanceMetersBetween(
                  displayLat,
                  displayLng,
                  upcomingStep.maneuverLocation[0],
                  upcomingStep.maneuverLocation[1]
                )
            : distToDest;
          setDistanceToTurnMeters(Math.round(distNext));

          // Voice guidance for upcoming maneuver
          if (speakerEnabled && speakerSettings.gpsTurnByTurnVoice && speakerSettings.gpsAnnounceApproach && upcomingStep) {
            const stepKeyNear = `${targetStop.id}-${matchedStep}-near`;
            const stepKeyFar = `${targetStop.id}-${matchedStep}-far`;
            if (distNext <= 115 && lastSpokenStepKeyRef.current !== stepKeyNear) {
              lastSpokenStepKeyRef.current = stepKeyNear;
              speakText(`En ${formatDistanceEs(distNext)}, ${upcomingStep.instruction}`, {
                rate: speakerSettings.rate,
                pitch: speakerSettings.pitch,
              });
            } else if (
              matchedStep > 0 &&
              distNext > 160 &&
              lastSpokenStepKeyRef.current !== stepKeyFar &&
              lastSpokenStepKeyRef.current !== stepKeyNear
            ) {
              lastSpokenStepKeyRef.current = stepKeyFar;
              speakText(`Continúa ${formatDistanceEs(distNext)}, luego ${upcomingStep.instruction}`, {
                rate: speakerSettings.rate,
                pitch: speakerSettings.pitch,
              });
            }
          }
        }
      }

      // 2-sample off-route confirmation (> 55m from route polyline while using live GPS)
      if (driverPosition.isLiveGps && !isSimulating && !routeLoading) {
        if (progress.distanceMeters > 55) {
          offRouteCountRef.current += 1;
          if (
            offRouteCountRef.current >= 2 &&
            Date.now() - lastRerouteAtRef.current > 7000
          ) {
            offRouteCountRef.current = 0;
            lastRerouteAtRef.current = Date.now();
            setIsRecalculating(true);
            setRerouteNonce((n) => n + 1);
          }
        } else {
          offRouteCountRef.current = 0;
        }
      }
    } else {
      // Fallback heading before route loads
      if (driverPosition.isLiveGps && driverPosition.speedKmh < 4 && hasInitialHeadingRef.current) {
        resolvedHeading = puckRotationRef.current;
      } else if (driverPosition.heading !== null && driverPosition.speedKmh >= 4) {
        resolvedHeading = driverPosition.heading;
      } else if (gpsMovementBearingRef.current !== null && driverPosition.speedKmh >= 4) {
        resolvedHeading = gpsMovementBearingRef.current;
      } else if (targetStop) {
        resolvedHeading = bearingDegreesBetween(
          displayLat,
          displayLng,
          targetStop.lat,
          targetStop.lng
        );
      }
    }

    // Feed target state to the 60fps rAF loop (simulation advances target directly inside rAF)
    if (!isSimulating) {
      const headingToUse = resolvedHeading ?? puckRotationRef.current;
      if (resolvedHeading !== null) {
        hasInitialHeadingRef.current = true;
      }
      targetNavRef.current = {
        lat: displayLat,
        lng: displayLng,
        heading: headingToUse,
        hasHeading: resolvedHeading !== null,
        speedKmh: driverPosition.speedKmh,
        isLiveGps: driverPosition.isLiveGps,
      };
      driverPositionRef.current = { lat: displayLat, lng: displayLng };
    } else if (!targetNavRef.current && snappedProgress) {
      hasInitialHeadingRef.current = true;
      targetNavRef.current = {
        lat: displayLat,
        lng: displayLng,
        heading: resolvedHeading ?? 0,
        hasHeading: true,
        speedKmh: driverPosition.speedKmh,
        isLiveGps: false,
      };
    }
  }, [
    isOpen,
    driverPosition,
    currentGps?.accuracy,
    routeData,
    targetStop,
    activeStepIdx,
    speakerEnabled,
    isSimulating,
    simPos,
    routeLoading,
  ]);

  // Render stop pins ONLY when stops or active target changes (zero DOM thrashing on GPS ticks)
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!isOpen || !markersLayer) return;

    markersLayer.clearLayers();

    activeStops.forEach((stop, idx) => {
      const isCurrent = targetStop?.id === stop.id;
      const pinHtml = isCurrent
        ? `<div style="transform:rotate(var(--ruteo-pin-rotate, 0deg));will-change:transform;position:relative;width:44px;height:44px;background:#dc2626;color:#fff;border:3px solid #fff;border-radius:16px;box-shadow:0 8px 20px rgba(220,38,38,0.45);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;">#${stop.originalNumber}<span style="position:absolute;top:-8px;right:-8px;min-width:19px;height:19px;padding:0 4px;background:#0f172a;color:#fff;border:2px solid #fff;border-radius:6px;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span></div>`
        : `<div style="transform:rotate(var(--ruteo-pin-rotate, 0deg));will-change:transform;position:relative;width:34px;height:34px;background:#059669;color:#fff;border:2.5px solid #fff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;opacity:0.9;">#${stop.originalNumber}<span style="position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 3px;background:#0f172a;color:#fff;border:1.5px solid #fff;border-radius:5px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span></div>`;

      const icon = L.divIcon({
        className: '',
        html: pinHtml,
        iconSize: isCurrent ? [44, 44] : [34, 34],
        iconAnchor: isCurrent ? [22, 22] : [17, 17],
      });

      const marker = L.marker([stop.lat, stop.lng], {
        icon,
        zIndexOffset: isCurrent ? 500 : 100,
      });
      marker.on('click', () => setTargetOverrideId(stop.id));
      marker.addTo(markersLayer);
    });
  }, [isOpen, activeStops, targetStop?.id]);

  // Update persistent route polylines, next-turn dot, and create driver puck once
  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!isOpen || !map || !routeLayer) return;

    if (routeData && routeData.coordinates.length > 1 && driverPosition) {
      const progress = findNearestRouteProgress(
        driverPosition.lat,
        driverPosition.lng,
        routeData.coordinates
      );

      const drivenCoords: [number, number][] = [
        ...routeData.coordinates.slice(0, progress.segmentIndex + 1),
        progress.snappedPoint,
      ];
      const remainingCoords: [number, number][] = [
        progress.snappedPoint,
        ...routeData.coordinates.slice(progress.segmentIndex + 1),
      ];

      if (!drivenPolylineRef.current) {
        drivenPolylineRef.current = L.polyline(drivenCoords, {
          color: '#94a3b8',
          weight: 6,
          opacity: 0.65,
        }).addTo(routeLayer);
      } else {
        drivenPolylineRef.current.setLatLngs(drivenCoords);
      }

      if (!casingPolylineRef.current) {
        casingPolylineRef.current = L.polyline(remainingCoords, {
          color: '#ffffff',
          weight: 11,
          opacity: 0.95,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(routeLayer);
      } else {
        casingPolylineRef.current.setLatLngs(remainingCoords);
      }

      if (!remainingPolylineRef.current) {
        remainingPolylineRef.current = L.polyline(remainingCoords, {
          color: '#0284c7',
          weight: 6.5,
          opacity: 0.98,
          lineJoin: 'round',
          lineCap: 'round',
        }).addTo(routeLayer);
      } else {
        remainingPolylineRef.current.setLatLngs(remainingCoords);
      }

      const nextStep = routeData.steps[Math.min(activeStepIdx + 1, routeData.steps.length - 1)];
      if (nextStep && !arrivedAtStop) {
        if (!turnDotMarkerRef.current) {
          const turnDot = L.divIcon({
            className: '',
            html: `<div style="width:16px;height:16px;border-radius:9999px;background:#ffffff;border:4px solid #059669;box-shadow:0 2px 8px rgba(0,0,0,0.4);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          turnDotMarkerRef.current = L.marker(nextStep.maneuverLocation, {
            icon: turnDot,
            interactive: false,
          }).addTo(routeLayer);
        } else {
          turnDotMarkerRef.current.setLatLng(nextStep.maneuverLocation);
        }
      } else if (turnDotMarkerRef.current) {
        routeLayer.removeLayer(turnDotMarkerRef.current);
        turnDotMarkerRef.current = null;
      }
    } else {
      routeLayer.clearLayers();
      drivenPolylineRef.current = null;
      casingPolylineRef.current = null;
      remainingPolylineRef.current = null;
      turnDotMarkerRef.current = null;
    }

    // Create Driver Navigation Puck once (position & rotation driven at 60fps by rAF loop)
    if (driverPosition && !driverMarkerRef.current) {
      const puckIcon = L.divIcon({
        className: '',
        html: `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 6px 14px rgba(2,132,199,0.55));transform:rotate(var(--ruteo-puck-rotate, 0deg));will-change:transform;">
          <svg width="42" height="42" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" fill="#ffffff" fill-opacity="0.96" stroke="#0284c7" stroke-width="2.5"/>
            <path d="M20 7L30 29L20 24.5L10 29L20 7Z" fill="#0284c7" stroke="#0369a1" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        </div>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      });
      driverMarkerRef.current = L.marker([driverPosition.lat, driverPosition.lng], {
        icon: puckIcon,
        zIndexOffset: 1000,
        interactive: false,
      }).addTo(map);
    }
  }, [isOpen, routeData, driverPosition, activeStepIdx, arrivedAtStop]);

  if (!isOpen) return null;

  const currentStep: RouteStepInstruction | undefined =
    routeData?.steps[Math.min(activeStepIdx + 1, (routeData?.steps.length || 1) - 1)] ||
    routeData?.steps[activeStepIdx];
  const followingStep: RouteStepInstruction | undefined =
    routeData?.steps[Math.min(activeStepIdx + 2, (routeData?.steps.length || 1) - 1)];

  const etaClock = (() => {
    const d = new Date(Date.now() + remainingSec * 1000);
    return d.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  })();

  const handleRecenter = () => {
    if (mapRef.current) {
      const center = mapRef.current.getCenter();
      visualStateRef.current.cameraLat = center.lat;
      visualStateRef.current.cameraLng = center.lng;
      const currentZoom = mapRef.current.getZoom();
      if (currentZoom < 13 || currentZoom > 18.5) {
        mapRef.current.setZoom(17, { animate: true });
      }
    }
    setIsFollowing(true);
    isFollowingRef.current = true;
    setCompassMode('heading');
    compassModeRef.current = 'heading';
  };

  const handleZoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    const nextZoom = Math.max(4, Math.min(19, map.getZoom() + delta));
    if (isFollowingRef.current && driverPositionRef.current) {
      map.setView([driverPositionRef.current.lat, driverPositionRef.current.lng], nextZoom, {
        animate: true,
      });
    } else {
      map.setZoom(nextZoom, { animate: true });
    }
  };

  const handleToggleCompassMode = () => {
    if (compassMode === 'heading') {
      setCompassMode('north');
      compassModeRef.current = 'north';
    } else {
      if (mapRef.current) {
        const center = mapRef.current.getCenter();
        visualStateRef.current.cameraLat = center.lat;
        visualStateRef.current.cameraLng = center.lng;
      }
      setCompassMode('heading');
      compassModeRef.current = 'heading';
      setIsFollowing(true);
      isFollowingRef.current = true;
    }
  };

  const handleManualReroute = () => {
    lastRerouteAtRef.current = Date.now();
    setIsRecalculating(true);
    setRerouteNonce((n) => n + 1);
  };

  // Mouse / pen pan handlers (touch gestures are handled by non-passive native listeners above)
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    mouseDragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, active: false };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const drag = mouseDragRef.current;
    const map = mapRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !map) return;

    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;

    if (!drag.active) {
      if (Math.hypot(dx, dy) <= 4) return;
      drag.active = true;
      isGesturingRef.current = true;
      setIsUserDragging(true);
      setIsFollowing(false);
      if (mapContainerRef.current) {
        mapContainerRef.current.style.transition = 'none';
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture error
      }
    }

    drag.x = e.clientX;
    drag.y = e.clientY;

    const thetaRad = (-mapRotationRef.current * Math.PI) / 180;
    const cos = Math.cos(thetaRad);
    const sin = Math.sin(thetaRad);
    const localDx = dx * cos + dy * sin;
    const localDy = -dx * sin + dy * cos;
    map.panBy([-localDx, -localDy], { animate: false });
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const drag = mouseDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    mouseDragRef.current = null;
    isGesturingRef.current = false;
    setIsUserDragging(false);
    setMapRotationDeg(mapRotationRef.current);
  };

  const handleStageDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;
    const nextZoom = Math.min(19, map.getZoom() + 1);
    if (isFollowingRef.current && driverPositionRef.current) {
      map.setView([driverPositionRef.current.lat, driverPositionRef.current.lng], nextZoom, {
        animate: true,
      });
    } else {
      const anchor = screenPointToMapLatLng(e.clientX, e.clientY);
      if (anchor) {
        map.setZoomAround(anchor, nextZoom, { animate: true });
      } else {
        map.setZoom(nextZoom, { animate: true });
      }
    }
  };

  return (
    <div
      data-allow-map-zoom="true"
      className="fixed inset-0 z-[1300] bg-slate-950 flex flex-col overflow-hidden select-none"
    >
      {/* Full-Screen Viewport Clipping Container with Lower-Center Rotating Map Stage */}
      <div
        ref={viewportRef}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerUp}
        onDoubleClick={handleStageDoubleClick}
        onDragStart={(e) => e.preventDefault()}
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        className="relative w-full h-full flex-1 overflow-hidden touch-none cursor-grab active:cursor-grabbing"
      >
        <div
          ref={mapContainerRef}
          style={{
            position: 'absolute',
            width: `${stageSize}px`,
            height: `${stageSize}px`,
            left: '50%',
            top: 'min(61%, calc(100% - 220px))',
            transform: `translate(-50%, -50%) rotate(${-mapRotationRef.current}deg)`,
            transformOrigin: 'center center',
            willChange: 'transform',
            touchAction: 'none',
          }}
          className={`[&_.leaflet-tile]:pointer-events-none [&_.leaflet-tile]:select-none ${
            theme === 'dark'
              ? '[&_.leaflet-tile-pane]:brightness-85 [&_.leaflet-tile-pane]:contrast-110 [&_.leaflet-tile-pane]:invert [&_.leaflet-tile-pane]:hue-rotate-180'
              : ''
          }`}
        />
      </div>

      {/* TOP TURN-BY-TURN MANEUVER BANNER (Compact & Configurable) */}
      <div className="absolute top-0 left-0 right-0 z-[500] p-2 sm:p-3.5 pointer-events-none">
        <div className="max-w-2xl mx-auto space-y-1.5 sm:space-y-2 pointer-events-auto">
          {targetStop ? (
            !gpsSettings.showTurnBanner ? (
              <>
                <div className="flex items-center justify-end gap-1.5">
                  {!currentGps && !isSimulating && gpsSettings.showNoGpsBanner && (
                    <button
                      type="button"
                      onClick={onToggleGps}
                      aria-label="Activar GPS"
                      title="Activar GPS"
                      className="min-h-[44px] px-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold shadow-xl flex items-center justify-center"
                    >
                      Activar GPS
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onToggleSpeaker}
                    aria-label={speakerEnabled ? 'Silenciar indicaciones' : 'Activar voz'}
                    className={`min-h-[44px] min-w-[44px] rounded-2xl shadow-xl flex items-center justify-center border transition-colors ${
                      speakerEnabled && speakerSettings.gpsTurnByTurnVoice
                        ? 'bg-amber-400 text-amber-950 border-amber-300'
                        : 'bg-white/95 dark:bg-slate-900/95 text-gray-800 dark:text-white border-gray-200 dark:border-slate-700'
                    }`}
                  >
                    {speakerEnabled && speakerSettings.gpsTurnByTurnVoice ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Salir de navegación en vivo"
                    className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/95 dark:bg-slate-900/95 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 shadow-xl flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : isBannerHidden ? (
              <div className="flex items-center justify-between gap-2 bg-emerald-700/95 dark:bg-emerald-800/95 backdrop-blur-md text-white rounded-2xl shadow-xl border border-emerald-500/40 px-2.5 py-1.5">
                <button
                  type="button"
                  onClick={() => setIsBannerHidden(false)}
                  aria-label="Mostrar cuadro de dirección"
                  className="flex items-center gap-2 min-w-0 flex-1 text-left py-1 px-1.5 rounded-xl hover:bg-emerald-800/60 transition-colors"
                >
                  <div className="w-7 h-7 bg-emerald-900/60 rounded-lg flex items-center justify-center shrink-0">
                    {routeLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-100" />
                    ) : arrivedAtStop ? (
                      renderManeuverIcon('arrive', 'w-4 h-4 text-amber-300')
                    ) : (
                      renderManeuverIcon(currentStep?.iconKind || 'straight', 'w-4 h-4 text-white')
                    )}
                  </div>
                  <span className="text-sm font-black tabular-nums shrink-0">
                    {routeLoading
                      ? '...'
                      : arrivedAtStop
                      ? 'Llegaste'
                      : formatDistanceEs(distanceToTurnMeters)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-100 truncate">
                    {arrivedAtStop
                      ? `Paquete #${targetStop.originalNumber}`
                      : currentStep?.instruction || 'Ver dirección'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-emerald-200 shrink-0 ml-auto" />
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {!currentGps && !isSimulating && gpsSettings.showNoGpsBanner && (
                    <button
                      type="button"
                      onClick={onToggleGps}
                      aria-label="Activar GPS"
                      title="Activar GPS"
                      className="min-h-[44px] px-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[11px] font-bold flex items-center justify-center"
                    >
                      GPS
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onToggleSpeaker}
                    aria-label={speakerEnabled ? 'Silenciar indicaciones' : 'Activar voz'}
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
                      speakerEnabled && speakerSettings.gpsTurnByTurnVoice
                        ? 'bg-amber-400 text-amber-950'
                        : 'bg-emerald-900/50 text-white hover:bg-emerald-900/80'
                    }`}
                  >
                    {speakerEnabled && speakerSettings.gpsTurnByTurnVoice ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Salir de navegación en vivo"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-emerald-950/55 hover:bg-emerald-950/80 text-white flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-emerald-700 dark:bg-emerald-800 text-white rounded-2xl shadow-2xl border border-emerald-500/40 overflow-hidden">
                  <div className="px-2.5 py-1.5 sm:p-3 flex items-center gap-2 sm:gap-3.5">
                    {/* Compact Turn Icon */}
                    <div className="w-10 h-10 sm:w-13 sm:h-13 bg-emerald-900/50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 border border-white/15">
                      {routeLoading ? (
                        <Loader2 className="w-5 h-5 sm:w-7 sm:h-7 animate-spin text-emerald-100" />
                      ) : arrivedAtStop ? (
                        renderManeuverIcon('arrive', 'w-6 h-6 sm:w-8 sm:h-8 text-amber-300')
                      ) : (
                        renderManeuverIcon(currentStep?.iconKind || 'straight', 'w-6 h-6 sm:w-8 sm:h-8 text-white')
                      )}
                    </div>

                    {/* Distance + Street Instruction */}
                    <div
                      onClick={() =>
                        gpsSettings.showNextStepStrip &&
                        routeData?.steps.length &&
                        setShowStepsDrawer((prev) => !prev)
                      }
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg sm:text-2xl font-black tracking-tight tabular-nums leading-none">
                          {routeLoading
                            ? '...'
                            : arrivedAtStop
                            ? 'Llegaste'
                            : formatDistanceEs(distanceToTurnMeters)}
                        </span>
                        {isRecalculating && (
                          <span className="text-[10px] font-bold bg-amber-400 text-amber-950 px-1.5 py-0.5 rounded-md">
                            Recalculando...
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-50 leading-tight mt-0.5 line-clamp-1 sm:line-clamp-2">
                        {routeLoading
                          ? 'Calculando indicaciones...'
                          : routeError
                          ? routeError
                          : arrivedAtStop
                          ? `Destino: Paquete #${targetStop.originalNumber}`
                          : currentStep?.instruction || 'Sigue la línea azul hacia el destino'}
                      </p>
                    </div>

                    {/* Top-right Controls (Horizontal row to save vertical space on mobile) */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowStepsDrawer(false);
                          setIsBannerHidden(true);
                        }}
                        aria-label="Ocultar cuadro de dirección"
                        title="Ocultar indicaciones"
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-emerald-900/45 hover:bg-emerald-900/75 text-white flex items-center justify-center transition-colors"
                      >
                        <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={onToggleSpeaker}
                        aria-label={speakerEnabled ? 'Silenciar indicaciones' : 'Activar voz'}
                        title={speakerEnabled ? 'Voz activada' : 'Activar voz'}
                        className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
                          speakerEnabled && speakerSettings.gpsTurnByTurnVoice
                            ? 'bg-amber-400 text-amber-950 shadow-sm'
                            : 'bg-emerald-900/50 text-white hover:bg-emerald-900/80'
                        }`}
                      >
                        {speakerEnabled && speakerSettings.gpsTurnByTurnVoice ? (
                          <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        ) : (
                          <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Salir de navegación en vivo"
                        title="Volver al resumen"
                        className="min-h-[44px] min-w-[44px] rounded-xl bg-emerald-950/50 hover:bg-emerald-950/80 text-white flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Secondary "Luego" Strip + Step List Toggle */}
                  {gpsSettings.showNextStepStrip && !routeLoading && routeData && (
                    <div className="bg-emerald-900/60 px-3 sm:px-4 py-1 sm:py-1.5 flex items-center justify-between gap-2 text-[11px] sm:text-xs border-t border-white/10">
                      <div className="flex items-center gap-1.5 min-w-0 text-emerald-100">
                        {followingStep && followingStep !== currentStep && !arrivedAtStop ? (
                          <>
                            <span className="font-bold text-emerald-300 shrink-0">Luego:</span>
                            {renderManeuverIcon(followingStep.iconKind, 'w-3.5 h-3.5 shrink-0')}
                            <span className="truncate font-medium">{followingStep.instruction}</span>
                          </>
                        ) : (
                          <span className="truncate font-medium">
                            {driverPosition?.isLiveGps
                              ? 'GPS en vivo siguiendo tu recorrido'
                              : 'Vista previa — activa GPS o pulsa Simular'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowStepsDrawer((prev) => !prev)}
                        className="flex items-center gap-1 font-bold text-white hover:text-emerald-200 shrink-0 py-0.5"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Pasos ({routeData.steps.length})</span>
                        {showStepsDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* Expandable Street-by-Street Turn Drawer */}
                {gpsSettings.showNextStepStrip && showStepsDrawer && routeData && (
                  <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 max-h-52 sm:max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800">
                    {routeData.steps.map((step, idx) => {
                      const isCurrent = idx === activeStepIdx + 1 || (activeStepIdx === routeData.steps.length - 1 && idx === activeStepIdx);
                      return (
                        <div
                          key={step.id}
                          className={`px-3.5 py-2 flex items-center gap-2.5 text-xs ${
                            isCurrent ? 'bg-emerald-50 dark:bg-emerald-950/60' : ''
                          }`}
                        >
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                            }`}
                          >
                            {renderManeuverIcon(step.iconKind, 'w-3.5 h-3.5')}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900 dark:text-slate-100 leading-snug">
                              {step.instruction}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400">
                              {formatDistanceEs(step.distanceMeters)} • {formatDurationEs(step.durationSeconds)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Compact No GPS Warning Banner */}
                {gpsSettings.showNoGpsBanner && !currentGps && !isSimulating && (
                  <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-700 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate">
                      Sin GPS activo. Actívalo o prueba con <strong>Simular</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={onToggleGps}
                      className="bg-sky-500 hover:bg-sky-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0"
                    >
                      Activar GPS
                    </button>
                  </div>
                )}
              </>
            )
          ) : (
            <div className="bg-emerald-700 text-white rounded-2xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-sm sm:text-base">¡Recorrido completado!</h3>
                <p className="text-xs text-emerald-100">No quedan entregas pendientes en el circuito.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-4 rounded-xl bg-white text-emerald-900 font-black text-xs"
              >
                Volver
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FLOATING SPEED & MAP CONTROLS ABOVE BOTTOM SHEET */}
      {targetStop && (() => {
        const hasAnyBottomAction =
          gpsSettings.showBottomDeliveredBtn ||
          gpsSettings.showBottomPhotoBtn ||
          gpsSettings.showBottomFailedBtn ||
          gpsSettings.showBottomWhatsAppBtn ||
          gpsSettings.showBottomWazeBtn ||
          gpsSettings.showBottomGoogleMapsBtn;
        return (
          <div
            className={`absolute ${
              hasAnyBottomAction ? 'bottom-[196px] sm:bottom-[178px]' : 'bottom-[128px] sm:bottom-[122px]'
            } left-3 right-3 z-[500] max-w-2xl mx-auto flex items-end justify-between pointer-events-none`}
          >
            {/* Speedometer Badge */}
            {gpsSettings.showSpeedometer ? (
              <div className="pointer-events-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-gray-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 shadow-xl flex flex-col items-center min-w-[68px]">
                <span className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                  {driverPosition?.speedKmh ?? 0}
                </span>
                <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase mt-0.5">km/h</span>
              </div>
            ) : (
              <div />
            )}

            {/* Right Controls: Vertical Zoom +/- stacked above Compass / Reroute / Simular / Centrar */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              {gpsSettings.showZoomControls && (
                <div className="flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-gray-200 dark:border-slate-700 rounded-2xl shadow-xl overflow-hidden divide-y divide-gray-200 dark:divide-slate-700">
                  <button
                    type="button"
                    onClick={() => handleZoomBy(1)}
                    aria-label="Acercar mapa"
                    title="Acercar zoom (+)"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZoomBy(-1)}
                    aria-label="Alejar mapa"
                    title="Alejar zoom (-)"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-800 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Minus className="w-4 h-4" strokeWidth={2.5} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                {gpsSettings.showSimulateButton && routeData && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSimulating) {
                        setIsSimulating(false);
                      } else {
                        if (simProgressRef.current.segIdx >= routeData.coordinates.length - 1) {
                          simProgressRef.current = { segIdx: 0, t: 0 };
                        }
                        setIsFollowing(true);
                        setCompassMode('heading');
                        setIsSimulating(true);
                      }
                    }}
                    className={`min-h-[44px] px-3.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-1.5 border transition-colors ${
                      isSimulating
                        ? 'bg-amber-500 hover:bg-amber-600 text-amber-950 border-amber-400'
                        : 'bg-white/95 dark:bg-slate-900/95 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-900 dark:text-slate-100 border-gray-200 dark:border-slate-700'
                    }`}
                    title="Simular avance por la ruta en el mapa"
                  >
                    {isSimulating ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current text-emerald-600 dark:text-emerald-400" />}
                    <span>{isSimulating ? 'Detener' : 'Simular'}</span>
                  </button>
                )}

                {gpsSettings.showCompassButton && (
                  <button
                    type="button"
                    onClick={handleToggleCompassMode}
                    aria-label={compassMode === 'heading' ? 'Cambiar a norte arriba' : 'Rotar mapa según vehículo'}
                    title={
                      compassMode === 'heading'
                        ? 'Mapa gira contigo (tocar para Norte fijo)'
                        : compassMode === 'manual'
                        ? 'Rotación manual (tocar para volver a girar con el vehículo)'
                        : 'Norte fijo (tocar para girar con el vehículo)'
                    }
                    className={`min-h-[44px] min-w-[44px] rounded-2xl shadow-xl flex items-center justify-center border transition-colors ${
                      compassMode === 'heading'
                        ? 'bg-white/95 dark:bg-slate-900/95 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800'
                        : compassMode === 'manual'
                        ? 'bg-amber-500 text-amber-950 border-amber-400'
                        : 'bg-slate-800 text-white border-slate-700'
                    }`}
                  >
                    <div
                      ref={compassIconRef}
                      style={{
                        transform: `rotate(${-mapRotationRef.current}deg)`,
                      }}
                      className="relative flex items-center justify-center"
                    >
                      <Compass className="w-5 h-5" />
                    </div>
                  </button>
                )}

                {gpsSettings.showRerouteButton && (
                  <button
                    type="button"
                    onClick={handleManualReroute}
                    aria-label="Recalcular ruta"
                    title="Recalcular ruta desde posición actual"
                    className="min-h-[44px] min-w-[44px] rounded-2xl bg-white/95 dark:bg-slate-900/95 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700 shadow-xl flex items-center justify-center"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin text-emerald-600' : ''}`} />
                  </button>
                )}

                {!isFollowing && (
                  <button
                    type="button"
                    onClick={handleRecenter}
                    className="min-h-[44px] px-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white shadow-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <LocateFixed className="w-4 h-4" />
                    <span>Centrar</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* BOTTOM DRIVER SHEET */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] p-2.5 sm:p-4 pointer-events-none">
        <div className="max-w-2xl mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700 p-3.5 sm:p-4 space-y-3 pointer-events-auto">
          {targetStop ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-emerald-600 text-white font-black text-xs px-2.5 py-0.5 rounded-lg">
                      #{targetStop.originalNumber}
                    </span>
                    <span className="text-xs font-extrabold text-gray-700 dark:text-slate-300">
                      Parada {targetIndexInCircuit + 1} de {activeStops.length}
                    </span>
                    {targetStop.recipientName && (
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                        • {targetStop.recipientName}
                      </span>
                    )}
                  </div>
                  {gpsSettings.showBottomAddress && (
                    <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-slate-100 truncate mt-1">
                      {targetStop.address}
                    </p>
                  )}
                </div>

                {/* Live ETA + Remaining Distance */}
                {gpsSettings.showBottomEta && (
                  <div className="text-right shrink-0">
                    <p className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 tabular-nums leading-tight">
                      {formatDurationEs(remainingSec)}
                    </p>
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-slate-400 tabular-nums">
                      {formatDistanceEs(remainingDistMeters)} • {etaClock}
                    </p>
                  </div>
                )}
              </div>

              {/* 1-Tap Driver Actions */}
              {(gpsSettings.showBottomDeliveredBtn ||
                gpsSettings.showBottomPhotoBtn ||
                gpsSettings.showBottomFailedBtn ||
                gpsSettings.showBottomWhatsAppBtn ||
                gpsSettings.showBottomWazeBtn ||
                gpsSettings.showBottomGoogleMapsBtn) && (
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {gpsSettings.showBottomDeliveredBtn && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(targetStop.id, 'delivered')}
                      className="flex-1 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 sm:px-3 py-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Entregado</span>
                    </button>
                  )}

                  {gpsSettings.showBottomPhotoBtn && (
                    <button
                      type="button"
                      onClick={() => onOpenPhotoModal(targetStop)}
                      className="min-h-[44px] min-w-[38px] sm:min-w-[44px] px-2.5 sm:px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                      title="Foto de entrega"
                      aria-label="Foto de entrega"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Foto</span>
                    </button>
                  )}

                  {gpsSettings.showBottomFailedBtn && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(targetStop.id, 'failed')}
                      className="min-h-[44px] min-w-[38px] sm:min-w-[44px] px-2.5 sm:px-3.5 py-2 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                      title="Marcar como no entregado"
                      aria-label="Marcar como no entregado"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">Fallida</span>
                    </button>
                  )}

                  {gpsSettings.showBottomWhatsAppBtn && (() => {
                    const waUrl = buildWhatsAppUrl(targetStop.phone);
                    if (waUrl) {
                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] min-w-[38px] sm:min-w-[44px] px-2 sm:px-2.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center transition-colors shrink-0 shadow-sm"
                          title={`Contactar por WhatsApp (${targetStop.phone})`}
                          aria-label={`Contactar por WhatsApp (${targetStop.phone})`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      );
                    }
                    return (
                      <button
                        type="button"
                        disabled
                        className="min-h-[44px] min-w-[38px] sm:min-w-[44px] px-2 sm:px-2.5 bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 rounded-2xl text-xs font-bold flex items-center justify-center shrink-0 opacity-60 cursor-not-allowed"
                        title="Este paquete no tiene teléfono guardado"
                        aria-label="WhatsApp no disponible: sin teléfono"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    );
                  })()}

                  {gpsSettings.showBottomWazeBtn && (
                    <a
                      href={`https://waze.com/ul?ll=${targetStop.lat},${targetStop.lng}&navigate=yes`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] min-w-[38px] sm:min-w-[44px] px-2 sm:px-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-xs font-bold flex items-center justify-center transition-colors shrink-0"
                      title="Abrir en Waze externo"
                      aria-label="Abrir en Waze externo"
                    >
                      <Navigation className="w-4 h-4 transform rotate-45" />
                    </a>
                  )}

                  {gpsSettings.showBottomGoogleMapsBtn && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${targetStop.lat},${targetStop.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] min-w-[38px] sm:min-w-[44px] px-2 sm:px-2.5 bg-gray-800 dark:bg-slate-700 hover:bg-gray-900 dark:hover:bg-slate-600 text-white rounded-2xl text-xs font-bold flex items-center justify-center transition-colors shrink-0"
                      title="Abrir en Google Maps externo"
                      aria-label="Abrir en Google Maps externo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-gray-900 dark:text-slate-100">Todas las paradas completadas</p>
                <p className="text-xs text-gray-500 dark:text-slate-400">Guarda el recorrido o vuelve a la lista.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onFinishRoute();
                  onClose();
                }}
                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-2xl text-xs font-black"
              >
                Finalizar y Guardar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

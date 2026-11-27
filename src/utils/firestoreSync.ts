import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  deleteField,
  limit,
  Unsubscribe,
  FieldValue,
  Timestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CoverageStatus, DeliveryItem, DeliveryStatus, DriverProfile, RouteSession } from '../types';

const DELIVERIES_COLLECTION = 'deliveries';
const DRIVERS_COLLECTION = 'drivers';
const ROUTES_COLLECTION = 'routes';

const MAX_ID_LEN = 128;
const MAX_ADDRESS_LEN = 500;
const MAX_PROVINCE_LEN = 100;
const MAX_RECIPIENT_LEN = 120;
const MAX_PHONE_LEN = 50;
const MAX_NOTES_LEN = 1000;
const MAX_FAILURE_REASON_LEN = 300;
const MAX_DRIVER_NAME_LEN = 100;
const MAX_PHOTO_LEN = 600000;
const MAX_PHOTO_AT_LEN = 100;
const MAX_ROUTE_NAME_LEN = 200;
const MAX_ROUTE_DATE_LEN = 100;
const MAX_ROUTE_ITEMS = 200;

const VALID_STATUSES: DeliveryStatus[] = ['pending', 'in_transit', 'delivered', 'failed'];
const VALID_COVERAGE: CoverageStatus[] = [
  'in_coverage',
  'out_of_coverage',
  'incomplete',
  'pending_validation',
];
const VALID_ROUTE_STATUSES: RouteSession['status'][] = ['active', 'paused', 'completed', 'saved'];

const syncedDeliveryIds = new Set<string>();
const syncedRouteIds = new Set<string>();
const syncedDriverIds = new Set<string>();

export function resetFirestoreSyncCache(): void {
  syncedDeliveryIds.clear();
  syncedRouteIds.clear();
  syncedDriverIds.clear();
}

export function sanitizeDocId(rawId: string, prefix = 'item'): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ID_LEN);
  if (cleaned.length > 0) return cleaned;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.slice(0, MAX_ID_LEN);
}

function safeLatLng(lat: unknown, lng: unknown): { lat: number; lng: number; valid: boolean } {
  const nLat = typeof lat === 'number' ? lat : Number(lat);
  const nLng = typeof lng === 'number' ? lng : Number(lng);
  if (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180
  ) {
    return { lat: nLat, lng: nLng, valid: true };
  }
  return { lat: 0, lng: 0, valid: false };
}

function sanitizeStatus(status: unknown): DeliveryStatus {
  return VALID_STATUSES.includes(status as DeliveryStatus) ? (status as DeliveryStatus) : 'pending';
}

function sanitizeCoverage(coverage: unknown): CoverageStatus {
  return VALID_COVERAGE.includes(coverage as CoverageStatus)
    ? (coverage as CoverageStatus)
    : 'in_coverage';
}

function sanitizeOptionalString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function sanitizeDriverName(name: string): string {
  return String(name || '').trim().slice(0, MAX_DRIVER_NAME_LEN) || 'Conductor';
}

function buildDeliveryCreatePayload(
  item: DeliveryItem,
  driver: DriverProfile
): Record<string, unknown> {
  const id = sanitizeDocId(item.id, 'item');
  const coords = safeLatLng(item.lat, item.lng);
  const hasLocation =
    item.hasLocation !== undefined ? Boolean(item.hasLocation) && coords.valid : coords.valid;

  const payload: Record<string, unknown> = {
    id,
    originalNumber: Number.isFinite(item.originalNumber) ? item.originalNumber : 0,
    address: (typeof item.address === 'string' && item.address.trim()
      ? item.address.trim()
      : 'Sin dirección'
    ).slice(0, MAX_ADDRESS_LEN),
    lat: coords.lat,
    lng: coords.lng,
    hasLocation,
    status: sanitizeStatus(item.status),
    coverageStatus: sanitizeCoverage(item.coverageStatus),
    orderIndex: Number.isFinite(item.orderIndex) ? item.orderIndex : 0,
    assignedDriverId: sanitizeDocId(driver.id, 'driver'),
    assignedDriverName: sanitizeDriverName(driver.driverName),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const province = sanitizeOptionalString(item.province, MAX_PROVINCE_LEN);
  if (province) payload.province = province;

  const recipientName = sanitizeOptionalString(item.recipientName, MAX_RECIPIENT_LEN);
  if (recipientName) payload.recipientName = recipientName;

  const phone = sanitizeOptionalString(item.phone, MAX_PHONE_LEN);
  if (phone) payload.phone = phone;

  const notes = sanitizeOptionalString(item.notes, MAX_NOTES_LEN);
  if (notes) payload.notes = notes;

  const failureReason = sanitizeOptionalString(item.failureReason, MAX_FAILURE_REASON_LEN);
  if (failureReason) payload.failureReason = failureReason;

  if (typeof item.distanceFromPrevKm === 'number' && Number.isFinite(item.distanceFromPrevKm)) {
    payload.distanceFromPrevKm = item.distanceFromPrevKm;
  }
  if (typeof item.estimatedMinutes === 'number' && Number.isFinite(item.estimatedMinutes)) {
    payload.estimatedMinutes = item.estimatedMinutes;
  }
  if (
    typeof item.deliveryPhoto === 'string' &&
    item.deliveryPhoto.length > 0 &&
    item.deliveryPhoto.length <= MAX_PHOTO_LEN
  ) {
    payload.deliveryPhoto = item.deliveryPhoto;
    const photoAt = sanitizeOptionalString(item.deliveryPhotoAt, MAX_PHOTO_AT_LEN);
    if (photoAt) payload.deliveryPhotoAt = photoAt;
  }

  return payload;
}

function buildDeliveryFullUpdatePayload(
  item: DeliveryItem,
  driver: DriverProfile
): Record<string, unknown> {
  const coords = safeLatLng(item.lat, item.lng);
  const hasLocation =
    item.hasLocation !== undefined ? Boolean(item.hasLocation) && coords.valid : coords.valid;

  const validPhoto =
    typeof item.deliveryPhoto === 'string' &&
    item.deliveryPhoto.length > 0 &&
    item.deliveryPhoto.length <= MAX_PHOTO_LEN
      ? item.deliveryPhoto
      : undefined;

  return {
    originalNumber: Number.isFinite(item.originalNumber) ? item.originalNumber : 0,
    address: (typeof item.address === 'string' && item.address.trim()
      ? item.address.trim()
      : 'Sin dirección'
    ).slice(0, MAX_ADDRESS_LEN),
    lat: coords.lat,
    lng: coords.lng,
    hasLocation,
    status: sanitizeStatus(item.status),
    coverageStatus: sanitizeCoverage(item.coverageStatus),
    orderIndex: Number.isFinite(item.orderIndex) ? item.orderIndex : 0,
    province: sanitizeOptionalString(item.province, MAX_PROVINCE_LEN) ?? deleteField(),
    recipientName: sanitizeOptionalString(item.recipientName, MAX_RECIPIENT_LEN) ?? deleteField(),
    phone: sanitizeOptionalString(item.phone, MAX_PHONE_LEN) ?? deleteField(),
    notes: sanitizeOptionalString(item.notes, MAX_NOTES_LEN) ?? deleteField(),
    failureReason: sanitizeOptionalString(item.failureReason, MAX_FAILURE_REASON_LEN) ?? deleteField(),
    distanceFromPrevKm:
      typeof item.distanceFromPrevKm === 'number' && Number.isFinite(item.distanceFromPrevKm)
        ? item.distanceFromPrevKm
        : deleteField(),
    estimatedMinutes:
      typeof item.estimatedMinutes === 'number' && Number.isFinite(item.estimatedMinutes)
        ? item.estimatedMinutes
        : deleteField(),
    deliveryPhoto: validPhoto ?? deleteField(),
    deliveryPhotoAt:
      validPhoto && item.deliveryPhotoAt
        ? sanitizeOptionalString(item.deliveryPhotoAt, MAX_PHOTO_AT_LEN) ?? deleteField()
        : deleteField(),
    assignedDriverId: sanitizeDocId(driver.id, 'driver'),
    assignedDriverName: sanitizeDriverName(driver.driverName),
    updatedAt: serverTimestamp(),
  };
}

function docToDeliveryItem(data: Record<string, unknown>, docId: string): DeliveryItem {
  const coords = safeLatLng(data.lat, data.lng);
  return {
    id: typeof data.id === 'string' ? data.id : docId,
    originalNumber: typeof data.originalNumber === 'number' ? data.originalNumber : 0,
    address: typeof data.address === 'string' ? data.address : 'Sin dirección',
    lat: coords.lat,
    lng: coords.lng,
    hasLocation: typeof data.hasLocation === 'boolean' ? data.hasLocation : coords.valid,
    status: sanitizeStatus(data.status),
    coverageStatus: sanitizeCoverage(data.coverageStatus),
    province: typeof data.province === 'string' ? data.province : 'San José',
    recipientName: typeof data.recipientName === 'string' ? data.recipientName : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
    orderIndex: typeof data.orderIndex === 'number' ? data.orderIndex : 0,
    distanceFromPrevKm:
      typeof data.distanceFromPrevKm === 'number' ? data.distanceFromPrevKm : undefined,
    estimatedMinutes: typeof data.estimatedMinutes === 'number' ? data.estimatedMinutes : undefined,
    failureReason: typeof data.failureReason === 'string' ? data.failureReason : undefined,
    deliveryPhoto: typeof data.deliveryPhoto === 'string' ? data.deliveryPhoto : undefined,
    deliveryPhotoAt: typeof data.deliveryPhotoAt === 'string' ? data.deliveryPhotoAt : undefined,
  };
}

function docToRouteSession(data: Record<string, unknown>, docId: string): RouteSession {
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: DeliveryItem[] = rawItems.map((entry, idx) => {
    const rec = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return docToDeliveryItem(rec, typeof rec.id === 'string' ? rec.id : `item-${idx}`);
  });

  const status = VALID_ROUTE_STATUSES.includes(data.status as RouteSession['status'])
    ? (data.status as RouteSession['status'])
    : 'saved';

  return {
    id: typeof data.id === 'string' ? data.id : docId,
    name: typeof data.name === 'string' ? data.name : 'Recorrido guardado',
    date: typeof data.date === 'string' ? data.date : new Date().toISOString(),
    items,
    status,
    totalDistanceKm: typeof data.totalDistanceKm === 'number' ? data.totalDistanceKm : 0,
    totalMinutes: typeof data.totalMinutes === 'number' ? data.totalMinutes : 0,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
  };
}

function docToDriverProfile(data: Record<string, unknown>, docId: string): DriverProfile {
  const created = data.createdAt;
  let createdAtMs: number | undefined;
  if (created instanceof Timestamp) {
    createdAtMs = created.toMillis();
  }
  return {
    id: typeof data.id === 'string' ? data.id : docId,
    driverName: sanitizeDriverName(typeof data.driverName === 'string' ? data.driverName : 'Conductor'),
    active: typeof data.active === 'boolean' ? data.active : true,
    createdAtMs,
  };
}

// --- Active Driver Roster Subscriptions & Actions ---

export function subscribeToActiveDrivers(
  onData: (drivers: DriverProfile[], meta: { fromCache: boolean }) => void,
  onSyncError?: (error: unknown) => void
): Unsubscribe {
  const q = query(
    collection(db, DRIVERS_COLLECTION),
    where('active', '==', true),
    limit(100)
  );
  return onSnapshot(
    q,
    snapshot => {
      const nextIds = new Set<string>();
      const list: DriverProfile[] = [];
      snapshot.forEach(docSnap => {
        nextIds.add(docSnap.id);
        list.push(docToDriverProfile(docSnap.data() as Record<string, unknown>, docSnap.id));
      });
      syncedDriverIds.clear();
      nextIds.forEach(id => syncedDriverIds.add(id));
      list.sort((a, b) => a.driverName.localeCompare(b.driverName, 'es'));
      onData(list, { fromCache: snapshot.metadata.fromCache });
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, DRIVERS_COLLECTION);
      } catch (wrapped) {
        if (onSyncError) onSyncError(wrapped);
      }
    }
  );
}

export async function registerOrSelectDriverInCloud(
  rawName: string,
  existingDrivers: DriverProfile[]
): Promise<DriverProfile> {
  const cleanName = sanitizeDriverName(rawName);
  const existingMatch = existingDrivers.find(
    d => d.active && d.driverName.trim().toLowerCase() === cleanName.toLowerCase()
  );
  if (existingMatch) {
    return existingMatch;
  }

  const slug = cleanName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const id = sanitizeDocId(
    `drv-${slug || 'user'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    'drv'
  );
  const path = `${DRIVERS_COLLECTION}/${id}`;

  try {
    await setDoc(doc(db, DRIVERS_COLLECTION, id), {
      id,
      driverName: cleanName,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    syncedDriverIds.add(id);
    return { id, driverName: cleanName, active: true, createdAtMs: Date.now() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDriverFromCloud(driverId: string): Promise<void> {
  const cleanId = sanitizeDocId(driverId, 'drv');
  const path = `${DRIVERS_COLLECTION}/${cleanId}`;
  try {
    await deleteDoc(doc(db, DRIVERS_COLLECTION, cleanId));
    syncedDriverIds.delete(cleanId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Shared Fleet Deliveries Subscriptions & Mutations ---

export function subscribeToSharedDeliveries(
  onData: (items: DeliveryItem[]) => void,
  onSyncError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, DELIVERIES_COLLECTION), limit(500));
  return onSnapshot(
    q,
    snapshot => {
      const nextIds = new Set<string>();
      const list: DeliveryItem[] = [];
      snapshot.forEach(docSnap => {
        nextIds.add(docSnap.id);
        list.push(docToDeliveryItem(docSnap.data() as Record<string, unknown>, docSnap.id));
      });
      syncedDeliveryIds.clear();
      nextIds.forEach(id => syncedDeliveryIds.add(id));
      list.sort((a, b) => a.orderIndex - b.orderIndex || a.originalNumber - b.originalNumber);
      onData(list);
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, DELIVERIES_COLLECTION);
      } catch (wrapped) {
        if (onSyncError) onSyncError(wrapped);
      }
    }
  );
}

export function subscribeToSharedRoutes(
  onData: (routes: RouteSession[]) => void,
  onSyncError?: (error: unknown) => void
): Unsubscribe {
  const q = query(collection(db, ROUTES_COLLECTION), limit(200));
  return onSnapshot(
    q,
    snapshot => {
      const nextIds = new Set<string>();
      const list: RouteSession[] = [];
      snapshot.forEach(docSnap => {
        nextIds.add(docSnap.id);
        list.push(docToRouteSession(docSnap.data() as Record<string, unknown>, docSnap.id));
      });
      syncedRouteIds.clear();
      nextIds.forEach(id => syncedRouteIds.add(id));
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, ROUTES_COLLECTION);
      } catch (wrapped) {
        if (onSyncError) onSyncError(wrapped);
      }
    }
  );
}

export async function createDeliveriesInCloud(
  items: DeliveryItem[],
  driver: DriverProfile
): Promise<void> {
  if (items.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(item => {
      const id = sanitizeDocId(item.id, 'item');
      const docRef = doc(db, DELIVERIES_COLLECTION, id);
      if (syncedDeliveryIds.has(id)) {
        batch.update(docRef, buildDeliveryFullUpdatePayload({ ...item, id }, driver));
      } else {
        batch.set(docRef, buildDeliveryCreatePayload({ ...item, id }, driver));
        syncedDeliveryIds.add(id);
      }
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, DELIVERIES_COLLECTION);
    }
  }
}

export async function updateDeliveryStatusInCloud(
  item: DeliveryItem,
  status: DeliveryStatus,
  failureReason: string | undefined,
  driver: DriverProfile
): Promise<void> {
  const id = sanitizeDocId(item.id, 'item');
  const path = `${DELIVERIES_COLLECTION}/${id}`;
  if (!syncedDeliveryIds.has(id)) {
    await createDeliveriesInCloud([{ ...item, id, status, failureReason }], driver);
    return;
  }
  const cleanReason = sanitizeOptionalString(failureReason, MAX_FAILURE_REASON_LEN);
  try {
    await updateDoc(doc(db, DELIVERIES_COLLECTION, id), {
      status: sanitizeStatus(status),
      failureReason: cleanReason ?? deleteField(),
      assignedDriverId: sanitizeDocId(driver.id, 'driver'),
      assignedDriverName: sanitizeDriverName(driver.driverName),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateDeliveryPhotoInCloud(
  item: DeliveryItem,
  photoDataUrl: string | undefined,
  photoAt: string | undefined,
  markDelivered: boolean,
  driver: DriverProfile
): Promise<{ skippedPhotoTooLarge: boolean }> {
  const id = sanitizeDocId(item.id, 'item');
  const path = `${DELIVERIES_COLLECTION}/${id}`;
  const validPhoto =
    typeof photoDataUrl === 'string' && photoDataUrl.length > 0 && photoDataUrl.length <= MAX_PHOTO_LEN
      ? photoDataUrl
      : undefined;
  const skippedPhotoTooLarge = Boolean(photoDataUrl && !validPhoto);

  if (!syncedDeliveryIds.has(id)) {
    await createDeliveriesInCloud(
      [
        {
          ...item,
          id,
          deliveryPhoto: validPhoto,
          deliveryPhotoAt: validPhoto ? photoAt : undefined,
          status: markDelivered ? 'delivered' : item.status,
          failureReason: markDelivered ? undefined : item.failureReason,
        },
      ],
      driver
    );
    return { skippedPhotoTooLarge };
  }

  try {
    if (skippedPhotoTooLarge) {
      if (markDelivered) {
        await updateDoc(doc(db, DELIVERIES_COLLECTION, id), {
          status: 'delivered',
          failureReason: deleteField(),
          assignedDriverId: sanitizeDocId(driver.id, 'driver'),
          assignedDriverName: sanitizeDriverName(driver.driverName),
          updatedAt: serverTimestamp(),
        });
      }
      return { skippedPhotoTooLarge: true };
    }

    const payload: Record<string, FieldValue | string> = {
      deliveryPhoto: validPhoto ?? deleteField(),
      deliveryPhotoAt:
        validPhoto && photoAt ? photoAt.slice(0, MAX_PHOTO_AT_LEN) : deleteField(),
      assignedDriverId: sanitizeDocId(driver.id, 'driver'),
      assignedDriverName: sanitizeDriverName(driver.driverName),
      updatedAt: serverTimestamp(),
    };
    if (markDelivered) {
      payload.status = 'delivered';
      payload.failureReason = deleteField();
    }

    await updateDoc(doc(db, DELIVERIES_COLLECTION, id), payload);
    return { skippedPhotoTooLarge: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateDeliveryDetailsInCloud(
  updated: DeliveryItem,
  driver: DriverProfile
): Promise<void> {
  const id = sanitizeDocId(updated.id, 'item');
  const path = `${DELIVERIES_COLLECTION}/${id}`;
  if (!syncedDeliveryIds.has(id)) {
    await createDeliveriesInCloud([{ ...updated, id }], driver);
    return;
  }

  const coords = safeLatLng(updated.lat, updated.lng);
  const hasLocation =
    updated.hasLocation !== undefined ? Boolean(updated.hasLocation) && coords.valid : coords.valid;

  const payload: Record<string, unknown> = {
    originalNumber: Number.isFinite(updated.originalNumber) ? updated.originalNumber : 0,
    address: (typeof updated.address === 'string' && updated.address.trim()
      ? updated.address.trim()
      : 'Sin dirección'
    ).slice(0, MAX_ADDRESS_LEN),
    lat: coords.lat,
    lng: coords.lng,
    hasLocation,
    status: sanitizeStatus(updated.status),
    coverageStatus: sanitizeCoverage(updated.coverageStatus),
    province: sanitizeOptionalString(updated.province, MAX_PROVINCE_LEN) ?? deleteField(),
    recipientName:
      sanitizeOptionalString(updated.recipientName, MAX_RECIPIENT_LEN) ?? deleteField(),
    phone: sanitizeOptionalString(updated.phone, MAX_PHONE_LEN) ?? deleteField(),
    notes: sanitizeOptionalString(updated.notes, MAX_NOTES_LEN) ?? deleteField(),
    failureReason:
      sanitizeOptionalString(updated.failureReason, MAX_FAILURE_REASON_LEN) ?? deleteField(),
    assignedDriverId: sanitizeDocId(driver.id, 'driver'),
    assignedDriverName: sanitizeDriverName(driver.driverName),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, DELIVERIES_COLLECTION, id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncOptimizedOrderInCloud(
  optimizedItems: DeliveryItem[],
  driver: DriverProfile
): Promise<void> {
  if (optimizedItems.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < optimizedItems.length; i += CHUNK_SIZE) {
    const chunk = optimizedItems.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(item => {
      const id = sanitizeDocId(item.id, 'item');
      const docRef = doc(db, DELIVERIES_COLLECTION, id);
      if (!syncedDeliveryIds.has(id)) {
        batch.set(docRef, buildDeliveryCreatePayload({ ...item, id }, driver));
        syncedDeliveryIds.add(id);
      } else {
        batch.update(docRef, {
          orderIndex: Number.isFinite(item.orderIndex) ? item.orderIndex : 0,
          distanceFromPrevKm:
            typeof item.distanceFromPrevKm === 'number' && Number.isFinite(item.distanceFromPrevKm)
              ? item.distanceFromPrevKm
              : deleteField(),
          estimatedMinutes:
            typeof item.estimatedMinutes === 'number' && Number.isFinite(item.estimatedMinutes)
              ? item.estimatedMinutes
              : deleteField(),
          assignedDriverId: sanitizeDocId(driver.id, 'driver'),
          assignedDriverName: sanitizeDriverName(driver.driverName),
          updatedAt: serverTimestamp(),
        });
      }
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, DELIVERIES_COLLECTION);
    }
  }
}

export async function deleteDeliveryItemFromCloud(id: string): Promise<void> {
  const cleanId = sanitizeDocId(id, 'item');
  const path = `${DELIVERIES_COLLECTION}/${cleanId}`;
  try {
    await deleteDoc(doc(db, DELIVERIES_COLLECTION, cleanId));
    syncedDeliveryIds.delete(cleanId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteDeliveriesFromCloud(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(rawId => {
      const cleanId = sanitizeDocId(rawId, 'item');
      batch.delete(doc(db, DELIVERIES_COLLECTION, cleanId));
      syncedDeliveryIds.delete(cleanId);
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, DELIVERIES_COLLECTION);
    }
  }
}

export async function replaceActiveDeliveriesInCloud(
  previousIds: string[],
  nextItems: DeliveryItem[],
  driver: DriverProfile
): Promise<void> {
  const nextIdSet = new Set(nextItems.map(i => sanitizeDocId(i.id, 'item')));
  const toDelete = previousIds
    .map(id => sanitizeDocId(id, 'item'))
    .filter(id => !nextIdSet.has(id));

  if (toDelete.length > 0) {
    await deleteDeliveriesFromCloud(toDelete);
  }
  if (nextItems.length > 0) {
    await createDeliveriesInCloud(nextItems, driver);
  }
}

function buildRouteItemSnapshot(item: DeliveryItem): Record<string, unknown> {
  const coords = safeLatLng(item.lat, item.lng);
  const out: Record<string, unknown> = {
    id: sanitizeDocId(item.id, 'item'),
    originalNumber: Number.isFinite(item.originalNumber) ? item.originalNumber : 0,
    address: (item.address || 'Sin dirección').slice(0, MAX_ADDRESS_LEN),
    lat: coords.lat,
    lng: coords.lng,
    hasLocation:
      item.hasLocation !== undefined ? Boolean(item.hasLocation) && coords.valid : coords.valid,
    status: sanitizeStatus(item.status),
    coverageStatus: sanitizeCoverage(item.coverageStatus),
    orderIndex: Number.isFinite(item.orderIndex) ? item.orderIndex : 0,
  };
  const province = sanitizeOptionalString(item.province, MAX_PROVINCE_LEN);
  if (province) out.province = province;
  const recipientName = sanitizeOptionalString(item.recipientName, MAX_RECIPIENT_LEN);
  if (recipientName) out.recipientName = recipientName;
  const phone = sanitizeOptionalString(item.phone, MAX_PHONE_LEN);
  if (phone) out.phone = phone;
  const notes = sanitizeOptionalString(item.notes, MAX_NOTES_LEN);
  if (notes) out.notes = notes;
  const failureReason = sanitizeOptionalString(item.failureReason, MAX_FAILURE_REASON_LEN);
  if (failureReason) out.failureReason = failureReason;
  if (typeof item.distanceFromPrevKm === 'number' && Number.isFinite(item.distanceFromPrevKm)) {
    out.distanceFromPrevKm = item.distanceFromPrevKm;
  }
  if (typeof item.estimatedMinutes === 'number' && Number.isFinite(item.estimatedMinutes)) {
    out.estimatedMinutes = item.estimatedMinutes;
  }
  return out;
}

export async function saveRouteSessionToCloud(
  session: RouteSession,
  driver: DriverProfile
): Promise<void> {
  const id = sanitizeDocId(session.id, 'session');
  const path = `${ROUTES_COLLECTION}/${id}`;
  const cleanItems = session.items.slice(0, MAX_ROUTE_ITEMS).map(buildRouteItemSnapshot);
  const status = VALID_ROUTE_STATUSES.includes(session.status) ? session.status : 'saved';

  try {
    const docRef = doc(db, ROUTES_COLLECTION, id);
    if (syncedRouteIds.has(id)) {
      await updateDoc(docRef, {
        ownerId: sanitizeDocId(driver.id, 'driver'),
        name: (session.name || 'Recorrido').slice(0, MAX_ROUTE_NAME_LEN),
        date: (session.date || new Date().toISOString()).slice(0, MAX_ROUTE_DATE_LEN),
        status,
        totalDistanceKm: Number.isFinite(session.totalDistanceKm) ? session.totalDistanceKm : 0,
        totalMinutes: Number.isFinite(session.totalMinutes) ? session.totalMinutes : 0,
        items: cleanItems,
      });
    } else {
      await setDoc(docRef, {
        id,
        ownerId: sanitizeDocId(driver.id, 'driver'),
        name: (session.name || 'Recorrido').slice(0, MAX_ROUTE_NAME_LEN),
        date: (session.date || new Date().toISOString()).slice(0, MAX_ROUTE_DATE_LEN),
        status,
        totalDistanceKm: Number.isFinite(session.totalDistanceKm) ? session.totalDistanceKm : 0,
        totalMinutes: Number.isFinite(session.totalMinutes) ? session.totalMinutes : 0,
        createdAt: Number.isFinite(session.createdAt) ? session.createdAt : Date.now(),
        items: cleanItems,
      });
      syncedRouteIds.add(id);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteRouteSessionFromCloud(id: string): Promise<void> {
  const cleanId = sanitizeDocId(id, 'session');
  const path = `${ROUTES_COLLECTION}/${cleanId}`;
  try {
    await deleteDoc(doc(db, ROUTES_COLLECTION, cleanId));
    syncedRouteIds.delete(cleanId);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteAllRoutesFromCloud(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(rawId => {
      const cleanId = sanitizeDocId(rawId, 'session');
      batch.delete(doc(db, ROUTES_COLLECTION, cleanId));
      syncedRouteIds.delete(cleanId);
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, ROUTES_COLLECTION);
    }
  }
}

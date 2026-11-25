import { useState, useEffect, useRef } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, testConnection } from '../firebase';
import { DeliveryItem, GpsPosition } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export function useFirebaseSync(
  _localItems: DeliveryItem[],
  setLocalItems: React.Dispatch<React.SetStateAction<DeliveryItem[]>>,
  currentGps: GpsPosition | null
) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [remoteDrivers, setRemoteDrivers] = useState<
    { id: string; driverName: string; lat: number; lng: number; updatedAt: number }[]
  >([]);
  const isSyncingFromRemoteRef = useRef<boolean>(false);

  // Verify Firestore connection on mount
  useEffect(() => {
    void testConnection();
  }, []);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error('Error signing in with Google:', e);
      alert('No se pudo iniciar sesión con Google. Inténtalo de nuevo.');
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.error('Error signing out:', e);
    }
  };

  // Sync Deliveries with Firestore in real-time (all drivers' routes are readable)
  useEffect(() => {
    if (!user) return;

    const pathForOnSnapshot = 'deliveries';
    const colRef = collection(db, pathForOnSnapshot);
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        isSyncingFromRemoteRef.current = true;
        const fetched: DeliveryItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as DeliveryItem;
          fetched.push({
            ...data,
            id: docSnap.id,
            coverageStatus: data.coverageStatus || 'in_coverage',
            province: data.province || 'San José',
          });
        });

        if (fetched.length > 0) {
          setLocalItems(fetched);
        } else {
          setLocalItems((prev) =>
            prev.filter((i) => !i.id.startsWith('demo-') && (!i.assignedDriverId || i.assignedDriverId === user.uid))
          );
        }
        setTimeout(() => {
          isSyncingFromRemoteRef.current = false;
        }, 100);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, pathForOnSnapshot);
      }
    );

    return () => unsubscribe();
  }, [user, setLocalItems]);

  // Push local item to Firestore ONLY if it belongs to the signed-in driver's profile
  const syncItemToFirestore = async (item: DeliveryItem) => {
    if (!user || isSyncingFromRemoteRef.current) return;
    if (item.assignedDriverId !== user.uid) {
      console.warn('Permiso denegado: solo puedes modificar paquetes de tu propio perfil.');
      return;
    }

    const docPath = `deliveries/${item.id}`;
    try {
      const driverName = (item.assignedDriverName || user.displayName || user.email?.split('@')[0] || 'Conductor').slice(0, 100);
      const boundedPayload: Record<string, unknown> = {
        ...item,
        id: item.id.slice(0, 128),
        address: (item.address || 'Sin ubicación registrada').slice(0, 500),
        assignedDriverId: user.uid,
        assignedDriverName: driverName,
        province: item.province ? item.province.slice(0, 100) : undefined,
        recipientName: item.recipientName ? item.recipientName.slice(0, 120) : undefined,
        phone: item.phone ? item.phone.slice(0, 50) : undefined,
        notes: item.notes ? item.notes.slice(0, 1000) : undefined,
        deliveryPhotoAt: item.deliveryPhotoAt ? item.deliveryPhotoAt.slice(0, 100) : undefined,
        updatedAt: new Date().toISOString(),
      };

      const sanitized = Object.fromEntries(
        Object.entries(boundedPayload).filter(([, value]) => value !== undefined)
      );
      await setDoc(doc(db, 'deliveries', item.id), sanitized);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, docPath);
    }
  };

  const deleteItemFromFirestore = async (id: string, ownerDriverId?: string) => {
    if (!user) return;
    if (ownerDriverId && ownerDriverId !== user.uid) {
      console.warn('Permiso denegado: solo puedes eliminar paquetes de tu propio perfil.');
      return;
    }
    const docPath = `deliveries/${id}`;
    try {
      await deleteDoc(doc(db, 'deliveries', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, docPath);
    }
  };

  // Sync Driver GPS Location to Firestore (strictly under user.uid)
  useEffect(() => {
    if (!user || !currentGps) return;
    const driverPath = `drivers/${user.uid}`;
    const driverDocRef = doc(db, 'drivers', user.uid);
    setDoc(
      driverDocRef,
      {
        id: user.uid,
        driverName: (user.displayName || user.email?.split('@')[0] || 'Conductor').slice(0, 100),
        lat: currentGps.lat,
        lng: currentGps.lng,
        heading: currentGps.heading ?? 0,
        speed: currentGps.speed ?? 0,
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, driverPath);
    });
  }, [user, currentGps]);

  // Listen to other active drivers
  useEffect(() => {
    if (!user) return;
    const driversPath = 'drivers';
    const driversRef = collection(db, driversPath);
    const unsubscribe = onSnapshot(
      driversRef,
      (snapshot) => {
        const drivers: { id: string; driverName: string; lat: number; lng: number; updatedAt: number }[] = [];
        const now = Date.now();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as {
            id: string;
            driverName: string;
            lat: number;
            lng: number;
            updatedAt: number;
          };
          // Keep drivers active within last 15 minutes
          if (data.id !== user.uid && now - (data.updatedAt || 0) < 15 * 60 * 1000) {
            drivers.push(data);
          }
        });
        setRemoteDrivers(drivers);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, driversPath);
      }
    );
    return () => unsubscribe();
  }, [user]);

  return {
    user,
    authLoading,
    signIn,
    signOut,
    remoteDrivers,
    syncItemToFirestore,
    deleteItemFromFirestore,
  };
}

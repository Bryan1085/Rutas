import { useState, useEffect, useRef } from 'react';
import { User, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { DeliveryItem, GpsPosition } from '../types';

export function useFirebaseSync(localItems: DeliveryItem[], setLocalItems: React.Dispatch<React.SetStateAction<DeliveryItem[]>>, currentGps: GpsPosition | null) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [remoteDrivers, setRemoteDrivers] = useState<{ id: string; driverName: string; lat: number; lng: number; updatedAt: number }[]>([]);
  const isSyncingFromRemoteRef = useRef<boolean>(false);

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

  // Sync Deliveries with Firestore in real-time
  useEffect(() => {
    if (!user) return;

    const colRef = collection(db, 'deliveries');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      isSyncingFromRemoteRef.current = true;
      const fetched: DeliveryItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as DeliveryItem;
        fetched.push({
          ...data,
          id: docSnap.id,
          coverageStatus: data.coverageStatus || 'in_coverage',
          province: data.province || 'San José'
        });
      });

      if (fetched.length > 0) {
        setLocalItems(fetched);
      }
      setTimeout(() => {
        isSyncingFromRemoteRef.current = false;
      }, 100);
    }, (err) => {
      console.error('Error listening to deliveries snapshot:', err);
    });

    return () => unsubscribe();
  }, [user]);

  // Push local items to Firestore when modified locally
  const syncItemToFirestore = async (item: DeliveryItem) => {
    if (!user || isSyncingFromRemoteRef.current) return;
    try {
      const sanitized = Object.fromEntries(
        Object.entries({
          ...item,
          updatedAt: new Date().toISOString()
        }).filter(([, value]) => value !== undefined)
      );
      await setDoc(doc(db, 'deliveries', item.id), sanitized);
    } catch (e) {
      console.error('Error syncing item to Firestore:', e);
    }
  };

  const deleteItemFromFirestore = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'deliveries', id));
    } catch (e) {
      console.error('Error deleting item from Firestore:', e);
    }
  };

  // Sync Driver GPS Location to Firestore
  useEffect(() => {
    if (!user || !currentGps) return;
    const driverDocRef = doc(db, 'drivers', user.uid);
    setDoc(driverDocRef, {
      id: user.uid,
      driverName: user.displayName || user.email?.split('@')[0] || 'Conductor',
      lat: currentGps.lat,
      lng: currentGps.lng,
      heading: currentGps.heading ?? 0,
      speed: currentGps.speed ?? 0,
      updatedAt: Date.now()
    }, { merge: true }).catch(err => {
      console.error('Error updating driver location:', err);
    });
  }, [user, currentGps]);

  // Listen to other active drivers
  useEffect(() => {
    if (!user) return;
    const driversRef = collection(db, 'drivers');
    const unsubscribe = onSnapshot(driversRef, (snapshot) => {
      const drivers: any[] = [];
      const now = Date.now();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Keep drivers active within last 15 minutes
        if (data.id !== user.uid && (now - (data.updatedAt || 0) < 15 * 60 * 1000)) {
          drivers.push(data);
        }
      });
      setRemoteDrivers(drivers);
    });
    return () => unsubscribe();
  }, [user]);

  return {
    user,
    authLoading,
    signIn,
    signOut,
    remoteDrivers,
    syncItemToFirestore,
    deleteItemFromFirestore
  };
}

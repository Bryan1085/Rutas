const DB_NAME = 'ruteo_photos_db';
const DB_VERSION = 1;
const STORE_NAME = 'delivery_photos';

function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open photo database'));
  });
}

export async function saveDeliveryPhotoToDB(id: string, dataUrl: string): Promise<void> {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id, dataUrl, updatedAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore storage errors if IndexedDB is blocked
  }
}

export async function deleteDeliveryPhotoFromDB(id: string): Promise<void> {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore storage errors
  }
}

export async function loadAllDeliveryPhotosFromDB(): Promise<Record<string, string>> {
  try {
    const db = await openPhotoDb();
    const map: Record<string, string> = {};
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        for (const row of rows) {
          if (row && typeof row.id === 'string' && typeof row.dataUrl === 'string') {
            map[row.id] = row.dataUrl;
          }
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    db.close();
    return map;
  } catch {
    return {};
  }
}

export async function clearAllDeliveryPhotosFromDB(): Promise<void> {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore storage errors
  }
}

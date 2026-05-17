import type { ProgressPhotoRecord } from "@/types/progress-photos";

const DB_NAME = "macrokeep-progress-photos";
const DB_VERSION = 1;
const STORE = "photos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: "id" });
        os.createIndex("capturedAt", "capturedAt", { unique: false });
      }
    };
  });
}

export async function addProgressPhoto(record: ProgressPhotoRecord): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      tx.objectStore(STORE).put(record);
    });
  } finally {
    db.close();
  }
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      tx.objectStore(STORE).delete(id);
    });
  } finally {
    db.close();
  }
}

export async function listProgressPhotosDesc(): Promise<ProgressPhotoRecord[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result ?? []) as ProgressPhotoRecord[];
        rows.sort((a, b) => b.capturedAt - a.capturedAt);
        resolve(rows);
      };
      req.onerror = () => reject(req.error ?? new Error("read failed"));
    });
  } finally {
    db.close();
  }
}

/** Clears local-only cache after migrating to Google Drive. */
export async function clearProgressPhotosIndexedDb(): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      tx.objectStore(STORE).clear();
    });
  } finally {
    db.close();
  }
}

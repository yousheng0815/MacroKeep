import type { MealPhotoCacheTier } from "@/lib/meal-photo-cache";

const DB_NAME = "macrokeep-meal-photo-cache";
const DB_VERSION = 1;
const STORE = "photos";

export type MealPhotoCacheRow = {
  fileId: string;
  tier: MealPhotoCacheTier;
  expiresAtMs: number;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB error"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileId" });
      }
    };
  });
}

export async function getMealPhotoFromCache(
  fileId: string,
): Promise<MealPhotoCacheRow | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      const req = tx.objectStore(STORE).get(fileId);
      req.onsuccess = () => {
        const row = req.result as MealPhotoCacheRow | undefined;
        if (!row?.blob) {
          resolve(null);
          return;
        }
        if (row.expiresAtMs <= Date.now()) {
          resolve(null);
          return;
        }
        resolve(row);
      };
      req.onerror = () => reject(req.error ?? new Error("read failed"));
    });
  } finally {
    db.close();
  }
}

export async function putMealPhotoInCache(row: MealPhotoCacheRow): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      const store = tx.objectStore(STORE);
      const getReq = store.get(row.fileId);
      getReq.onsuccess = () => {
        const existing = getReq.result as MealPhotoCacheRow | undefined;
        if (existing?.tier === "saved" && row.tier === "recent") {
          resolve();
          return;
        }
        store.put(row);
      };
      getReq.onerror = () => reject(getReq.error ?? new Error("read failed"));
    });
  } finally {
    db.close();
  }
}

export async function removeMealPhotoFromCache(fileId: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      tx.objectStore(STORE).delete(fileId);
    });
  } finally {
    db.close();
  }
}

export async function sweepExpiredMealPhotosFromCache(): Promise<void> {
  const db = await openDb();
  const now = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("transaction failed"));
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const row = cursor.value as MealPhotoCacheRow;
        if (row.tier === "recent" && row.expiresAtMs <= now) {
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error ?? new Error("cursor failed"));
    });
  } finally {
    db.close();
  }
}

export async function clearMealPhotoCacheDb(): Promise<void> {
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

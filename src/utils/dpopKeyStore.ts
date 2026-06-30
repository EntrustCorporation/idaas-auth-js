import type { JWK } from "jose";
import type { DPoPAlg, DPoPKeyMaterial } from "./dpop";

interface PersistedDpopKeyMaterial {
  id: string;
  alg: DPoPAlg;
  privateKey: CryptoKey;
  publicJwk: JWK;
  jkt: string;
}

const DB_NAME = "idaas-auth-js";
const STORE_NAME = "dpop-key-material";
const DB_VERSION = 1;

const memoryFallbackStore = new Map<string, PersistedDpopKeyMaterial>();

const hasIndexedDb = (): boolean => {
  return typeof indexedDB !== "undefined";
};

const allowsTestMemoryStore = (): boolean => {
  return (
    typeof process !== "undefined" && process.env.IDAAS_AUTH_JS_ALLOW_MEMORY_DPOP_KEY_STORE?.toLowerCase() === "true"
  );
};

const createRandomId = (): string => {
  if (typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const openStore = async (): Promise<IDBDatabase> => {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB for DPoP key material"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

const withStore = async <T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const db = await openStore();

  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = await callback(store);
    await transactionToPromise(transaction);
    return result;
  } finally {
    db.close();
  }
};

const transactionToPromise = async (transaction: IDBTransaction): Promise<void> => {
  return await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
};

const requestToPromise = async <T>(request: IDBRequest<T>): Promise<T> => {
  return await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
};

export const persistDpopKeyMaterial = async ({
  alg,
  privateKey,
  publicJwk,
  jkt,
}: DPoPKeyMaterial & { alg: DPoPAlg }): Promise<string> => {
  const id = createRandomId();
  const record: PersistedDpopKeyMaterial = {
    id,
    alg,
    privateKey,
    publicJwk,
    jkt,
  };

  if (!hasIndexedDb()) {
    if (!allowsTestMemoryStore()) {
      throw new Error(
        "DPoP requires IndexedDB support to persist key material. Disable DPoP or use a browser with IndexedDB.",
      );
    }

    memoryFallbackStore.set(id, record);
    return id;
  }

  await withStore("readwrite", async (store) => {
    await requestToPromise(store.put(record));
    return undefined;
  });

  return id;
};

export const retrievePersistedDpopKeyMaterial = async (
  id: string,
): Promise<(DPoPKeyMaterial & { alg: DPoPAlg }) | undefined> => {
  if (!hasIndexedDb()) {
    const record = memoryFallbackStore.get(id);
    if (!record) {
      return undefined;
    }

    return {
      alg: record.alg,
      privateKey: record.privateKey,
      publicJwk: record.publicJwk,
      jkt: record.jkt,
    };
  }

  return await withStore("readonly", async (store) => {
    const record = await requestToPromise(store.get(id) as IDBRequest<PersistedDpopKeyMaterial | undefined>);

    if (!record) {
      return undefined;
    }

    return {
      alg: record.alg,
      privateKey: record.privateKey,
      publicJwk: record.publicJwk,
      jkt: record.jkt,
    };
  });
};

export const cleanupPersistedDpopKeyMaterial = async (id: string): Promise<void> => {
  if (!hasIndexedDb()) {
    memoryFallbackStore.delete(id);
    return;
  }

  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(id));
    return undefined;
  });
};

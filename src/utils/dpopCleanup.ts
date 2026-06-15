import type { IdaasContext } from "../IdaasContext";
import type { StorageManager } from "../storage/StorageManager";
import { cleanupPersistedDpopKeyMaterial } from "./dpopKeyStore";

export const cleanupPersistedDpopKeyMaterialBestEffort = async (dpopKeyRef?: string): Promise<void> => {
  if (!dpopKeyRef) {
    return;
  }

  try {
    await cleanupPersistedDpopKeyMaterial(dpopKeyRef);
  } catch {
    // DPoP key cleanup must not block token retrieval or local session cleanup.
  }
};

export const clearStoredDpopKeyMaterialBestEffort = async (
  context: IdaasContext,
  storageManager: StorageManager,
): Promise<void> => {
  const dpopKeyRefs = new Set<string>();

  for (const token of storageManager.getAccessTokens()) {
    if (token.dpopKeyRef) {
      dpopKeyRefs.add(token.dpopKeyRef);
    }
  }

  const tokenParams = storageManager.getTokenParams();
  if (tokenParams?.dpopKeyRef) {
    dpopKeyRefs.add(tokenParams.dpopKeyRef);
  }

  for (const dpopKeyRef of dpopKeyRefs) {
    await context.clearDpopKeyMaterial(dpopKeyRef);
  }

  await context.clearDpopKeyMaterial();
};

import { describe, expect, it } from "bun:test";
import { StorageManager } from "../../../src/storage/StorageManager";

describe("StorageManager store implementations", () => {
  const storageTypes: Array<"memory" | "localstorage"> = ["memory", "localstorage"];

  it.each(storageTypes)("%s: performs basic CRUD via StorageManager", (storageType) => {
    const sm = new StorageManager("test-client", storageType);

    const key1 = Bun.randomUUIDv7();
    const key2 = Bun.randomUUIDv7();

    sm.saveClientParams({ nonce: key1, codeVerifier: key2, redirectUri: "https://x.com", state: "s" });
    expect(sm.getClientParams()?.nonce).toBe(key1);
    expect(sm.getClientParams()?.codeVerifier).toBe(key2);

    sm.saveIdaasSessionToken(key1);
    expect(sm.getIdaasSessionToken()).toBe(key1);

    sm.remove();
    expect(sm.getClientParams()).toBeUndefined();
    expect(sm.getIdaasSessionToken()).toBeUndefined();
  });
});

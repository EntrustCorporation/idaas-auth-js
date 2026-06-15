import { afterEach, describe, expect, test } from "bun:test";
import { generateDpopKeyMaterial } from "../../../src/utils/dpop";
import { persistDpopKeyMaterial } from "../../../src/utils/dpopKeyStore";
import { blockIndexedDb } from "../helpers";

describe("DPoP key store", () => {
  let restoreIndexedDb: (() => void) | undefined;

  afterEach(() => {
    restoreIndexedDb?.();
    restoreIndexedDb = undefined;
  });

  test("throws clear SDK error when IndexedDB open fails during persistence", async () => {
    const keyMaterial = await generateDpopKeyMaterial("ES256");
    restoreIndexedDb = blockIndexedDb();

    await expect(persistDpopKeyMaterial({ alg: "ES256", ...keyMaterial })).rejects.toThrow(
      "DPoP requires IndexedDB support to persist key material. Disable DPoP or use a browser with IndexedDB.",
    );
  });
});

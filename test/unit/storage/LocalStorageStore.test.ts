import { afterEach, describe, expect, it } from "bun:test";
import { LocalStorageStore } from "../../../src/storage/LocalStorageStore";

describe("LocalStorageStore", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("returns null for missing keys", () => {
    const store = new LocalStorageStore();

    expect(store.get("missing")).toBeNull();
  });

  it("saves and returns values", () => {
    const store = new LocalStorageStore();

    store.save("key", "value");

    expect(store.get("key")).toBe("value");
  });

  it("deletes stored values", () => {
    const store = new LocalStorageStore();

    store.save("key", "value");
    store.delete("key");

    expect(store.get("key")).toBeNull();
  });
});

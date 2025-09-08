import { describe, expect, it } from "bun:test";
import { LocalStorageStore } from "../../../src/storage/LocalStorageStore";
import { InMemoryStore } from "../../../src/storage/MemoryStore";
import type { IStore } from "../../../src/storage/shared";

describe("Store Tests", () => {
  const tests: [string, IStore][] = [
    ["InMemoryStore", new InMemoryStore()],
    ["LocalStorageStore", new LocalStorageStore()],
  ];

  it.each(tests)("%s should perform basic CRUD operations", (_, store) => {
    const key1 = "foo";
    const key2 = "bar";

    const value1 = Bun.randomUUIDv7();
    const value2 = Bun.randomUUIDv7();

    store.save(key1, value1);
    store.save(key2, value2);

    expect(store.get(key1)).toBe(value1);
    expect(store.get(key2)).toBe(value2);

    store.delete(key1);
    store.delete(key2);

    expect(store.get(key1)).toBeNull();
    expect(store.get(key2)).toBeNull();
  });
});

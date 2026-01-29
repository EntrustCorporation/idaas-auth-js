import { describe, expect, it } from "bun:test";
import { InMemoryStore } from "../../../src/storage/MemoryStore";

describe("InMemoryStore", () => {
  it("returns null for missing keys", () => {
    const store = new InMemoryStore();

    expect(store.get("missing")).toBeNull();
  });

  it("saves and returns values", () => {
    const store = new InMemoryStore();

    store.save("key", "value");

    expect(store.get("key")).toBe("value");
  });

  it("deletes stored values", () => {
    const store = new InMemoryStore();

    store.save("key", "value");
    store.delete("key");

    expect(store.get("key")).toBeNull();
  });
});

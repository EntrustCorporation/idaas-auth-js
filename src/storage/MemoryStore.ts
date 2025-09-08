import type { IStore, Optional } from "./shared";

export class InMemoryStore implements IStore {
  private cache = new Map<string, string>();

  public get(key: string): Optional<string> {
    return this.cache.get(key) ?? null;
  }

  public delete(key: string): Optional<void> {
    this.cache.delete(key);
  }

  save(key: string, data: string): Optional<void> {
    this.cache.set(key, data);
  }
}

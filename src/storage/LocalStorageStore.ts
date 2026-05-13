import type { IStore, Optional } from "./shared";

export class LocalStorageStore implements IStore {
  // biome-ignore lint/complexity/noUselessConstructor: Fix when Bun supports counting implicit constructors
  constructor() {
    // TODO(bun/7025): Remove this once Bun function coverage counts implicit constructors.
  }

  public get(key: string): Optional<string> {
    return localStorage.getItem(key);
  }

  public delete(key: string): Optional<void> {
    return localStorage.removeItem(key);
  }

  public save(key: string, data: string): Optional<void> {
    return localStorage.setItem(key, data);
  }
}

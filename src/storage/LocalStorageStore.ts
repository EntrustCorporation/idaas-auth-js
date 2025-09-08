import type { IStore, Optional } from "./shared";

export class LocalStorageStore implements IStore {
  public get(key: string): Optional<string> {
    return localStorage.getItem(key);
  }

  public delete(key: string): Optional<void> {
    return localStorage.removeItem(key);
  }

  save(key: string, data: string): Optional<void> {
    return localStorage.setItem(key, data);
  }
}

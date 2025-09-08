export type Optional<T> = T | null;

export interface IStore {
  save(key: string, data: string): Optional<void>;
  get(key: string): Optional<string>;
  delete(key: string): Optional<void>;
}

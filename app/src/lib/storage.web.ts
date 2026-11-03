// Armazenamento local no navegador / PC (IndexedDB, sem limite pequeno como o localStorage).
import { get, set, del } from 'idb-keyval';

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    return ((await get(`vidro_${key}`)) as T) ?? null;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await set(`vidro_${key}`, value);
}

export async function remove(key: string): Promise<void> {
  try {
    await del(`vidro_${key}`);
  } catch {}
}

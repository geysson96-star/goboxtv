// Armazenamento local (Android/iOS): arquivos JSON na pasta do app.
// Listas grandes (50 mil+ itens) ficam em cache aqui, então o app abre na hora.
import { File, Paths } from 'expo-file-system';

function fileFor(key: string) {
  return new File(Paths.document, `vidro_${key.replace(/[^a-z0-9_-]/gi, '_')}.json`);
}

export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const f = fileFor(key);
    if (!f.exists) return null;
    return JSON.parse(await f.text()) as T;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  const f = fileFor(key);
  if (!f.exists) f.create();
  f.write(JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  try {
    const f = fileFor(key);
    if (f.exists) f.delete();
  } catch {}
}

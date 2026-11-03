// fetch com tempo limite e medição de latência.

export class HttpError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function fetchWithTimeout(url: string, opts: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 20000, ...init } = opts;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status);
    return res;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new HttpError('Tempo esgotado');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchText(url: string, timeoutMs = 30000): Promise<string> {
  const res = await fetchWithTimeout(url, { timeoutMs });
  return res.text();
}

export async function fetchJSON<T = any>(url: string, timeoutMs = 30000): Promise<T> {
  const res = await fetchWithTimeout(url, { timeoutMs, headers: { Accept: 'application/json' } });
  return res.json();
}

/** Testa se uma URL de stream responde. Retorna latência em ms ou null se falhar. */
export async function probe(url: string, headers?: Record<string, string>, timeoutMs = 6000): Promise<number | null> {
  const t0 = Date.now();
  try {
    // Muitos servidores HLS não aceitam HEAD; um GET pequeno com Range resolve.
    const res = await fetchWithTimeout(url, { timeoutMs, headers: { Range: 'bytes=0-1023', ...(headers || {}) } });
    try {
      // Não baixar o stream inteiro.
      await res.body?.cancel?.();
    } catch {}
    return Date.now() - t0;
  } catch {
    return null;
  }
}

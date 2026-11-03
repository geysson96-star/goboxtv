// Carrega as listas, monta o catálogo, guarda em cache e verifica a saúde das fontes.
import { create } from 'zustand';
import type { Catalog, Programme, RawEntry, Series, Source, SourceStatus } from '../lib/types';
import { parseM3U } from '../lib/m3u';
import { loadXtream, xtreamEpgUrl } from '../lib/xtream';
import { buildCatalog } from '../lib/catalog';
import { indexByChannel, loadXMLTV } from '../lib/xmltv';
import { fetchText, probe } from '../lib/http';
import { getJSON, setJSON } from '../lib/storage';
import { useSettings } from './settings';
import { useAuth } from './auth';
import { fetchRemoteSources } from '../lib/sources';

interface SourceCache {
  entries: RawEntry[];
  series: Series[];
  epgUrl?: string;
  fetchedAt: number;
}

interface CatalogState {
  catalog: Catalog;
  epg: Record<string, Programme[]>;
  status: Record<string, SourceStatus>;
  loading: boolean;
  lastError?: string;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  checkHealth: () => Promise<void>;
}

const EMPTY: Catalog = { channels: [], movies: [], series: [], updatedAt: 0 };

async function fetchSource(src: Source): Promise<SourceCache> {
  if (src.kind === 'xtream') {
    const { entries, series } = await loadXtream(src);
    return { entries, series, epgUrl: src.epgUrl || xtreamEpgUrl(src), fetchedAt: Date.now() };
  }
  const t0 = Date.now();
  const text = await fetchText(src.url, 60000);
  const { entries, epgUrl } = parseM3U(text, src.id);
  if (!entries.length) throw new Error('Lista vazia ou em formato inválido');
  return { entries, series: [], epgUrl: src.epgUrl || epgUrl, fetchedAt: t0 };
}

export const useCatalog = create<CatalogState>((set, get) => ({
  catalog: EMPTY,
  epg: {},
  status: {},
  loading: false,

  /** Abre instantâneo com o cache; atualiza em segundo plano depois. */
  init: async () => {
    const [catalog, epg, status] = await Promise.all([
      getJSON<Catalog>('catalog'),
      getJSON<Record<string, Programme[]>>('epg'),
      getJSON<Record<string, SourceStatus>>('status'),
    ]);
    set({ catalog: catalog || EMPTY, epg: epg || {}, status: status || {} });
    const { refreshOnOpen } = useSettings.getState();
    const stale = !catalog || Date.now() - catalog.updatedAt > 6 * 3600e3;
    if (refreshOnOpen || stale) get().refresh();
  },

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, lastError: undefined });
    // Fontes automáticas definidas pelo administrador no servidor (se houver).
    const token = useAuth.getState().session?.token;
    const remote = await fetchRemoteSources(token && token !== 'dev' ? token : undefined);
    if (remote) useSettings.getState().setAutoSources(remote);
    const sources = useSettings.getState().sources.filter((s) => s.enabled);
    const status = { ...get().status };
    const caches: SourceCache[] = [];

    await Promise.all(
      sources.map(async (src) => {
        const t0 = Date.now();
        try {
          const c = await fetchSource(src);
          caches.push(c);
          await setJSON(`src_${src.id}`, c);
          const ms = Date.now() - t0;
          status[src.id] = {
            health: ms > 15000 ? 'slow' : 'online',
            lastCheck: Date.now(),
            lastUpdate: Date.now(),
            itemCount: c.entries.length + c.series.length,
          };
        } catch (e: any) {
          // Lista caiu: usa a última cópia boa que estava guardada.
          const old = await getJSON<SourceCache>(`src_${src.id}`);
          if (old) caches.push(old);
          status[src.id] = { ...(status[src.id] || {}), health: 'offline', lastCheck: Date.now(), error: e?.message || String(e) };
        }
      }),
    );

    const allEntries = caches.flatMap((c) => c.entries);
    const allSeries = caches.flatMap((c) => c.series);
    const catalog = buildCatalog(sources, allEntries, allSeries);
    set({ catalog, status, loading: false, lastError: catalog.channels.length ? undefined : 'Nenhuma lista respondeu.' });
    setJSON('catalog', catalog).catch(() => {});
    setJSON('status', status).catch(() => {});

    // Guia de programação (pode ser pesado, roda depois do catálogo).
    const ids = new Set(catalog.channels.map((c) => c.tvgId).filter(Boolean) as string[]);
    const epgUrls = [...new Set(caches.map((c) => c.epgUrl).filter(Boolean) as string[])];
    if (!ids.size || !epgUrls.length) return;
    const programmes: Programme[] = [];
    for (const url of epgUrls) {
      try {
        programmes.push(...(await loadXMLTV(url, { channelIds: ids })));
      } catch {}
    }
    if (programmes.length) {
      programmes.sort((a, b) => a.start - b.start);
      const epg = indexByChannel(programmes);
      set({ epg });
      setJSON('epg', epg).catch(() => {});
    }
  },

  /** Testa cada lista ligada e marca online / lenta / fora do ar. */
  checkHealth: async () => {
    const sources = useSettings.getState().sources.filter((s) => s.enabled);
    const status = { ...get().status };
    await Promise.all(
      sources.map(async (s) => {
        const url = s.kind === 'xtream' ? `${s.url.replace(/\/+$/, '')}/player_api.php` : s.url;
        const ms = await probe(url, undefined, 10000);
        status[s.id] = {
          ...(status[s.id] || {}),
          health: ms == null ? 'offline' : ms > 3000 ? 'slow' : 'online',
          lastCheck: Date.now(),
        };
      }),
    );
    set({ status });
    setJSON('status', status).catch(() => {});
  },
}));

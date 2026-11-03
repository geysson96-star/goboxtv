// Fontes automáticas (legais e gratuitas) que já vêm no app.
// O administrador pode trocar/adicionar fontes pelo servidor (GET /api/config),
// sem precisar lançar uma versão nova do app.
import type { Source } from './types';
import { fetchJSON } from './http';
import { apiUrl } from './config';

export const DEFAULT_SOURCES: Source[] = [
  {
    id: 'auto-br',
    name: 'Canais abertos · Brasil (iptv-org)',
    kind: 'm3u',
    url: 'https://iptv-org.github.io/iptv/countries/br.m3u',
    auto: true,
    enabled: true,
    priority: 1,
  },
  {
    id: 'auto-br2',
    name: 'Brasil · abertos, legislativos e locais (iptv-com)',
    kind: 'm3u',
    url: 'https://raw.githubusercontent.com/iptv-com/iptv/main/lists/brazil.m3u',
    auto: true,
    enabled: true,
    priority: 2,
  },
  {
    id: 'auto-online',
    name: 'Só canais no ar agora (dearbulut)',
    kind: 'm3u',
    url: 'https://dearbulut.github.io/iptv/playlists/online.m3u',
    auto: true,
    enabled: true,
    priority: 3,
  },
  {
    id: 'auto-freetv',
    name: 'Free-TV · gratuitos do mundo',
    kind: 'm3u',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    auto: true,
    enabled: true,
    priority: 4,
  },
  {
    id: 'auto-por',
    name: 'Canais em português (iptv-org)',
    kind: 'm3u',
    url: 'https://iptv-org.github.io/iptv/languages/por.m3u',
    auto: true,
    enabled: true,
    priority: 5,
  },
  {
    id: 'auto-pt',
    name: 'Canais abertos · Portugal (iptv-org)',
    kind: 'm3u',
    url: 'https://iptv-org.github.io/iptv/countries/pt.m3u',
    auto: true,
    enabled: true,
    priority: 6,
  },
  {
    id: 'auto-all',
    name: 'Mundo todo (iptv-org, lista grande)',
    kind: 'm3u',
    url: 'https://iptv-org.github.io/iptv/index.m3u',
    auto: true,
    enabled: false,
    priority: 7,
  },
];

/** Busca o catálogo de fontes automáticas no servidor do administrador. */
export async function fetchRemoteSources(token?: string): Promise<Source[] | null> {
  if (!apiUrl()) return null;
  try {
    const res = await fetchJSON<{ sources?: Partial<Source>[] }>(`${apiUrl()}/api/config${token ? `?t=${encodeURIComponent(token)}` : ''}`, 10000);
    if (!res?.sources?.length) return null;
    return res.sources
      .filter((s) => s.url && s.id)
      .map((s, i) => ({
        id: String(s.id),
        name: s.name || `Fonte ${i + 1}`,
        kind: s.kind === 'xtream' ? 'xtream' : 'm3u',
        url: String(s.url),
        epgUrl: s.epgUrl,
        auto: true,
        enabled: s.enabled !== false,
        priority: s.priority ?? i + 1,
      }));
  } catch {
    return null;
  }
}

/** Mescla fontes automáticas novas com as do usuário, preservando escolhas locais (ligada/desligada, ordem). */
export function mergeSources(current: Source[], autos: Source[]): Source[] {
  const manual = current.filter((s) => !s.auto);
  const byId = new Map(current.map((s) => [s.id, s]));
  const mergedAutos = autos.map((a) => {
    const old = byId.get(a.id);
    return old ? { ...a, enabled: old.enabled, priority: old.priority } : a;
  });
  return [...mergedAutos, ...manual].sort((a, b) => a.priority - b.priority);
}

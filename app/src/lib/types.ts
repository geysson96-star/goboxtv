// Tipos centrais do app.

export type SourceKind = 'm3u' | 'xtream';

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  /** URL da lista M3U (kind = m3u) ou do servidor Xtream (kind = xtream). */
  url: string;
  username?: string;
  password?: string;
  /** URL de guia XMLTV opcional. Se vazio, usa o x-tvg-url da própria lista. */
  epgUrl?: string;
  /** true = veio do catálogo automático; false = adicionada pelo usuário. */
  auto: boolean;
  enabled: boolean;
  /** Menor número = maior prioridade no failover. */
  priority: number;
}

export type SourceHealth = 'online' | 'slow' | 'offline' | 'unknown';

export interface SourceStatus {
  health: SourceHealth;
  lastCheck?: number;
  lastUpdate?: number;
  itemCount?: number;
  error?: string;
}

export type ContentKind = 'live' | 'movie' | 'episode';

/** Uma entrada crua, como veio da lista. */
export interface RawEntry {
  sourceId: string;
  name: string;
  url: string;
  group: string;
  logo?: string;
  tvgId?: string;
  tvgName?: string;
  country?: string;
  kind: ContentKind;
  /** Para episódios: dados da série. */
  seriesName?: string;
  season?: number;
  episode?: number;
  /** Xtream: ids para metadados extras. */
  xtreamId?: string;
  plot?: string;
  year?: string;
  rating?: string;
  backdrop?: string;
  /** Cabeçalhos HTTP exigidos pela fonte (User-Agent, Referer). */
  headers?: Record<string, string>;
}

/** Uma URL possível para o mesmo conteúdo (failover). */
export interface StreamSource {
  sourceId: string;
  url: string;
  priority: number;
  headers?: Record<string, string>;
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  logo?: string;
  tvgId?: string;
  region: string;
  genre: string;
  streams: StreamSource[];
}

export interface Movie {
  id: string;
  title: string;
  year?: string;
  genre: string;
  region: string;
  poster?: string;
  backdrop?: string;
  plot?: string;
  rating?: string;
  addedAt?: number;
  streams: StreamSource[];
}

export interface Episode {
  id: string;
  title: string;
  season: number;
  episode: number;
  streams: StreamSource[];
}

export interface Series {
  id: string;
  title: string;
  genre: string;
  region: string;
  poster?: string;
  backdrop?: string;
  plot?: string;
  rating?: string;
  seasons: Record<number, Episode[]>;
  /** Séries Xtream: episódios carregados só quando a série é aberta. */
  lazy?: { sourceId: string; seriesId: string };
}

export interface Programme {
  channelId: string; // tvg-id
  start: number; // epoch ms
  stop: number;
  title: string;
  desc?: string;
  category?: string;
  icon?: string;
}

export interface Catalog {
  channels: Channel[];
  movies: Movie[];
  series: Series[];
  updatedAt: number;
}

export interface Progress {
  id: string; // id do filme ou episódio
  position: number; // segundos
  duration: number;
  updatedAt: number;
  title: string;
  subtitle?: string;
  image?: string;
  /** para episódios: id da série */
  seriesId?: string;
}

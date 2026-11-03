// Cliente da API "Xtream Codes" (player_api.php), usada por muitos provedores com login.
import type { Episode, RawEntry, Series, Source } from './types';
import { fetchJSON } from './http';
import { cleanTitle, detectGenre, detectRegion, hashId } from './normalize';

function base(src: Source) {
  return src.url.replace(/\/+$/, '').replace(/\/player_api\.php.*$/, '');
}

function api(src: Source, action: string, extra = '') {
  const u = encodeURIComponent(src.username || '');
  const p = encodeURIComponent(src.password || '');
  return `${base(src)}/player_api.php?username=${u}&password=${p}&action=${action}${extra}`;
}

function cred(src: Source) {
  return `${encodeURIComponent(src.username || '')}/${encodeURIComponent(src.password || '')}`;
}

export function xtreamEpgUrl(src: Source) {
  return `${base(src)}/xmltv.php?username=${encodeURIComponent(src.username || '')}&password=${encodeURIComponent(src.password || '')}`;
}

/** Confere o login. Lança erro se usuário/senha estiverem errados ou a conta vencida. */
export async function xtreamLogin(src: Source) {
  const info = await fetchJSON(`${base(src)}/player_api.php?username=${encodeURIComponent(src.username || '')}&password=${encodeURIComponent(src.password || '')}`);
  if (!info?.user_info || info.user_info.auth === 0) throw new Error('Usuário ou senha inválidos');
  if (info.user_info.status && info.user_info.status !== 'Active') throw new Error(`Conta ${info.user_info.status}`);
  return info;
}

async function categories(src: Source, action: string): Promise<Record<string, string>> {
  const list: any[] = (await fetchJSON(api(src, action))) || [];
  const map: Record<string, string> = {};
  for (const c of list) map[String(c.category_id)] = c.category_name;
  return map;
}

export interface XtreamResult {
  entries: RawEntry[];
  series: Series[];
}

export async function loadXtream(src: Source): Promise<XtreamResult> {
  await xtreamLogin(src);
  const b = base(src);
  const c = cred(src);
  const [liveCats, vodCats, serCats] = await Promise.all([
    categories(src, 'get_live_categories').catch(() => ({} as Record<string, string>)),
    categories(src, 'get_vod_categories').catch(() => ({} as Record<string, string>)),
    categories(src, 'get_series_categories').catch(() => ({} as Record<string, string>)),
  ]);
  const [live, vod, ser] = await Promise.all([
    fetchJSON<any[]>(api(src, 'get_live_streams'), 60000).catch(() => []),
    fetchJSON<any[]>(api(src, 'get_vod_streams'), 60000).catch(() => []),
    fetchJSON<any[]>(api(src, 'get_series'), 60000).catch(() => []),
  ]);

  const entries: RawEntry[] = [];
  for (const s of live || []) {
    entries.push({
      sourceId: src.id,
      name: cleanTitle(s.name || ''),
      url: `${b}/live/${c}/${s.stream_id}.m3u8`,
      group: liveCats[String(s.category_id)] || 'Ao vivo',
      logo: s.stream_icon || undefined,
      tvgId: s.epg_channel_id || undefined,
      kind: 'live',
    });
  }
  for (const s of vod || []) {
    entries.push({
      sourceId: src.id,
      name: cleanTitle(s.name || ''),
      url: `${b}/movie/${c}/${s.stream_id}.${s.container_extension || 'mp4'}`,
      group: vodCats[String(s.category_id)] || 'Filmes',
      logo: s.stream_icon || undefined,
      kind: 'movie',
      xtreamId: String(s.stream_id),
      rating: s.rating ? String(s.rating) : undefined,
      year: s.year ? String(s.year) : undefined,
    });
  }
  const series: Series[] = (ser || []).map((s: any) => {
    const group = serCats[String(s.category_id)] || '';
    return {
      id: 'xs_' + hashId(src.id + ':' + s.series_id),
      title: cleanTitle(s.name || ''),
      genre: detectGenre(s.genre, group),
      region: detectRegion(group, s.name),
      poster: s.cover || undefined,
      backdrop: Array.isArray(s.backdrop_path) ? s.backdrop_path[0] : undefined,
      plot: s.plot || undefined,
      rating: s.rating ? String(s.rating) : undefined,
      seasons: {},
      lazy: { sourceId: src.id, seriesId: String(s.series_id) },
    };
  });
  return { entries, series };
}

/** Carrega temporadas/episódios de uma série Xtream sob demanda. */
export async function loadXtreamSeriesInfo(src: Source, seriesId: string): Promise<Record<number, Episode[]>> {
  const info = await fetchJSON(api(src, 'get_series_info', `&series_id=${encodeURIComponent(seriesId)}`), 30000);
  const out: Record<number, Episode[]> = {};
  const eps = info?.episodes || {};
  for (const seasonKey of Object.keys(eps)) {
    const season = parseInt(seasonKey, 10) || 1;
    out[season] = (eps[seasonKey] || []).map((e: any) => ({
      id: 'xe_' + hashId(src.id + ':' + e.id),
      title: cleanTitle(e.title || `Episódio ${e.episode_num}`),
      season,
      episode: Number(e.episode_num) || 0,
      streams: [{ sourceId: src.id, priority: src.priority, url: `${base(src)}/series/${cred(src)}/${e.id}.${e.container_extension || 'mp4'}` }],
    }));
    out[season].sort((a, b) => a.episode - b.episode);
  }
  return out;
}

// Junta as entradas de todas as listas num catálogo único e sem duplicados.
// O mesmo canal vindo de listas diferentes vira UM item com várias fontes (failover).
import type { Catalog, Channel, Episode, Movie, RawEntry, Series, Source, StreamSource } from './types';
import { detectGenre, detectRegion, hashId, keyOf } from './normalize';

function addStream(list: StreamSource[], s: StreamSource) {
  if (!list.some((x) => x.url === s.url)) list.push(s);
}

export function buildCatalog(sources: Source[], entries: RawEntry[], extraSeries: Series[] = []): Catalog {
  const prio = new Map(sources.map((s) => [s.id, s.priority]));
  const channels = new Map<string, Channel>();
  const movies = new Map<string, Movie>();
  const series = new Map<string, Series>();

  for (const e of entries) {
    const stream: StreamSource = { sourceId: e.sourceId, url: e.url, priority: prio.get(e.sourceId) ?? 99, headers: e.headers };

    if (e.kind === 'live') {
      const region = detectRegion(e.country, e.group, e.tvgId?.split('.').pop());
      const key = e.tvgId ? 'id:' + e.tvgId.toLowerCase() : 'n:' + keyOf(e.name) + ':' + region;
      let ch = channels.get(key);
      if (!ch) {
        ch = {
          id: 'c_' + hashId(key),
          number: 0,
          name: e.name,
          logo: e.logo,
          tvgId: e.tvgId,
          region,
          genre: detectGenre(e.group, e.name),
          streams: [],
        };
        channels.set(key, ch);
      }
      if (!ch.logo && e.logo) ch.logo = e.logo;
      addStream(ch.streams, stream);
    } else if (e.kind === 'movie') {
      const key = keyOf(e.name) + ':' + (e.year || '');
      let mv = movies.get(key);
      if (!mv) {
        mv = {
          id: 'm_' + hashId(key),
          title: e.name,
          year: e.year,
          genre: detectGenre(e.group, e.name),
          region: detectRegion(e.country, e.group),
          poster: e.logo,
          backdrop: e.backdrop,
          plot: e.plot,
          rating: e.rating,
          addedAt: Date.now(),
          streams: [],
        };
        movies.set(key, mv);
      }
      addStream(mv.streams, stream);
    } else {
      const sname = e.seriesName || e.name;
      const key = keyOf(sname);
      let se = series.get(key);
      if (!se) {
        se = {
          id: 's_' + hashId(key),
          title: sname,
          genre: detectGenre(e.group, sname),
          region: detectRegion(e.country, e.group),
          poster: e.logo,
          seasons: {},
        };
        series.set(key, se);
      }
      const season = e.season ?? 1;
      const epNum = e.episode ?? 0;
      const eps = (se.seasons[season] ||= []);
      let ep = eps.find((x) => x.episode === epNum);
      if (!ep) {
        ep = { id: 'e_' + hashId(key + ':' + season + ':' + epNum), title: `Episódio ${epNum}`, season, episode: epNum, streams: [] } as Episode;
        eps.push(ep);
      }
      addStream(ep.streams, stream);
    }
  }

  for (const s of extraSeries) {
    const key = keyOf(s.title);
    if (!series.has(key)) series.set(key, s);
  }

  const chList = [...channels.values()];
  for (const c of chList) c.streams.sort((a, b) => a.priority - b.priority);
  const regionOrder = ['Brasil', 'Portugal', 'América Latina'];
  chList.sort((a, b) => {
    const ra = regionOrder.indexOf(a.region), rb = regionOrder.indexOf(b.region);
    const oa = ra < 0 ? 99 : ra, ob = rb < 0 ? 99 : rb;
    return oa - ob || a.region.localeCompare(b.region) || a.name.localeCompare(b.name);
  });
  chList.forEach((c, i) => (c.number = 101 + i));

  const mvList = [...movies.values()];
  for (const m of mvList) m.streams.sort((a, b) => a.priority - b.priority);
  const seList = [...series.values()];
  for (const s of seList) for (const k of Object.keys(s.seasons)) s.seasons[+k].sort((a, b) => a.episode - b.episode);

  return { channels: chList, movies: mvList, series: seList, updatedAt: Date.now() };
}

/** Agrupa itens por um campo, mantendo ordem de primeira aparição. */
export function groupBy<T>(items: T[], key: (t: T) => string): { name: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(it);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

import type { Catalog, Channel, Episode, Movie, Programme, Series } from './types';
import { nowAndNext } from './xmltv';

export function findChannel(c: Catalog, id: string): Channel | undefined {
  return c.channels.find((x) => x.id === id);
}
export function findMovie(c: Catalog, id: string): Movie | undefined {
  return c.movies.find((x) => x.id === id);
}
export function findSeries(c: Catalog, id: string): Series | undefined {
  return c.series.find((x) => x.id === id);
}
export function findEpisode(s: Series, id: string): Episode | undefined {
  for (const k of Object.keys(s.seasons)) {
    const e = s.seasons[+k].find((x) => x.id === id);
    if (e) return e;
  }
  return undefined;
}

export function programmesFor(epg: Record<string, Programme[]>, ch?: Channel): Programme[] {
  if (!ch?.tvgId) return [];
  return epg[ch.tvgId] || [];
}

export function nowNext(epg: Record<string, Programme[]>, ch?: Channel) {
  return nowAndNext(programmesFor(epg, ch));
}

export function hhmm(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export function dayLabel(offset: number, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  const name = offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : DIAS_LONGOS[d.getDay()];
  return { name, short: `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}`, start: d.getTime(), end: d.getTime() + 864e5 };
}

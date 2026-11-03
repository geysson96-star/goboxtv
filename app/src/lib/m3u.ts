// Leitor de listas M3U / M3U8 (formato "extended M3U" usado por IPTV).
import type { RawEntry } from './types';
import { classify, cleanTitle, parseEpisode } from './normalize';

export interface M3UResult {
  entries: RawEntry[];
  /** Guia XMLTV declarado no cabeçalho (x-tvg-url / url-tvg). */
  epgUrl?: string;
}

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(s))) out[m[1].toLowerCase()] = m[2];
  return out;
}

/** Encontra a vírgula que separa atributos do nome, ignorando vírgulas entre aspas. */
function splitInf(line: string): [string, string] {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ',' && !inQuote) return [line.slice(0, i), line.slice(i + 1)];
  }
  return [line, ''];
}

export function parseM3U(text: string, sourceId: string): M3UResult {
  const lines = text.replace(/\r/g, '').split('\n');
  const entries: RawEntry[] = [];
  let epgUrl: string | undefined;
  let pending: { attrs: Record<string, string>; name: string; group?: string; headers: Record<string, string> } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      const a = parseAttrs(line);
      epgUrl = (a['x-tvg-url'] || a['url-tvg'] || '').split(',')[0].trim() || undefined;
      continue;
    }
    if (line.startsWith('#EXTINF')) {
      const [head, name] = splitInf(line.slice(line.indexOf(':') + 1));
      pending = { attrs: parseAttrs(head), name: name.trim(), headers: {} };
      continue;
    }
    if (line.startsWith('#EXTGRP:')) {
      if (pending) pending.group = line.slice(8).trim();
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:')) {
      if (pending) {
        const opt = line.slice(11);
        const eq = opt.indexOf('=');
        const k = opt.slice(0, eq).toLowerCase();
        const v = opt.slice(eq + 1);
        if (k === 'http-user-agent') pending.headers['User-Agent'] = v;
        if (k === 'http-referrer') pending.headers['Referer'] = v;
        if (k === 'http-origin') pending.headers['Origin'] = v;
      }
      continue;
    }
    if (line.startsWith('#')) continue;

    // Linha de URL
    if (!pending) continue;
    const a = pending.attrs;
    const group = a['group-title'] || pending.group || 'Sem categoria';
    const rawName = pending.name || a['tvg-name'] || 'Sem nome';
    const kind = classify(rawName, group, line);
    const ep = kind === 'episode' ? parseEpisode(rawName) : null;
    // Filmes costumam vir como "Título (2024)": separa o ano.
    let title = rawName;
    let year: string | undefined;
    const ym = kind === 'movie' ? rawName.match(/[\s(\[-]*((?:19|20)\d{2})[)\]]?\s*$/) : null;
    if (ym && ym.index! > 0) {
      year = ym[1];
      title = rawName.slice(0, ym.index);
    }
    entries.push({
      sourceId,
      name: cleanTitle(title) || rawName,
      year,
      url: line,
      group,
      logo: a['tvg-logo'] || undefined,
      tvgId: a['tvg-id'] || undefined,
      tvgName: a['tvg-name'] || undefined,
      country: a['tvg-country'] || undefined,
      kind,
      seriesName: ep?.series,
      season: ep?.season,
      episode: ep?.episode,
      headers: Object.keys(pending.headers).length ? pending.headers : undefined,
    });
    pending = null;
  }
  return { entries, epgUrl };
}

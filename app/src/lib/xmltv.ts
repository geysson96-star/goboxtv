// Leitor de guia de programação no formato XMLTV.
import type { Programme } from './types';
import { fetchWithTimeout } from './http';

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : m;
      }
      return ENT[e.toLowerCase()] ?? m;
    })
    .trim();
}

/** "20261031200000 -0300" -> epoch ms */
export function parseXmltvDate(s: string): number {
  const m = s.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return NaN;
  const [, y, mo, d, h, mi, se = '00', tz] = m;
  let t = Date.UTC(+y, +mo - 1, +d, +h, +mi, +se);
  if (tz) {
    const sign = tz[0] === '-' ? -1 : 1;
    const off = sign * (parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10));
    t -= off * 60000;
  }
  return t;
}

function tag(block: string, name: string): string | undefined {
  const m = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : undefined;
}

function attr(head: string, name: string): string | undefined {
  const m = head.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

export interface XmltvOptions {
  /** Só guarda programas destes canais (tvg-id). Vazio = todos. */
  channelIds?: Set<string>;
  from?: number;
  to?: number;
}

export function parseXMLTV(xml: string, opts: XmltvOptions = {}): Programme[] {
  const from = opts.from ?? Date.now() - 6 * 3600e3;
  const to = opts.to ?? Date.now() + 8 * 24 * 3600e3;
  const out: Programme[] = [];
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const head = m[1];
    const channelId = attr(head, 'channel');
    if (!channelId) continue;
    if (opts.channelIds && opts.channelIds.size && !opts.channelIds.has(channelId)) continue;
    const start = parseXmltvDate(attr(head, 'start') || '');
    const stop = parseXmltvDate(attr(head, 'stop') || '');
    if (!Number.isFinite(start) || !Number.isFinite(stop)) continue;
    if (stop < from || start > to) continue;
    const body = m[2];
    const icon = body.match(/<icon\b[^>]*src="([^"]*)"/);
    out.push({
      channelId,
      start,
      stop,
      title: tag(body, 'title') || 'Sem título',
      desc: tag(body, 'desc'),
      category: tag(body, 'category'),
      icon: icon ? icon[1] : undefined,
    });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Baixa e lê um guia. Suporta .gz onde o ambiente tem DecompressionStream (web/PC). */
export async function loadXMLTV(url: string, opts: XmltvOptions = {}): Promise<Programme[]> {
  const res = await fetchWithTimeout(url, { timeoutMs: 90000 });
  let text: string;
  const DS = (globalThis as any).DecompressionStream;
  if (/\.gz(\?|$)/i.test(url) && DS && res.body) {
    text = await new Response(res.body.pipeThrough(new DS('gzip'))).text();
  } else if (/\.gz(\?|$)/i.test(url)) {
    throw new Error('Guia compactado (.gz) não suportado neste aparelho. Use a versão .xml.');
  } else {
    text = await res.text();
  }
  return parseXMLTV(text, opts);
}

/** Agrupa por canal para consulta rápida. */
export function indexByChannel(progs: Programme[]): Record<string, Programme[]> {
  const idx: Record<string, Programme[]> = {};
  for (const p of progs) (idx[p.channelId] ||= []).push(p);
  return idx;
}

export function nowAndNext(list: Programme[] | undefined, at = Date.now()) {
  if (!list?.length) return { now: undefined, next: undefined };
  const i = list.findIndex((p) => p.start <= at && p.stop > at);
  if (i >= 0) return { now: list[i], next: list[i + 1] };
  const n = list.find((p) => p.start > at);
  return { now: undefined, next: n };
}

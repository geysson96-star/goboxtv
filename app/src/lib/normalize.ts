// Padroniza nomes e categorias que chegam bagunçados das listas.
// Ex.: "FILMES | AÇÃO", "Acao HD", "[BR] Ação" -> gênero "Ação".

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Chave de comparação: minúsculas, sem acento, sem símbolos. */
export function keyOf(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const QUALITY_RE = /\b(fhd|uhd|hd|sd|4k|1080p?|720p?|480p?|h265|hevc|\[?geo-blocked\]?|\[?not 24\/7\]?)\b/gi;
const PREFIX_RE = /^\s*(\[[^\]]{1,12}\]|\([^)]{1,12}\)|[A-Z]{2,3}\s*[|:\-]\s*)+/;

/** Limpa o nome exibido de um canal/filme. */
export function cleanTitle(name: string): string {
  return name
    .replace(PREFIX_RE, '')
    .replace(/\((\d{3,4}p|backup|alt|\d)\)/gi, '')
    .replace(QUALITY_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s|\-:]+$/g, '')
    .trim();
}

const REGION_ALIASES: Record<string, string> = {
  br: 'Brasil', brasil: 'Brasil', brazil: 'Brasil',
  pt: 'Portugal', portugal: 'Portugal',
  ar: 'Argentina', argentina: 'Argentina', mx: 'México', mexico: 'México',
  us: 'Estados Unidos', usa: 'Estados Unidos', uk: 'Reino Unido', gb: 'Reino Unido',
  es: 'Espanha', espana: 'Espanha', spain: 'Espanha', fr: 'França', france: 'França',
  it: 'Itália', italy: 'Itália', de: 'Alemanha', germany: 'Alemanha',
  latam: 'América Latina', latino: 'América Latina',
};

const GENRES: [RegExp, string][] = [
  [/\b(news|noticias?|jornal|informacao)\b/, 'Notícias'],
  [/\b(sport|esporte|futebol|soccer|football)s?\b/, 'Esportes'],
  [/\b(kid|kids|infantil|crianca|animation|animacao|desenho|cartoon)s?\b/, 'Infantil'],
  [/\b(music|musica|clipe)s?\b/, 'Música'],
  [/\b(document|documentario|documentary|science|ciencia|educa\w*)\b/, 'Educativos'],
  [/\b(relig\w*|gospel|catolic\w*|evangel\w*)\b/, 'Religiosos'],
  [/\b(acao|action)\b/, 'Ação'],
  [/\b(comed\w*)\b/, 'Comédia'],
  [/\b(drama)s?\b/, 'Drama'],
  [/\b(terror|horror)\b/, 'Terror'],
  [/\b(romance|romantic\w*)\b/, 'Romance'],
  [/\b(ficcao|sci fi|scifi|science fiction)\b/, 'Ficção'],
  [/\b(suspense|thriller)\b/, 'Suspense'],
  [/\b(legislat\w*|government|governo|public\w*|publica)\b/, 'Públicos'],
  [/\b(movie|movies|filme|filmes|cinema)\b/, 'Filmes'],
  [/\b(entertainment|entretenimento|general|variedades)\b/, 'Variedades'],
];

export function detectRegion(...hints: (string | undefined)[]): string {
  for (const h of hints) {
    if (!h) continue;
    const k = keyOf(h);
    for (const token of k.split(' ')) {
      if (REGION_ALIASES[token]) return REGION_ALIASES[token];
    }
  }
  return 'Internacional';
}

export function detectGenre(...hints: (string | undefined)[]): string {
  for (const h of hints) {
    if (!h) continue;
    const k = keyOf(h);
    for (const [re, g] of GENRES) if (re.test(k)) return g;
  }
  return 'Variedades';
}

const EP_PATTERNS: RegExp[] = [
  /^(.*?)[\s._\-]*s(\d{1,2})[\s._\-]*e(\d{1,3})\b/i,
  /^(.*?)[\s._\-]*(\d{1,2})x(\d{1,3})\b/i,
  /^(.*?)[\s._\-]*temporada\s*(\d{1,2})[\s._\-]*(?:epis[oó]dio|ep)\s*(\d{1,3})\b/i,
];

/** Tenta extrair série/temporada/episódio de um nome. */
export function parseEpisode(name: string): { series: string; season: number; episode: number } | null {
  for (const re of EP_PATTERNS) {
    const m = name.match(re);
    if (m && m[1].trim().length > 0) {
      return { series: cleanTitle(m[1]), season: parseInt(m[2], 10), episode: parseInt(m[3], 10) };
    }
  }
  return null;
}

/** Decide se uma entrada M3U é canal ao vivo, filme ou episódio. */
export function classify(name: string, group: string, url: string): 'live' | 'movie' | 'episode' {
  const g = keyOf(group);
  if (/\/series\//i.test(url) || /\b(series|serie|novelas?|temporada)\b/.test(g)) {
    return parseEpisode(name) ? 'episode' : 'movie';
  }
  if (/\/movie\//i.test(url) || /\b(vod|filmes?|movies?|cinema)\b/.test(g)) return 'movie';
  if (/\.(mp4|mkv|avi|mov)(\?|$)/i.test(url)) return parseEpisode(name) ? 'episode' : 'movie';
  return 'live';
}

/** Distância de edição simples, usada na busca tolerante a erros. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > max) return max + 1;
  }
  return prev[b.length];
}

/** Busca: "vingadoes" encontra "Vingadores". */
export function fuzzyMatch(query: string, text: string): boolean {
  const q = keyOf(query);
  if (!q) return true;
  const t = keyOf(text);
  if (t.includes(q)) return true;
  const words = t.split(' ');
  return q.split(' ').every((qw) =>
    words.some((w) => w.startsWith(qw) || (qw.length >= 4 && editDistance(qw, w.slice(0, qw.length + 1), qw.length >= 7 ? 2 : 1) <= (qw.length >= 7 ? 2 : 1))),
  );
}

export function hashId(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

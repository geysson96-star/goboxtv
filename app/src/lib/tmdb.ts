// Capas, sinopse e nota do TMDB para itens que vieram sem informação (opcional: precisa de chave).
import { TMDB_KEY } from './config';
import { getJSON, setJSON } from './storage';

export interface Meta {
  poster?: string;
  backdrop?: string;
  plot?: string;
  rating?: string;
  year?: string;
}

let cache: Record<string, Meta | null> | null = null;

export async function enrich(title: string, kind: 'movie' | 'tv', year?: string): Promise<Meta | null> {
  if (!TMDB_KEY) return null;
  if (!cache) cache = (await getJSON<Record<string, Meta | null>>('tmdb')) || {};
  const key = `${kind}:${title.toLowerCase()}:${year || ''}`;
  if (key in cache) return cache[key];
  try {
    const q = encodeURIComponent(title);
    const y = year ? `&${kind === 'movie' ? 'year' : 'first_air_date_year'}=${year}` : '';
    const res = await fetch(`https://api.themoviedb.org/3/search/${kind}?api_key=${TMDB_KEY}&language=pt-BR&query=${q}${y}`).then((r) => r.json());
    const r = res?.results?.[0];
    const meta: Meta | null = r
      ? {
          poster: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : undefined,
          backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : undefined,
          plot: r.overview || undefined,
          rating: r.vote_average ? r.vote_average.toFixed(1).replace('.', ',') : undefined,
          year: (r.release_date || r.first_air_date || '').slice(0, 4) || undefined,
        }
      : null;
    cache[key] = meta;
    setJSON('tmdb', cache).catch(() => {});
    return meta;
  } catch {
    return null;
  }
}

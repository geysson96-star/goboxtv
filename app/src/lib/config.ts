// Configurações do app.

/** Endereço do servidor gravado na hora de gerar o app (opcional). Ex.: https://vidro-tv.seunome.workers.dev */
const BAKED_API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

let runtimeApiUrl = BAKED_API_URL;

/**
 * Endereço do servidor de login em uso. Se o app foi gerado sem endereço,
 * a pessoa informa na tela de entrada (vem na mensagem de convite) e ele fica salvo.
 */
export function apiUrl(): string {
  return runtimeApiUrl;
}

export function setApiUrl(url: string) {
  runtimeApiUrl = normalizeServerUrl(url);
}

export function hasBakedApiUrl() {
  return !!BAKED_API_URL;
}

export function normalizeServerUrl(url: string): string {
  let u = (url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u.replace(/\/(admin|ativar)\/?$/i, '').replace(/\/+$/, '');
}

/** Chave gratuita do TMDB para capas e sinopses (opcional). https://www.themoviedb.org/settings/api */
export const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY || '';

export const APP_NAME = 'Vidro TV';

/** Quanto tempo o app funciona sem conseguir falar com o servidor (ex.: internet instável). */
export const OFFLINE_GRACE_MS = 72 * 3600e3;

/** Intervalo da verificação automática das fontes. */
export const HEALTH_INTERVAL_MS = 30 * 60e3;

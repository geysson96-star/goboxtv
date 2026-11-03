// Cores, tamanhos e tipografia do app (mesmos do protótipo).
export const colors = {
  bg: '#070A12',
  text: '#F2F5FA',
  textSoft: '#D5DCE8',
  muted: '#A9B4C6',
  dim: '#8C97AA',
  accent: '#5CC8FF',
  accentSoft: '#9BDDFF',
  onAccent: '#04121C',
  green: '#4ADE80',
  yellow: '#FBBF24',
  red: '#F87171',
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.14)',
  focusRing: 'rgba(92,200,255,0.28)',
};

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

export const font = {
  regular: 'System',
  // Para usar Manrope, adicione expo-font e carregue em app/_layout.tsx.
};

export const healthColor = { online: colors.green, slow: colors.yellow, offline: colors.red, unknown: colors.dim } as const;
export const healthLabel = { online: 'Online', slow: 'Lenta', offline: 'Fora do ar', unknown: 'Não verificada' } as const;

/** Paleta para capas geradas quando o item não tem imagem. */
const PALETTE = ['#3B2A63', '#164E63', '#7C3A1E', '#1F4D2E', '#7F1D1D', '#334155', '#365314', '#4C1D95', '#9A3412', '#1E3A8A'];
export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

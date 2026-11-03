// A capa grande no fundo da tela (estilo Netflix) mostra o item que está em foco.
import { create } from 'zustand';

export interface FocusArt {
  key: string;
  image?: string;
  title: string;
  subtitle?: string;
  description?: string;
  color?: string;
}

interface FocusArtState {
  art: FocusArt | null;
  setArt: (a: FocusArt | null) => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useFocusArt = create<FocusArtState>((set, get) => ({
  art: null,
  // Pequeno atraso: ao passar rápido pelos itens, a capa não fica piscando.
  setArt: (a) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (get().art?.key !== a?.key) set({ art: a });
    }, 180);
  },
}));

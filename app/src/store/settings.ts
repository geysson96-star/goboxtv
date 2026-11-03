// Preferências do usuário, listas cadastradas, favoritos e progresso. Tudo salvo no aparelho.
import { create } from 'zustand';
import type { Progress, Source } from '../lib/types';
import { DEFAULT_SOURCES, mergeSources } from '../lib/sources';
import { getJSON, setJSON } from '../lib/storage';

export interface Reminder {
  key: string; // channelId:start
  channelId: string;
  channelName: string;
  title: string;
  start: number;
}

interface SettingsState {
  loaded: boolean;
  sources: Source[];
  autoFailover: boolean;
  mergeDuplicates: boolean;
  refreshOnOpen: boolean;
  reduceEffects: boolean;
  preferredQuality: 'auto' | 'sd' | 'hd' | 'fhd';
  parentalPin: string | null;
  lockedGenres: string[];
  favorites: string[];
  progress: Record<string, Progress>;
  reminders: Reminder[];
  load: () => Promise<void>;
  set: (patch: Partial<Omit<SettingsState, 'load' | 'set'>>) => void;
  setAutoSources: (autos: Source[]) => void;
  addSource: (s: Omit<Source, 'id' | 'priority' | 'auto' | 'enabled'>) => Source;
  updateSource: (id: string, patch: Partial<Source>) => void;
  removeSource: (id: string) => void;
  moveSource: (id: string, dir: -1 | 1) => void;
  toggleFavorite: (id: string) => void;
  saveProgress: (p: Progress) => void;
  toggleReminder: (r: Reminder) => void;
}

const PERSIST_KEYS = [
  'sources', 'autoFailover', 'mergeDuplicates', 'refreshOnOpen', 'reduceEffects', 'preferredQuality',
  'parentalPin', 'lockedGenres', 'favorites', 'progress', 'reminders',
] as const;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(state: SettingsState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const data: Record<string, unknown> = {};
    for (const k of PERSIST_KEYS) data[k] = (state as any)[k];
    setJSON('settings', data).catch(() => {});
  }, 400);
}

function renumber(list: Source[]): Source[] {
  return list.map((s, i) => ({ ...s, priority: i + 1 }));
}

export const useSettings = create<SettingsState>((set, get) => {
  const update = (patch: Partial<SettingsState>) => {
    set(patch);
    persist(get());
  };
  return {
    loaded: false,
    sources: DEFAULT_SOURCES,
    autoFailover: true,
    mergeDuplicates: true,
    refreshOnOpen: true,
    reduceEffects: false,
    preferredQuality: 'auto',
    parentalPin: null,
    lockedGenres: [],
    favorites: [],
    progress: {},
    reminders: [],

    load: async () => {
      const saved = await getJSON<Partial<SettingsState>>('settings');
      set({ ...(saved || {}), loaded: true });
    },
    set: (patch) => update(patch as Partial<SettingsState>),

    setAutoSources: (autos) => update({ sources: renumber(mergeSources(get().sources, autos)) }),

    addSource: (s) => {
      const src: Source = { ...s, id: 'u_' + Date.now().toString(36), auto: false, enabled: true, priority: get().sources.length + 1 };
      update({ sources: [...get().sources, src] });
      return src;
    },
    updateSource: (id, patch) => update({ sources: get().sources.map((s) => (s.id === id ? { ...s, ...patch } : s)) }),
    removeSource: (id) => update({ sources: renumber(get().sources.filter((s) => s.id !== id)) }),
    moveSource: (id, dir) => {
      const list = [...get().sources];
      const i = list.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      update({ sources: renumber(list) });
    },

    toggleFavorite: (id) => {
      const f = get().favorites;
      update({ favorites: f.includes(id) ? f.filter((x) => x !== id) : [id, ...f] });
    },
    saveProgress: (p) => {
      const progress = { ...get().progress, [p.id]: p };
      // mantém só os 60 mais recentes
      const keys = Object.keys(progress).sort((a, b) => progress[b].updatedAt - progress[a].updatedAt);
      for (const k of keys.slice(60)) delete progress[k];
      update({ progress });
    },
    toggleReminder: (r) => {
      const list = get().reminders;
      const exists = list.some((x) => x.key === r.key);
      update({ reminders: exists ? list.filter((x) => x.key !== r.key) : [...list, r].filter((x) => x.start > Date.now() - 3600e3) });
    },
  };
});

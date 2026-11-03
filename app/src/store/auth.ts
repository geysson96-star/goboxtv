// Acesso livre: o app abre direto, sem login, servidor ou código de convite.
// (O painel de usuários continua existindo para o administrador, mas não é exigido.)
import { create } from 'zustand';
import type { AppUser } from '../lib/api';
import { getJSON, remove, setJSON } from '../lib/storage';

interface Session {
  token: string;
  user: AppUser;
  verifiedAt: number;
}

interface AuthState {
  status: 'checking' | 'in' | 'out';
  session: Session | null;
  masterKey: string | null;
  message?: string;
  init: () => Promise<void>;
  login: (code: string) => Promise<void>;
  logout: (message?: string) => Promise<void>;
  setMasterKey: (k: string | null) => Promise<void>;
}

const GUEST: Session = {
  token: 'livre',
  user: { id: 'livre', name: 'Você', role: 'user', maxDevices: 99 },
  verifiedAt: 0,
};

export const useAuth = create<AuthState>((set) => ({
  status: 'checking',
  session: null,
  masterKey: null,

  init: async () => {
    const masterKey = await getJSON<string>('masterKey');
    set({ masterKey: masterKey || null, status: 'in', session: { ...GUEST, verifiedAt: Date.now() } });
  },

  // Mantidos só para compatibilidade: com acesso livre, nunca há tela de login.
  login: async () => {
    set({ status: 'in', session: { ...GUEST, verifiedAt: Date.now() } });
  },
  logout: async () => {
    await remove('session');
    set({ status: 'in', session: { ...GUEST, verifiedAt: Date.now() } });
  },

  setMasterKey: async (k) => {
    if (k) await setJSON('masterKey', k);
    else await remove('masterKey');
    set({ masterKey: k });
  },
}));

// Sessão do usuário: só entra quem tem um código criado pelo administrador.
import { create } from 'zustand';
import { AppUser, fetchMe, redeemCode } from '../lib/api';
import { apiUrl, OFFLINE_GRACE_MS, setApiUrl } from '../lib/config';
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

export const useAuth = create<AuthState>((set, get) => ({
  status: 'checking',
  session: null,
  masterKey: null,

  init: async () => {
    const [session, masterKey, savedServer] = await Promise.all([getJSON<Session>('session'), getJSON<string>('masterKey'), getJSON<string>('serverUrl')]);
    set({ masterKey: masterKey || null });
    if (savedServer) setApiUrl(savedServer);

    if (!apiUrl()) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // Só durante o desenvolvimento: entra direto, sem servidor.
        set({ status: 'in', session: { token: 'dev', user: { id: 'dev', name: 'Desenvolvedor', role: 'master', maxDevices: 99 }, verifiedAt: Date.now() } });
        return;
      }
      // App sem servidor definido: a tela de entrada pede o endereço.
      set({ status: 'out' });
      return;
    }
    if (!session) {
      set({ status: 'out' });
      return;
    }
    // Entra com a sessão salva e confere com o servidor em seguida.
    set({ status: 'in', session });
    try {
      const { user } = await fetchMe(session.token);
      const s = { ...session, user, verifiedAt: Date.now() };
      set({ session: s });
      await setJSON('session', s);
    } catch (e: any) {
      if (e?.offline) {
        // Sem internet/servidor: tolera por um tempo.
        if (Date.now() - session.verifiedAt > OFFLINE_GRACE_MS) {
          await get().logout('Não foi possível confirmar seu acesso. Conecte-se à internet e entre de novo.');
        }
        return;
      }
      await get().logout(e?.message || 'Seu acesso foi encerrado.');
    }
  },

  login: async (code) => {
    const { token, user } = await redeemCode(code);
    const s: Session = { token, user, verifiedAt: Date.now() };
    await setJSON('session', s);
    set({ status: 'in', session: s, message: undefined });
  },

  logout: async (message) => {
    await remove('session');
    set({ status: 'out', session: null, message });
  },

  setMasterKey: async (k) => {
    if (k) await setJSON('masterKey', k);
    else await remove('masterKey');
    set({ masterKey: k });
  },
}));

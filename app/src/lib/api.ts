// Cliente do servidor de login por código (pasta /server).
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { apiUrl } from './config';
import { getJSON, setJSON } from './storage';

export interface AppUser {
  id: string;
  name: string;
  role: 'user' | 'master';
  maxDevices: number;
  expiresAt?: number | null;
}

export interface AdminUser extends AppUser {
  code: string;
  status: 'active' | 'pending' | 'blocked';
  devices: { id: string; name: string; lastSeen: number }[];
  createdAt: number;
  lastSeen?: number | null;
}

async function request<T>(path: string, init: RequestInit & { token?: string; masterKey?: string } = {}): Promise<T> {
  if (!apiUrl()) throw new Error('Servidor não configurado.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.masterKey) headers['X-Master-Key'] = init.masterKey;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(apiUrl() + path, { ...init, headers, signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(body?.error || `Erro ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return body as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const err: any = new Error('Servidor não respondeu');
      err.offline = true;
      throw err;
    }
    if (e instanceof TypeError) {
      (e as any).offline = true;
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** Identificador fixo deste aparelho (gerado uma vez e guardado). */
export async function getDevice(): Promise<{ id: string; name: string }> {
  const saved = await getJSON<{ id: string; name: string }>('device');
  if (saved?.id) return saved;
  const rnd = () => Math.random().toString(36).slice(2, 10);
  const name =
    Platform.OS === 'web'
      ? typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent) ? 'Computador (app)' : 'Navegador'
      : [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Platform.OS;
  const dev = { id: `${Platform.OS}-${rnd()}${rnd()}`, name };
  await setJSON('device', dev);
  return dev;
}

export async function redeemCode(code: string) {
  const device = await getDevice();
  return request<{ token: string; user: AppUser }>('/api/auth/redeem', {
    method: 'POST',
    body: JSON.stringify({ code: code.trim().toUpperCase(), deviceId: device.id, deviceName: device.name }),
  });
}

export async function fetchMe(token: string) {
  const device = await getDevice();
  return request<{ user: AppUser }>(`/api/auth/me?deviceId=${encodeURIComponent(device.id)}`, { token });
}

// ---------- Painel master ----------

export const admin = {
  list: (masterKey: string) => request<{ users: AdminUser[] }>('/api/admin/users', { masterKey }),
  create: (masterKey: string, data: { name: string; maxDevices: number; validDays: number | null }) =>
    request<{ user: AdminUser }>('/api/admin/users', { method: 'POST', masterKey, body: JSON.stringify(data) }),
  setStatus: (masterKey: string, id: string, status: 'active' | 'blocked') =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}`, { method: 'PATCH', masterKey, body: JSON.stringify({ status }) }),
  regenerate: (masterKey: string, id: string) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}/regenerate`, { method: 'POST', masterKey }),
  resetDevices: (masterKey: string, id: string) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}/reset-devices`, { method: 'POST', masterKey }),
  remove: (masterKey: string, id: string) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE', masterKey }),
};

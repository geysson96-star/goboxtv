// Servidor de acesso do Vidro TV na Cloudflare (plano gratuito).
// Mesma API do server/index.mjs, guardando os dados no banco D1.
import ADMIN_HTML from '../../server/public/admin.html';
import ATIVAR_HTML from '../../server/public/ativar.html';
import SOURCES from '../sources.json';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const enc = new TextEncoder();

// ---------------- Banco ----------------
let ready = null;
function init(db) {
  ready ||= db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, code TEXT UNIQUE, data TEXT NOT NULL, created_at INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS pairs (id TEXT PRIMARY KEY, short TEXT, data TEXT NOT NULL, expires INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS attempts (ip TEXT, ts INTEGER)'),
  ]).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
const rowUser = (r) => (r ? JSON.parse(r.data) : null);
async function getUser(db, id) {
  return rowUser(await db.prepare('SELECT data FROM users WHERE id = ?').bind(id).first());
}
async function getUserByCode(db, code) {
  return rowUser(await db.prepare('SELECT data FROM users WHERE code = ?').bind(code).first());
}
async function putUser(db, u) {
  await db
    .prepare('INSERT INTO users (id, code, data, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET code = ?2, data = ?3')
    .bind(u.id, u.code, JSON.stringify(u), u.createdAt)
    .run();
}

// ---------------- Utilidades ----------------
function randomCode(len = 6) {
  const b = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[b[i] % CODE_CHARS.length];
  return s;
}
function b64url(bytes) {
  let s = '';
  for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function hmacKey(env) {
  // Chave de assinatura derivada da MASTER_KEY: trocar a chave master derruba todas as sessões.
  return crypto.subtle.importKey('raw', enc.encode('vidro-tv-token:' + env.MASTER_KEY), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function sign(env, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(body));
  return `${body}.${b64url(mac)}`;
}
async function verify(env, token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(mac), enc.encode(body));
    return ok ? JSON.parse(new TextDecoder().decode(fromB64url(body))) : null;
  } catch {
    return null;
  }
}
async function safeEqual(a, b) {
  const [ha, hb] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a))), crypto.subtle.digest('SHA-256', enc.encode(String(b)))]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
function publicUser(u) {
  return { id: u.id, name: u.name, role: u.role || 'user', maxDevices: u.maxDevices, expiresAt: u.expiresAt || null };
}
function adminUser(u) {
  return { ...publicUser(u), code: u.code, status: u.status, devices: u.devices, createdAt: u.createdAt, lastSeen: u.lastSeen || null };
}
class HttpErr {
  constructor(status, error) {
    this.status = status;
    this.error = error;
  }
}
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Master-Key',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
const html = (body) => new Response(body, { headers: { ...CORS, 'Content-Type': 'text/html; charset=utf-8' } });
async function body(req) {
  const t = await req.text();
  if (t.length > 64 * 1024) throw new HttpErr(413, 'Requisição grande demais.');
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    throw new HttpErr(400, 'JSON inválido.');
  }
}

// Limite de tentativas por IP (contra chute de códigos).
async function tooMany(db, ip) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM attempts WHERE ip = ? AND ts > ?').bind(ip, Date.now() - 10 * 60e3).first();
  return (r?.n || 0) >= 10;
}
async function recordFail(db, ip) {
  await db.batch([
    db.prepare('INSERT INTO attempts (ip, ts) VALUES (?, ?)').bind(ip, Date.now()),
    db.prepare('DELETE FROM attempts WHERE ts < ?').bind(Date.now() - 3600e3),
  ]);
}

async function newUserCode(db, prefix) {
  for (;;) {
    const code = `${prefix}-${randomCode(6)}`;
    if (!(await getUserByCode(db, code))) return code;
  }
}

async function redeem(env, code, deviceId, deviceName) {
  const u = await getUserByCode(env.DB, String(code || '').trim().toUpperCase());
  if (!u) throw new HttpErr(404, 'Código inválido.');
  if (u.status === 'blocked') throw new HttpErr(403, 'Este acesso foi bloqueado pelo administrador.');
  if (u.expiresAt && Date.now() > u.expiresAt) throw new HttpErr(403, 'Este código venceu. Peça um novo ao administrador.');
  if (!deviceId) throw new HttpErr(400, 'Aparelho não identificado.');
  let dev = u.devices.find((d) => d.id === deviceId);
  if (!dev) {
    if (u.devices.length >= u.maxDevices) throw new HttpErr(403, `Este código já está em uso em ${u.maxDevices} aparelho(s). Peça ao administrador para liberar.`);
    dev = { id: String(deviceId).slice(0, 80), name: String(deviceName || 'Aparelho').slice(0, 60), lastSeen: Date.now() };
    u.devices.push(dev);
  }
  dev.lastSeen = Date.now();
  u.lastSeen = Date.now();
  if (u.status === 'pending') u.status = 'active';
  await putUser(env.DB, u);
  return { token: await sign(env, { uid: u.id, did: dev.id, cv: u.codeVersion || 1, iat: Date.now() }), user: publicUser(u) };
}

async function authUser(env, req, url) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t');
  const p = await verify(env, token);
  if (!p) return null;
  const u = await getUser(env.DB, p.uid);
  if (!u || u.status !== 'active') return null;
  if ((u.codeVersion || 1) !== p.cv) return null;
  if (u.expiresAt && Date.now() > u.expiresAt) return null;
  const dev = u.devices.find((d) => d.id === p.did);
  if (!dev) return null;
  // Só grava "visto por último" a cada 5 min, para economizar o limite grátis do banco.
  if (Date.now() - (u.lastSeen || 0) > 5 * 60e3) {
    dev.lastSeen = u.lastSeen = Date.now();
    await putUser(env.DB, u);
  }
  return u;
}

// ---------------- Rotas ----------------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('POST', '/api/auth/redeem', async ({ env, req, ip }) => {
  if (await tooMany(env.DB, ip)) return json(429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const b = await body(req);
  try {
    return json(200, await redeem(env, b.code, b.deviceId, b.deviceName));
  } catch (e) {
    if (e.status === 404) await recordFail(env.DB, ip);
    throw e;
  }
});

route('GET', '/api/auth/me', async ({ env, req, url }) => {
  const u = await authUser(env, req, url);
  if (!u) return json(401, { error: 'Seu acesso foi encerrado. Fale com o administrador.' });
  return json(200, { user: publicUser(u) });
});

route('GET', '/api/config', async ({ env, req, url }) => {
  if (!(await authUser(env, req, url))) return json(401, { error: 'Não autorizado.' });
  return json(200, { sources: SOURCES.sources || [] });
});

route('POST', '/api/pair/start', async ({ env, req }) => {
  const b = await body(req);
  await env.DB.prepare('DELETE FROM pairs WHERE expires < ?').bind(Date.now()).run();
  const id = b64url(crypto.getRandomValues(new Uint8Array(16)));
  let short;
  do short = randomCode(5);
  while (await env.DB.prepare('SELECT 1 FROM pairs WHERE short = ?').bind(short).first());
  const data = { deviceId: String(b.deviceId || ''), deviceName: String(b.deviceName || 'TV'), result: null };
  await env.DB.prepare('INSERT INTO pairs (id, short, data, expires) VALUES (?, ?, ?, ?)').bind(id, short, JSON.stringify(data), Date.now() + 10 * 60e3).run();
  return json(200, { id, short, expiresIn: 600 });
});

route('GET', '/api/pair/:id', async ({ env, params }) => {
  const r = await env.DB.prepare('SELECT data, expires FROM pairs WHERE id = ?').bind(params.id).first();
  if (!r || Date.now() > r.expires) return json(404, { error: 'Expirado.' });
  const p = JSON.parse(r.data);
  if (!p.result) return json(200, { waiting: true });
  await env.DB.prepare('DELETE FROM pairs WHERE id = ?').bind(params.id).run();
  return json(200, p.result);
});

route('POST', '/api/pair/confirm', async ({ env, req, ip }) => {
  if (await tooMany(env.DB, ip)) return json(429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const b = await body(req);
  const r = await env.DB.prepare('SELECT id, data FROM pairs WHERE short = ? AND expires > ?').bind(String(b.short || '').trim().toUpperCase(), Date.now()).first();
  if (!r) {
    await recordFail(env.DB, ip);
    return json(404, { error: 'Código da TV não encontrado ou expirado.' });
  }
  const p = JSON.parse(r.data);
  try {
    p.result = await redeem(env, b.code, p.deviceId, p.deviceName);
  } catch (e) {
    if (e.status === 404) await recordFail(env.DB, ip);
    throw e;
  }
  await env.DB.prepare('UPDATE pairs SET data = ? WHERE id = ?').bind(JSON.stringify(p), r.id).run();
  return json(200, { ok: true });
});

// --- Master ---
const master = (fn) => async (ctx) => {
  const k = ctx.req.headers.get('x-master-key');
  if (!k || !(await safeEqual(k, ctx.env.MASTER_KEY))) {
    if (await tooMany(ctx.env.DB, ctx.ip)) return json(429, { error: 'Muitas tentativas.' });
    await recordFail(ctx.env.DB, ctx.ip);
    return json(401, { error: 'Chave master incorreta.' });
  }
  return fn(ctx);
};
async function mustUser(env, id) {
  const u = await getUser(env.DB, id);
  if (!u) throw new HttpErr(404, 'Usuário não encontrado.');
  return u;
}

route('GET', '/api/admin/users', master(async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT data FROM users ORDER BY created_at DESC').all();
  return json(200, { users: results.map((r) => adminUser(JSON.parse(r.data))) });
}));

route('POST', '/api/admin/users', master(async ({ env, req }) => {
  const b = await body(req);
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) throw new HttpErr(400, 'Informe o nome.');
  const maxDevices = Math.min(20, Math.max(1, parseInt(b.maxDevices, 10) || 1));
  const validDays = b.validDays ? Math.min(3650, Math.max(1, parseInt(b.validDays, 10))) : null;
  const u = {
    id: crypto.randomUUID(),
    name,
    code: await newUserCode(env.DB, env.CODE_PREFIX || 'VIDRO'),
    codeVersion: 1,
    role: 'user',
    status: 'pending',
    maxDevices,
    devices: [],
    createdAt: Date.now(),
    expiresAt: validDays ? Date.now() + validDays * 864e5 : null,
    lastSeen: null,
  };
  await putUser(env.DB, u);
  return json(201, { user: adminUser(u) });
}));

route('PATCH', '/api/admin/users/:id', master(async ({ env, req, params }) => {
  const u = await mustUser(env, params.id);
  const b = await body(req);
  if (b.status === 'blocked') u.status = 'blocked';
  if (b.status === 'active') u.status = u.devices.length ? 'active' : 'pending';
  if (b.name) u.name = String(b.name).slice(0, 60);
  if (b.maxDevices) u.maxDevices = Math.min(20, Math.max(1, parseInt(b.maxDevices, 10) || 1));
  if ('validDays' in b) u.expiresAt = b.validDays ? Date.now() + parseInt(b.validDays, 10) * 864e5 : null;
  await putUser(env.DB, u);
  return json(200, { user: adminUser(u) });
}));

route('POST', '/api/admin/users/:id/regenerate', master(async ({ env, params }) => {
  const u = await mustUser(env, params.id);
  u.code = await newUserCode(env.DB, env.CODE_PREFIX || 'VIDRO');
  u.codeVersion = (u.codeVersion || 1) + 1;
  u.devices = [];
  if (u.status !== 'blocked') u.status = 'pending';
  await putUser(env.DB, u);
  return json(200, { user: adminUser(u) });
}));

route('POST', '/api/admin/users/:id/reset-devices', master(async ({ env, params }) => {
  const u = await mustUser(env, params.id);
  u.devices = [];
  if (u.status === 'active') u.status = 'pending';
  await putUser(env.DB, u);
  return json(200, { user: adminUser(u) });
}));

route('DELETE', '/api/admin/users/:id', master(async ({ env, params }) => {
  await mustUser(env, params.id);
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(params.id).run();
  return json(200, { ok: true });
}));

route('GET', '/admin', async () => html(ADMIN_HTML));
route('GET', '/ativar', async () => html(ATIVAR_HTML));
route('GET', '/', async () => json(200, { ok: true, name: 'Vidro TV server' }));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.MASTER_KEY || env.MASTER_KEY.length < 8) return json(503, { error: 'Servidor sem MASTER_KEY configurada.' });
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'local';
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      try {
        await init(env.DB);
        return await r.fn({ env, req, url, ip, params: m.groups || {} });
      } catch (e) {
        if (e instanceof HttpErr) return json(e.status, { error: e.error });
        console.error(e);
        return json(500, { error: 'Erro interno.' });
      }
    }
    return json(404, { error: 'Não encontrado.' });
  },
};

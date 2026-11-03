// Servidor de acesso do Vidro TV — sem dependências (só Node 18+).
// - Usuários e códigos de convite, limite de aparelhos, validade, bloqueio.
// - Painel master no navegador: /admin   ·   Ativar TV pelo celular: /ativar
// - Catálogo de fontes automáticas para o app: data/sources.json
//
// Uso:  MASTER_KEY="uma-senha-forte" node index.mjs
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const MASTER_KEY = process.env.MASTER_KEY || '';
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
const SOURCES_FILE = path.join(DATA_DIR, 'sources.json');
const CODE_PREFIX = process.env.CODE_PREFIX || 'VIDRO';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para não confundir

if (!MASTER_KEY || MASTER_KEY.length < 8) {
  console.error('Defina MASTER_KEY com pelo menos 8 caracteres. Ex.: MASTER_KEY="minha-chave-forte" node index.mjs');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
const SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();

// ---------------- Banco (arquivo JSON) ----------------
let db = { users: [] };
if (fs.existsSync(DB_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    console.error('db.json corrompido; corrija ou apague o arquivo.', e);
    process.exit(1);
  }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 200);
}

const pairs = new Map(); // pareamento TV <-> celular (memória, expira em 10 min)

// ---------------- Utilidades ----------------
function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  return s;
}
function newUserCode() {
  let code;
  do code = `${CODE_PREFIX}-${randomCode(6)}`;
  while (db.users.some((u) => u.code === code));
  return code;
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function publicUser(u) {
  return { id: u.id, name: u.name, role: u.role || 'user', maxDevices: u.maxDevices, expiresAt: u.expiresAt || null };
}
function adminUser(u) {
  return { ...publicUser(u), code: u.code, status: u.status, devices: u.devices, createdAt: u.createdAt, lastSeen: u.lastSeen || null };
}

// Limite de tentativas de código por IP (contra chute de códigos).
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60e3);
  attempts.set(ip, a);
  return a.length >= 10;
}
function recordFail(ip) {
  attempts.set(ip, [...(attempts.get(ip) || []), Date.now()]);
}

/** Valida um código e registra o aparelho. Retorna { token, user } ou lança { status, error }. */
function redeem(code, deviceId, deviceName) {
  const u = db.users.find((x) => x.code === String(code || '').trim().toUpperCase());
  if (!u) throw { status: 404, error: 'Código inválido.' };
  if (u.status === 'blocked') throw { status: 403, error: 'Este acesso foi bloqueado pelo administrador.' };
  if (u.expiresAt && Date.now() > u.expiresAt) throw { status: 403, error: 'Este código venceu. Peça um novo ao administrador.' };
  if (!deviceId) throw { status: 400, error: 'Aparelho não identificado.' };
  let dev = u.devices.find((d) => d.id === deviceId);
  if (!dev) {
    if (u.devices.length >= u.maxDevices) throw { status: 403, error: `Este código já está em uso em ${u.maxDevices} aparelho(s). Peça ao administrador para liberar.` };
    dev = { id: String(deviceId).slice(0, 80), name: String(deviceName || 'Aparelho').slice(0, 60), lastSeen: Date.now() };
    u.devices.push(dev);
  }
  dev.lastSeen = Date.now();
  u.lastSeen = Date.now();
  if (u.status === 'pending') u.status = 'active';
  save();
  return { token: sign({ uid: u.id, did: dev.id, cv: u.codeVersion || 1, iat: Date.now() }), user: publicUser(u) };
}

/** Confere token: usuário existe, ativo, no prazo, aparelho ainda liberado e código não trocado. */
function authUser(req, url) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : url.searchParams.get('t');
  const p = verify(token);
  if (!p) return null;
  const u = db.users.find((x) => x.id === p.uid);
  if (!u || u.status !== 'active') return null;
  if ((u.codeVersion || 1) !== p.cv) return null;
  if (u.expiresAt && Date.now() > u.expiresAt) return null;
  const dev = u.devices.find((d) => d.id === p.did);
  if (!dev) return null;
  dev.lastSeen = Date.now();
  u.lastSeen = Date.now();
  save();
  return u;
}

// ---------------- HTTP ----------------
function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Master-Key',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw { status: 413, error: 'Requisição grande demais.' };
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw { status: 400, error: 'JSON inválido.' };
  }
}

function isMaster(req) {
  const k = req.headers['x-master-key'];
  return !!k && safeEqual(k, MASTER_KEY);
}

const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

// --- App ---
route('POST', '/api/auth/redeem', async (req, res, ctx) => {
  if (tooMany(ctx.ip)) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const b = await readBody(req);
  try {
    send(res, 200, redeem(b.code, b.deviceId, b.deviceName));
  } catch (e) {
    if (e.status === 404) recordFail(ctx.ip);
    throw e;
  }
});

route('GET', '/api/auth/me', async (req, res, ctx) => {
  const u = authUser(req, ctx.url);
  if (!u) return send(res, 401, { error: 'Seu acesso foi encerrado. Fale com o administrador.' });
  send(res, 200, { user: publicUser(u) });
});

route('GET', '/api/config', async (req, res, ctx) => {
  const u = authUser(req, ctx.url);
  if (!u) return send(res, 401, { error: 'Não autorizado.' });
  let sources = [];
  if (fs.existsSync(SOURCES_FILE)) {
    try {
      sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8')).sources || [];
    } catch {}
  }
  send(res, 200, { sources });
});

// --- Pareamento pelo celular ---
route('POST', '/api/pair/start', async (req, res) => {
  const b = await readBody(req);
  for (const [k, p] of pairs) if (Date.now() > p.expires) pairs.delete(k);
  if (pairs.size > 5000) return send(res, 503, { error: 'Tente novamente em instantes.' });
  const id = crypto.randomBytes(16).toString('hex');
  let short;
  do short = randomCode(5);
  while ([...pairs.values()].some((p) => p.short === short));
  pairs.set(id, { short, deviceId: String(b.deviceId || ''), deviceName: String(b.deviceName || 'TV'), expires: Date.now() + 10 * 60e3, result: null });
  send(res, 200, { id, short, expiresIn: 600 });
});

route('GET', '/api/pair/:id', async (req, res, ctx) => {
  const p = pairs.get(ctx.params.id);
  if (!p || Date.now() > p.expires) return send(res, 404, { error: 'Expirado.' });
  if (!p.result) return send(res, 200, { waiting: true });
  pairs.delete(ctx.params.id);
  send(res, 200, p.result);
});

route('POST', '/api/pair/confirm', async (req, res, ctx) => {
  if (tooMany(ctx.ip)) return send(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const b = await readBody(req);
  const entry = [...pairs.entries()].find(([, p]) => p.short === String(b.short || '').trim().toUpperCase() && Date.now() < p.expires);
  if (!entry) {
    recordFail(ctx.ip);
    return send(res, 404, { error: 'Código da TV não encontrado ou expirado.' });
  }
  try {
    entry[1].result = redeem(b.code, entry[1].deviceId, entry[1].deviceName);
  } catch (e) {
    if (e.status === 404) recordFail(ctx.ip);
    throw e;
  }
  send(res, 200, { ok: true });
});

// --- Master ---
function masterOnly(fn) {
  return async (req, res, ctx) => {
    if (!isMaster(req)) {
      recordFail(ctx.ip);
      if (tooMany(ctx.ip)) return send(res, 429, { error: 'Muitas tentativas.' });
      return send(res, 401, { error: 'Chave master incorreta.' });
    }
    return fn(req, res, ctx);
  };
}
function findUser(id) {
  const u = db.users.find((x) => x.id === id);
  if (!u) throw { status: 404, error: 'Usuário não encontrado.' };
  return u;
}

route('GET', '/api/admin/users', masterOnly(async (req, res) => {
  send(res, 200, { users: [...db.users].sort((a, b) => b.createdAt - a.createdAt).map(adminUser) });
}));

route('POST', '/api/admin/users', masterOnly(async (req, res) => {
  const b = await readBody(req);
  const name = String(b.name || '').trim().slice(0, 60);
  if (!name) throw { status: 400, error: 'Informe o nome.' };
  const maxDevices = Math.min(20, Math.max(1, parseInt(b.maxDevices, 10) || 1));
  const validDays = b.validDays ? Math.min(3650, Math.max(1, parseInt(b.validDays, 10))) : null;
  const u = {
    id: crypto.randomUUID(),
    name,
    code: newUserCode(),
    codeVersion: 1,
    role: 'user',
    status: 'pending',
    maxDevices,
    devices: [],
    createdAt: Date.now(),
    expiresAt: validDays ? Date.now() + validDays * 864e5 : null,
    lastSeen: null,
  };
  db.users.push(u);
  save();
  send(res, 201, { user: adminUser(u) });
}));

route('PATCH', '/api/admin/users/:id', masterOnly(async (req, res, ctx) => {
  const u = findUser(ctx.params.id);
  const b = await readBody(req);
  if (b.status === 'blocked') u.status = 'blocked';
  if (b.status === 'active') u.status = u.devices.length ? 'active' : 'pending';
  if (b.name) u.name = String(b.name).slice(0, 60);
  if (b.maxDevices) u.maxDevices = Math.min(20, Math.max(1, parseInt(b.maxDevices, 10) || 1));
  if ('validDays' in b) u.expiresAt = b.validDays ? Date.now() + parseInt(b.validDays, 10) * 864e5 : null;
  save();
  send(res, 200, { user: adminUser(u) });
}));

route('POST', '/api/admin/users/:id/regenerate', masterOnly(async (req, res, ctx) => {
  const u = findUser(ctx.params.id);
  u.code = newUserCode();
  u.codeVersion = (u.codeVersion || 1) + 1; // derruba as sessões antigas
  u.devices = [];
  if (u.status !== 'blocked') u.status = 'pending';
  save();
  send(res, 200, { user: adminUser(u) });
}));

route('POST', '/api/admin/users/:id/reset-devices', masterOnly(async (req, res, ctx) => {
  const u = findUser(ctx.params.id);
  u.devices = [];
  if (u.status === 'active') u.status = 'pending';
  save();
  send(res, 200, { user: adminUser(u) });
}));

route('DELETE', '/api/admin/users/:id', masterOnly(async (req, res, ctx) => {
  findUser(ctx.params.id);
  db.users = db.users.filter((x) => x.id !== ctx.params.id);
  save();
  send(res, 200, { ok: true });
}));

// --- Páginas ---
route('GET', '/ativar', async (req, res) => send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'ativar.html')), 'text/html; charset=utf-8'));
route('GET', '/admin', async (req, res) => send(res, 200, fs.readFileSync(path.join(__dirname, 'public', 'admin.html')), 'text/html; charset=utf-8'));
route('GET', '/', async (req, res) => send(res, 200, { ok: true, name: 'Vidro TV server' }));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  if (req.method === 'OPTIONS') return send(res, 204, '');
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    try {
      await r.fn(req, res, { url, ip, params: m.groups || {} });
    } catch (e) {
      if (e && e.status) send(res, e.status, { error: e.error });
      else {
        console.error(e);
        send(res, 500, { error: 'Erro interno.' });
      }
    }
    return;
  }
  send(res, 404, { error: 'Não encontrado.' });
});

server.listen(PORT, () => console.log(`Vidro TV server em http://localhost:${PORT}  ·  painel: /admin  ·  ativar TV: /ativar`));

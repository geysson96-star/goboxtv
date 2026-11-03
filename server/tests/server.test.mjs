import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const BASE_ENV = process.env.BASE;
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = BASE_ENV || `http://127.0.0.1:${PORT}`;
const KEY = process.env.KEY || 'chave-de-teste-123';
let proc, dataDir;

const j = async (p, opts = {}) => {
  const r = await fetch(BASE + p, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { status: r.status, body: await r.json() };
};
const M = { 'X-Master-Key': KEY };

before(async () => {
  if (BASE_ENV) return;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vidro-'));
  proc = spawn(process.execPath, [path.join('/home/claude/vidro-tv/server', 'index.mjs')], { env: { ...process.env, PORT: String(PORT), MASTER_KEY: KEY, DATA_DIR: dataDir }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(BASE + '/');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('servidor não subiu');
});
after(() => proc?.kill());

test('fluxo completo: criar usuário, entrar, limite de aparelhos, bloquear, novo código', async () => {
  assert.equal((await j('/api/admin/users')).status, 401, 'sem chave master');
  assert.equal((await j('/api/admin/users', { headers: { 'X-Master-Key': 'errada' } })).status, 401);

  const c = await j('/api/admin/users', { method: 'POST', headers: M, body: JSON.stringify({ name: 'Ana', maxDevices: 1, validDays: null }) });
  assert.equal(c.status, 201);
  const user = c.body.user;
  assert.match(user.code, /^VIDRO-[A-Z2-9]{6}$/);
  assert.equal(user.status, 'pending');

  const bad = await j('/api/auth/redeem', { method: 'POST', body: JSON.stringify({ code: 'VIDRO-ERRADO', deviceId: 'd1' }) });
  assert.equal(bad.status, 404);

  const ok = await j('/api/auth/redeem', { method: 'POST', body: JSON.stringify({ code: user.code.toLowerCase(), deviceId: 'tv-sala', deviceName: 'TV Sala' }) });
  assert.equal(ok.status, 200);
  const token = ok.body.token;

  const me = await j('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Ana');

  // mesmo aparelho pode entrar de novo; outro aparelho passa do limite (1)
  assert.equal((await j('/api/auth/redeem', { method: 'POST', body: JSON.stringify({ code: user.code, deviceId: 'tv-sala' }) })).status, 200);
  assert.equal((await j('/api/auth/redeem', { method: 'POST', body: JSON.stringify({ code: user.code, deviceId: 'celular' }) })).status, 403);

  // token adulterado
  assert.equal((await j('/api/auth/me', { headers: { Authorization: `Bearer ${token.slice(0, -2)}xx` } })).status, 401);

  // bloquear derruba o acesso
  await j(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: M, body: JSON.stringify({ status: 'blocked' }) });
  assert.equal((await j('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await j('/api/auth/redeem', { method: 'POST', body: JSON.stringify({ code: user.code, deviceId: 'tv-sala' }) })).status, 403);

  // liberar + novo código: código antigo e sessões antigas param de valer
  await j(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: M, body: JSON.stringify({ status: 'active' }) });
  const regen = await j(`/api/admin/users/${user.id}/regenerate`, { method: 'POST', headers: M });
  assert.notEqual(regen.body.user.code, user.code);
  assert.equal((await j('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  assert.equal((await j('/api/auth/redeem', { method: 'POST', body: JSON.stringify({ code: regen.body.user.code, deviceId: 'celular' }) })).status, 200);

  const list = await j('/api/admin/users', { headers: M });
  assert.equal(list.body.users.length, 1);
  assert.equal(list.body.users[0].status, 'active');
});

test('pareamento TV pelo celular', async () => {
  const c = await j('/api/admin/users', { method: 'POST', headers: M, body: JSON.stringify({ name: 'Jorge', maxDevices: 2 }) });
  const start = await j('/api/pair/start', { method: 'POST', body: JSON.stringify({ deviceId: 'tv-quarto', deviceName: 'TV Quarto' }) });
  assert.equal(start.status, 200);
  assert.equal((await j(`/api/pair/${start.body.id}`)).body.waiting, true);
  const conf = await j('/api/pair/confirm', { method: 'POST', body: JSON.stringify({ short: start.body.short.toLowerCase(), code: c.body.user.code }) });
  assert.equal(conf.status, 200);
  const done = await j(`/api/pair/${start.body.id}`);
  assert.ok(done.body.token);
  assert.equal(done.body.user.name, 'Jorge');
  assert.equal((await j(`/api/pair/${start.body.id}`)).status, 404, 'resultado só é entregue uma vez');
});

test('usuários ilimitados e dados persistidos em disco', async () => {
  for (let i = 0; i < 30; i++) await j('/api/admin/users', { method: 'POST', headers: M, body: JSON.stringify({ name: `Pessoa ${i}` }) });
  const list = await j('/api/admin/users', { headers: M });
  assert.equal(list.body.users.length, 32);
  if (BASE_ENV) return;
  await new Promise((r) => setTimeout(r, 400));
  const disk = JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  assert.equal(disk.users.length, 32);
});

test('páginas /admin e /ativar respondem', async () => {
  assert.equal((await fetch(BASE + '/admin')).status, 200);
  assert.equal((await fetch(BASE + '/ativar')).status, 200);
});

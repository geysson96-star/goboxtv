// Cria um novo acesso (convite) sem abrir navegador e sem digitar nada.
// Usa a chave do MASTER_KEY.txt deste PC. O convite sai num arquivo de texto
// e já fica copiado para colar no WhatsApp.
// Uso: node criar-convite.mjs [Nome da pessoa]
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const keyFile = path.join(dir, 'MASTER_KEY.txt');
const envFile = path.join(dir, '..', 'app', '.env');
const fail = (m) => {
  console.error('\n' + m);
  process.exit(1);
};

if (!fs.existsSync(keyFile)) fail('Não achei o MASTER_KEY.txt. Rode primeiro o PUBLICAR-SERVIDOR-GRATIS.');
const key = fs.readFileSync(keyFile, 'utf8').trim();
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const base = ((env.match(/EXPO_PUBLIC_API_URL=(\S+)/) || [])[1] || '').replace(/\/+$/, '');
if (!base) fail('Não achei o endereço do servidor. Rode primeiro o PUBLICAR-SERVIDOR-GRATIS.');

const headers = { 'Content-Type': 'application/json', 'X-Master-Key': key };
const list = await fetch(`${base}/api/admin/users`, { headers }).then((r) => r.json()).catch(() => null);
if (!list?.users) fail(list?.error ? `O servidor recusou: ${list.error}` : 'Não consegui falar com o servidor. Confira a internet.');

let name = process.argv.slice(2).join(' ').trim();
if (!name) name = `Convidado ${list.users.filter((u) => /^Convidado \d+$/.test(u.name)).length + 1}`;

const res = await fetch(`${base}/api/admin/users`, { method: 'POST', headers, body: JSON.stringify({ name, maxDevices: 2, validDays: null }) }).then((r) => r.json());
if (!res?.user) fail(`Não consegui criar o acesso: ${res?.error || 'erro desconhecido'}`);
const u = res.user;

const msg = [
  `Olá! Seu acesso ao Vidro TV:`,
  ``,
  `Servidor: ${base.replace(/^https:\/\//, '')}`,
  `Código: ${u.code}`,
  ``,
  `1) Baixe o app: https://github.com/geysson96-star/vidro-tv-app/releases/latest`,
  `   (VidroTV.apk para celular/TV Box, ou o instalador para Windows)`,
  `2) Abra o app, digite o servidor (só na primeira vez) e depois o código.`,
  `Vale para ${u.maxDevices} aparelhos.`,
].join('\n');

const outDir = path.join(dir, 'convites');
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `${name.replace(/[^\w\- ]+/g, '_')} - ${u.code}.txt`);
fs.writeFileSync(file, msg + '\n', 'utf8');

console.log(`\nAcesso criado para ${name}: ${u.code}\n`);
console.log(msg);

if (process.platform === 'win32') {
  // copia para a área de transferência (Ctrl+V no WhatsApp) e abre no Bloco de Notas
  spawnSync('powershell', ['-NoProfile', '-Command', `Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 '${file.replace(/'/g, "''")}')`], { stdio: 'ignore' });
  spawn('notepad.exe', [file], { detached: true, stdio: 'ignore' }).unref();
  console.log('\nA mensagem já foi copiada. É só colar no WhatsApp (Ctrl+V).');
}
console.log(`Também salvei em: ${file}`);

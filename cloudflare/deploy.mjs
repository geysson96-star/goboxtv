// Publica o servidor do Vidro TV na Cloudflare — de graça, com HTTPS, 24 h no ar.
// Funciona em Windows, macOS e Linux.  Uso (dentro desta pasta):  node deploy.mjs
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
process.chdir(dir);
const win = process.platform === 'win32';
const step = (t) => console.log(`\n\x1b[36m==> ${t}\x1b[0m`);
const fail = (t) => {
  console.error(`\n\x1b[31m${t}\x1b[0m`);
  process.exit(1);
};

function wrangler(args, { input, capture } = {}) {
  const r = spawnSync(win ? 'npx.cmd' : 'npx', ['--yes', 'wrangler', ...args], {
    stdio: capture || input !== undefined ? ['pipe', 'pipe', 'inherit'] : 'inherit',
    input,
    encoding: 'utf8',
    shell: win,
  });
  return r;
}

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) fail('Instale o Node 20 ou mais novo em https://nodejs.org e rode de novo.');

step('Instalando a ferramenta da Cloudflare (só na primeira vez)');
const inst = spawnSync(win ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { stdio: 'inherit', shell: win });
if (inst.status !== 0) fail('Não consegui instalar. Confira sua internet e rode de novo.');

step('Entrando na sua conta Cloudflare (vai abrir o navegador — clique em "Allow")');
const who = wrangler(['whoami'], { capture: true });
if (who.status !== 0 || /not authenticated/i.test(who.stdout || '')) {
  if (wrangler(['login']).status !== 0) fail('Login não concluído. Rode de novo.');
}

step('Criando o banco de dados (grátis)');
let list = wrangler(['d1', 'list', '--json'], { capture: true });
let dbs = [];
try {
  dbs = JSON.parse(list.stdout || '[]');
} catch {}
let db = dbs.find((d) => d.name === 'vidro-tv-db');
if (!db) {
  wrangler(['d1', 'create', 'vidro-tv-db'], { input: 'n\n' });
  list = wrangler(['d1', 'list', '--json'], { capture: true });
  try {
    db = JSON.parse(list.stdout || '[]').find((d) => d.name === 'vidro-tv-db');
  } catch {}
}
if (!db?.uuid) fail('Não consegui criar o banco "vidro-tv-db". Rode o script de novo.');
const toml = fs.readFileSync('wrangler.toml', 'utf8').replace(/database_id = ".*"/, `database_id = "${db.uuid}"`);
fs.writeFileSync('wrangler.toml', toml);

step('Publicando o servidor');
const dep = wrangler(['deploy'], { capture: true });
process.stdout.write(dep.stdout || '');
if (dep.status !== 0) {
  fail('A publicação falhou. Se a Cloudflare pediu um subdomínio "workers.dev", crie em dash.cloudflare.com › Workers & Pages e rode de novo.');
}
const url = (dep.stdout.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) || [])[0];

step('Configurando a chave master');
const keyFile = path.join(dir, 'MASTER_KEY.txt');
let key = fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '';
if (!key) {
  key = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(keyFile, key, { mode: 0o600 });
}
if (wrangler(['secret', 'put', 'MASTER_KEY'], { input: key + '\n' }).status !== 0) fail('Não consegui salvar a chave master. Rode de novo.');

// Deixa o endereço pronto no app.
if (url) {
  const envFile = path.join(dir, '..', 'app', '.env');
  let env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : fs.readFileSync(path.join(dir, '..', 'app', '.env.example'), 'utf8');
  env = /EXPO_PUBLIC_API_URL=.*/.test(env) ? env.replace(/EXPO_PUBLIC_API_URL=.*/, `EXPO_PUBLIC_API_URL=${url}`) : env + `\nEXPO_PUBLIC_API_URL=${url}\n`;
  fs.writeFileSync(envFile, env);
}

console.log('\n\x1b[32mPRONTO! Seu servidor está no ar, de graça.\x1b[0m');
if (url) {
  console.log(`Endereço:       ${url}`);
  console.log(`Painel master:  ${url}/admin`);
  console.log(`Ativar TV:      ${url}/ativar`);
  console.log('O arquivo app/.env já foi preenchido com esse endereço.');
}
console.log(`Chave master:   está no arquivo ${keyFile}  (guarde e não compartilhe)`);
console.log('Para atualizar o servidor no futuro, rode este mesmo comando de novo.');

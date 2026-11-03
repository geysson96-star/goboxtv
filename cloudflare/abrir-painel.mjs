// Abre o painel master já com a chave, sem precisar digitar nada.
// A chave vai no fragmento da URL (#k=...), que o navegador não envia ao servidor,
// e o painel apaga ela da barra de endereço assim que abre.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const keyFile = path.join(dir, 'MASTER_KEY.txt');
const envFile = path.join(dir, '..', 'app', '.env');

if (!fs.existsSync(keyFile)) {
  console.error('Não achei o MASTER_KEY.txt. Rode primeiro o PUBLICAR-SERVIDOR-GRATIS.');
  process.exit(1);
}
const key = fs.readFileSync(keyFile, 'utf8').trim();
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const base = (env.match(/EXPO_PUBLIC_API_URL=(\S+)/) || [])[1];
if (!base) {
  console.error('Não achei o endereço do servidor. Rode primeiro o PUBLICAR-SERVIDOR-GRATIS.');
  process.exit(1);
}
const url = `${base.replace(/\/+$/, '')}/admin#k=${encodeURIComponent(key)}`;

if (process.platform === 'win32') {
  spawn('cmd', ['/c', 'start', '""', `"${url}"`], { windowsVerbatimArguments: true, detached: true, stdio: 'ignore' }).unref();
} else {
  spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
}
console.log('Painel aberto no navegador.');

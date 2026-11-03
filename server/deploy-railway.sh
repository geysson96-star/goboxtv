#!/usr/bin/env bash
# Publica o servidor do Vidro TV no Railway (macOS / Linux).
# Uso: na pasta "server", rode:  bash deploy-railway.sh
set -e
cd "$(dirname "$0")"
step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }

step "Conferindo o Node"
command -v node >/dev/null || { echo "Instale o Node 18+ em https://nodejs.org e rode de novo."; exit 1; }

step "Conferindo a ferramenta do Railway"
command -v railway >/dev/null || npm install -g @railway/cli

step "Entrando na sua conta Railway (vai abrir o navegador)"
railway whoami >/dev/null 2>&1 || railway login

step "Gerando a chave master"
if [ -f MASTER_KEY.txt ]; then KEY="$(cat MASTER_KEY.txt)"; else
  KEY="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")"
  printf '%s' "$KEY" > MASTER_KEY.txt; chmod 600 MASTER_KEY.txt
fi

step "Criando o projeto e o serviço"
if [ ! -f .railway-ok ]; then
  railway init --name vidro-tv
  railway add --service vidro-server
  touch .railway-ok
fi
railway service vidro-server

step "Configurando a chave e o volume de dados"
railway variables --set "MASTER_KEY=$KEY" --skip-deploys
railway volume add --mount-path /data 2>/dev/null || true

step "Enviando o servidor"
railway up --detach

step "Gerando o endereço com HTTPS"
railway domain

printf '\n\033[32mPRONTO!\033[0m\n'
echo "Painel master: abra o endereço acima com /admin no final (a primeira subida leva 1-2 minutos)."
echo "Sua chave master está em: $(pwd)/MASTER_KEY.txt  (guarde e não compartilhe)"
echo "No app, coloque o endereço em EXPO_PUBLIC_API_URL no arquivo app/.env"

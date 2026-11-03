# Publica o servidor do Vidro TV no Railway (Windows / PowerShell).
# Uso: abra o PowerShell na pasta "server" e rode:  powershell -ExecutionPolicy Bypass -File .\deploy-railway.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Step($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }

Step "Conferindo o Node"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Instale o Node 18+ em https://nodejs.org e rode de novo." }

Step "Conferindo a ferramenta do Railway"
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) { npm install -g @railway/cli }

Step "Entrando na sua conta Railway (vai abrir o navegador)"
railway whoami 2>$null
if ($LASTEXITCODE -ne 0) { railway login }

Step "Gerando a chave master"
$keyFile = Join-Path $PSScriptRoot "MASTER_KEY.txt"
if (Test-Path $keyFile) { $key = (Get-Content $keyFile -Raw).Trim() }
else {
  $key = node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
  Set-Content -Path $keyFile -Value $key -NoNewline
}

Step "Criando o projeto e o serviço"
if (-not (Test-Path (Join-Path $PSScriptRoot ".railway-ok"))) {
  railway init --name vidro-tv
  railway add --service vidro-server
  New-Item -ItemType File (Join-Path $PSScriptRoot ".railway-ok") | Out-Null
}
railway service vidro-server

Step "Configurando a chave e o volume de dados"
railway variables --set "MASTER_KEY=$key" --skip-deploys
railway volume add --mount-path /data 2>$null

Step "Enviando o servidor"
railway up --detach

Step "Gerando o endereço com HTTPS"
$domain = railway domain
Write-Host $domain

Write-Host "`nPRONTO!" -ForegroundColor Green
Write-Host "Painel master: abra o endereço acima com /admin no final (a primeira subida leva 1-2 minutos)."
Write-Host "Sua chave master está salva em: $keyFile  (guarde num lugar seguro e não compartilhe)"
Write-Host "No app, coloque o endereço em EXPO_PUBLIC_API_URL no arquivo app\.env"

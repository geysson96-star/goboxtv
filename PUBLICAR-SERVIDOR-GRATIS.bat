@echo off
cd /d "%~dp0cloudflare"
where node >nul 2>nul || (echo Instale o Node 20+ em https://nodejs.org e rode de novo. & pause & exit /b 1)
node deploy.mjs
pause

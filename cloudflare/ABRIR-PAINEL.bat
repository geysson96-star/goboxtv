@echo off
cd /d "%~dp0"
node abrir-painel.mjs
timeout /t 3 >nul

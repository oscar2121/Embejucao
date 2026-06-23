@echo off
:: Cambiar al directorio del script
cd /d "%~dp0"

:: 0. Comprobar actualizaciones de forma síncrona al inicio
echo ⚡ Comprobando actualizaciones de Embejucao POS...
node updater.js

echo ⚡ Iniciando Embejucao POS...


:: 1. Iniciar backend (server.js) en segundo plano
echo [1/3] Levantando base de datos SQLite y API...
start /b node server.js > server_log.txt 2>&1

:: 2. Iniciar Expo Web en segundo plano
echo [2/3] Levantando servidor web Metro...
start /b npx expo start --web --disable-dev-tools > expo_log.txt 2>&1

:: 3. Esperar a que los puertos esten disponibles (8 segundos)
echo [3/3] Esperando que inicien los servicios...
timeout /t 8 /nobreak >nul

:: 4. Arrancar cliente de escritorio
:: Abre Electron cargando el dev server local o el compilado.
echo 🚀 Lanzando ventana de aplicacion...
npx electron electron-main.js

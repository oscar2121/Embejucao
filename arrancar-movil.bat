@echo off
echo ========================================================
echo     EMBEJUCAO - MODO DESARROLLO MOVIL (Conexion USB)
echo ========================================================
echo.

:: 1. Hacer forwarding de los puertos por USB (ADB)
echo [1/3] Habilitando puertos USB (8081 Metro, 3001 Backend)...
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3001 tcp:3001
echo Puertos mapeados correctamente.
echo.

:: 2. Iniciar el Backend
echo [2/3] Levantando Servidor Backend (Puerto 3001)...
start "Backend Embejucao" cmd /k "node server.js"
echo.

:: 3. Iniciar el Metro Bundler de React Native
echo [3/3] Levantando Metro Bundler de React Native...
start "Metro Bundler" cmd /k "npx react-native start"

echo.
echo ========================================================
echo TODO LISTO!
echo - Servidor y Metro ejecutandose en nuevas ventanas.
echo - Abre la app en tu celular, pulsa "Recargar" si es necesario.
echo - La app conectara directamente a localhost por el cable USB.
echo ========================================================
pause

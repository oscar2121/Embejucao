@echo off
echo Iniciando Servidor Embejucao...
start "Servidor Backend" cmd /c "node server.js"

echo Iniciando Tunel Ngrok (Dominio Fijo)...
:: IMPORTANTE: Cambia TU_TOKEN_AQUI por el Authtoken real de tu cuenta
start "Tunel Ngrok" cmd /k "npx --yes ngrok http --url=https://brisket-pregnant-squiggly.ngrok-free.dev --authtoken=3HkZltl26m4mtrULvL9FCkU3XVZ_77k13UozCab8kvYSxoW3K 3001"

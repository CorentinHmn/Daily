@echo off
rem Lance Cadence sur le Wi-Fi de la maison pour l'ouvrir sur l'iPhone (meme Wi-Fi) : scanner docs\qr-iphone.png.
rem Laisser cette fenetre ouverte pendant l'apercu ; la fermer arrete l'apercu.
cd /d "%~dp0"
call npx tsx scripts/lan.ts || goto :err
start "" "docs\qr-iphone.png"
call npm run dev -- --host 0.0.0.0 --port 5330 --strictPort
exit /b 0
:err
echo.
echo L'apercu n'a pas pu demarrer (voir le message ci-dessus).
pause

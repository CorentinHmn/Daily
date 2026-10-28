@echo off
rem Reconstruit la version web de Cadence et la publie sur Vercel (https://cadence-khaki-two.vercel.app).
rem Les iPhone recoivent la mise a jour au prochain lancement de l'app.
cd /d "%~dp0"
call npm run deploy || goto :err
exit /b 0
:err
echo.
echo La mise en ligne a echoue (voir le message ci-dessus). Si Vercel demande de se connecter : npx vercel login
pause

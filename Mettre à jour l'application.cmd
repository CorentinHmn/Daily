@echo off
rem Reconstruit l application Cadence et la reinstalle (raccourcis Bureau + menu Demarrer). Les donnees sont gardees.
cd /d "%~dp0"
call npm run desktop:build || goto :err
call npm run desktop:install || goto :err
exit /b 0
:err
echo.
echo La mise a jour a echoue (voir le message ci-dessus).
pause

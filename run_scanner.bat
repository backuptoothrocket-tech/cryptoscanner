@echo off
cd /d "%~dp0"
set NODE_ENV=production
set PORT=3001
"C:\Program Files\nodejs\node.exe" dist/server.cjs > logs/server-out.log 2> logs/server-error.log

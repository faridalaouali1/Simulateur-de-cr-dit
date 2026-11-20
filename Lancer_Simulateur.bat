

@echo off
cd /d "C:\Users\farid\simulateur-credit-bail"
start "" http://127.0.0.1:4173/
npm.cmd run preview -- --host 127.0.0.1
pause

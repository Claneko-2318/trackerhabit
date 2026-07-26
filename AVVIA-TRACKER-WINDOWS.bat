@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py avvia_tracker.py
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python avvia_tracker.py
  goto :eof
)
echo Python non risulta installato.
echo Apri il progetto con un server locale, GitHub Pages o l'estensione Live Server.
pause

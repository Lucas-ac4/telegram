@echo off
REM FinBot - doble clic para arrancar el bot en Windows.
cd /d "%~dp0"

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Se creo el archivo .env y se abre en el Bloc de notas.
  echo Completa TELEGRAM_BOT_TOKEN y ANTHROPIC_API_KEY, guarda con Ctrl+S,
  echo cerra el Bloc de notas y volve a hacer doble clic en iniciar.bat
  echo.
  notepad .env
  pause
  exit /b
)

where python >nul 2>nul
if errorlevel 1 (
  echo No encontre Python. Instalalo desde https://www.python.org/downloads/
  echo IMPORTANTE: en el instalador marca la casilla "Add python.exe to PATH".
  pause
  exit /b
)

if not exist .venv (
  echo Preparando todo, la primera vez tarda un minuto...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

echo.
echo FinBot andando. Deja esta ventana abierta. Para apagarlo, cerrala.
echo.
python bot.py
pause

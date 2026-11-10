#!/usr/bin/env bash
# FinBot - arranca el bot en Mac/Linux:  ./iniciar.sh
set -e
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Se creó el archivo .env. Completá TELEGRAM_BOT_TOKEN y ANTHROPIC_API_KEY y volvé a correr ./iniciar.sh"
  exit 0
fi

if [ ! -d .venv ]; then
  echo "Preparando todo, la primera vez tarda un minuto..."
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install -q -r requirements.txt

echo "FinBot andando. Dejá esta terminal abierta. Ctrl+C para apagarlo."
python bot.py

import { Game } from './game/Game';
import { Telegram } from './telegram/telegram';

Telegram.init();

const container = document.getElementById('game')!;
const game = new Game(container);

// Acceso para tests automáticos / debugging en consola.
(window as unknown as { __golazo: Game }).__golazo = game;

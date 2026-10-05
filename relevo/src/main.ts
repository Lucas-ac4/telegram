import { Game } from './game/Game';
import { Telegram } from './telegram';

Telegram.init();

const game = new Game(document.getElementById('game')!);

// Acceso para pruebas automáticas / consola.
(window as unknown as { __relevo: Game }).__relevo = game;

import Phaser from 'phaser';
import { GAME_CONFIG } from './config/gameConfig';
import { BootScene } from './game/scenes/BootScene';
import { GameScene } from './game/scenes/GameScene';
import { Telegram } from './telegram/telegram';

Telegram.init();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  backgroundColor: '#4aa3df',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GAME_CONFIG.physics.gravity },
      debug: new URLSearchParams(location.search).has('debug'),
    },
  },
  input: { activePointers: 2 },
  scene: [BootScene, GameScene],
});

// Acceso para tests automáticos / debugging en consola.
(window as unknown as { __golazo: Phaser.Game }).__golazo = game;

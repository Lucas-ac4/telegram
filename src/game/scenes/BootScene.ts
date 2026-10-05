import Phaser from 'phaser';
import { OBSTACLE_TYPES } from '../../config/gameConfig';

/**
 * Genera gráficos placeholder por código (0 KB de assets = carga instantánea).
 * Cuando haya arte real, se reemplaza por `this.load.image(...)` con las mismas keys.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    const g = this.add.graphics();

    // Jugador: camiseta albiceleste, short negro, cabeza.
    g.clear();
    g.fillStyle(0xf1c27d).fillCircle(24, 12, 11); // cabeza
    g.fillStyle(0x75aadb).fillRect(10, 24, 28, 30); // camiseta
    g.fillStyle(0xffffff).fillRect(17, 24, 5, 30).fillRect(27, 24, 5, 30); // rayas
    g.fillStyle(0x111111).fillRect(10, 52, 28, 12); // short
    g.fillStyle(0xf1c27d).fillRect(13, 64, 7, 10).fillRect(28, 64, 7, 10); // piernas
    g.fillStyle(0x222222).fillRect(11, 74, 11, 6).fillRect(26, 74, 11, 6); // botines
    g.generateTexture('player', 48, 80);

    // Pelota.
    g.clear();
    g.fillStyle(0xffffff).fillCircle(11, 11, 11);
    g.fillStyle(0x111111).fillCircle(11, 11, 4).fillCircle(3, 7, 2).fillCircle(19, 7, 2).fillCircle(11, 20, 2);
    g.generateTexture('ball', 22, 22);

    // Cono.
    const cone = OBSTACLE_TYPES.cone;
    g.clear();
    g.fillStyle(0xff7a00).fillTriangle(cone.width / 2, 0, 0, cone.height - 6, cone.width, cone.height - 6);
    g.fillStyle(0xffffff).fillRect(cone.width * 0.3, cone.height * 0.45, cone.width * 0.4, 6);
    g.fillStyle(0xff7a00).fillRect(0, cone.height - 6, cone.width, 6);
    g.generateTexture('cone', cone.width, cone.height);

    // Defensor rival (alto).
    const def = OBSTACLE_TYPES.defender;
    g.clear();
    g.fillStyle(0x8d5524).fillCircle(def.width / 2, 12, 12);
    g.fillStyle(0xd62828).fillRect(4, 25, def.width - 8, 44);
    g.fillStyle(0xffffff).fillRect(4, 69, def.width - 8, 14);
    g.fillStyle(0x8d5524).fillRect(9, 83, 10, 15).fillRect(def.width - 19, 83, 10, 15);
    g.fillStyle(0x222222).fillRect(7, def.height - 6, 14, 6).fillRect(def.width - 21, def.height - 6, 14, 6);
    g.generateTexture('defender', def.width, def.height);

    // Valla de entrenamiento (ancha y baja).
    const h = OBSTACLE_TYPES.hurdle;
    g.clear();
    g.fillStyle(0xffd60a).fillRect(0, 0, h.width, 10);
    g.fillStyle(0xffffff).fillRect(4, 10, 6, h.height - 10).fillRect(h.width - 10, 10, 6, h.height - 10);
    g.generateTexture('hurdle', h.width, h.height);

    // Césped con franjas (tile horizontal).
    g.clear();
    g.fillStyle(0x2d8a3e).fillRect(0, 0, 128, 220);
    g.fillStyle(0x28803a).fillRect(64, 0, 64, 220);
    g.fillStyle(0xffffff).fillRect(0, 0, 128, 4); // línea de cal
    g.generateTexture('grass', 128, 220);

    // Tribuna de fondo (tile, parallax).
    g.clear();
    g.fillStyle(0x1b2a41).fillRect(0, 0, 160, 140);
    const colors = [0x75aadb, 0xffffff, 0xd62828, 0xffd60a, 0x9aa5b1];
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        g.fillStyle(colors[(row * 3 + col * 7) % colors.length]).fillCircle(8 + col * 16, 14 + row * 20, 5);
      }
    }
    g.generateTexture('stands', 160, 140);

    g.destroy();
    this.scene.start('Game');
  }
}

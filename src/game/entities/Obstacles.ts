import Phaser from 'phaser';
import { GAME_CONFIG, OBSTACLE_TYPES, type ObstacleKind } from '../../config/gameConfig';

const CFG = GAME_CONFIG.obstacles;
const KINDS = Object.keys(OBSTACLE_TYPES) as ObstacleKind[];
const TOTAL_WEIGHT = KINDS.reduce((sum, k) => sum + OBSTACLE_TYPES[k].weight, 0);

/**
 * Generación procedural de obstáculos.
 * Usa un pool (group) para no crear/destruir objetos cada vez: clave en móviles.
 */
export class Obstacles {
  readonly group: Phaser.Physics.Arcade.Group;
  private distanceToNext = 0;

  constructor(
    private scene: Phaser.Scene,
    private groundY: number,
  ) {
    this.group = scene.physics.add.group({ allowGravity: false, immovable: true });
    // El primer obstáculo aparece con margen para que el jugador entienda el juego.
    this.distanceToNext = GAME_CONFIG.width * 0.9;
  }

  update(deltaMs: number, speed: number): void {
    const dx = (speed * deltaMs) / 1000;

    for (const child of this.group.getChildren()) {
      const obstacle = child as Phaser.Physics.Arcade.Image;
      if (!obstacle.active) continue;
      obstacle.x -= dx;
      if (obstacle.x + obstacle.width < 0) {
        this.group.killAndHide(obstacle);
        (obstacle.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    }

    this.distanceToNext -= dx;
    if (this.distanceToNext <= 0) {
      this.spawn();
      this.distanceToNext = this.nextGap(speed);
    }
  }

  private nextGap(speed: number): number {
    const speedT = Phaser.Math.Clamp(
      (speed - GAME_CONFIG.speed.start) / (GAME_CONFIG.speed.max - GAME_CONFIG.speed.start),
      0,
      1,
    );
    const minGap = Phaser.Math.Linear(CFG.minGapSeconds, CFG.minGapSecondsAtMaxSpeed, speedT);
    return Phaser.Math.FloatBetween(minGap, CFG.maxGapSeconds) * speed;
  }

  private pickKind(): ObstacleKind {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const kind of KINDS) {
      roll -= OBSTACLE_TYPES[kind].weight;
      if (roll <= 0) return kind;
    }
    return KINDS[0];
  }

  private spawn(): void {
    const kind = this.pickKind();
    const x = this.scene.scale.gameSize.width + 60;
    const obstacle = this.group.get(x, this.groundY, kind) as Phaser.Physics.Arcade.Image;
    obstacle.setTexture(kind).setOrigin(0, 1).setActive(true).setVisible(true);
    obstacle.setPosition(x, this.groundY);

    const body = obstacle.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    // Hitbox un poco más chica que el dibujo: perdona roces mínimos.
    const w = obstacle.width * 0.8;
    const h = obstacle.height * 0.9;
    body.setSize(w, h);
    body.setOffset((obstacle.width - w) / 2, obstacle.height - h);
    body.reset(x, this.groundY);
  }
}

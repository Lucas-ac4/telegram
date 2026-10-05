import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config/gameConfig';

const CFG = GAME_CONFIG.player;

/**
 * Futbolista: corre en su lugar (el mundo se mueve) y salta.
 * Incluye "coyote time" y "jump buffer" para que el salto se sienta justo.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  private ball: Phaser.GameObjects.Image;
  private lastGroundedAt = 0;
  private jumpPressedAt = -Infinity;
  private jumpHeld = false;
  private runTime = 0;

  /** Se llama cada vez que el jugador efectivamente salta (para haptics/sonido). */
  onJump?: () => void;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    super(scene, x, groundY, 'player');
    this.setOrigin(0.5, 1);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const w = this.width * CFG.hitboxScale;
    const h = this.height * 0.85;
    this.body.setSize(w, h);
    this.body.setOffset((this.width - w) / 2, this.height - h);

    // La pelota acompaña al jugador: el fútbol es parte del gameplay desde el día 1.
    this.ball = scene.add.image(x + 28, groundY - 11, 'ball');
  }

  pressJump(now: number): void {
    this.jumpPressedAt = now;
    this.jumpHeld = true;
  }

  releaseJump(): void {
    this.jumpHeld = false;
  }

  tick(now: number, deltaMs: number, worldSpeed: number): void {
    const grounded = this.body.blocked.down || this.body.touching.down;
    if (grounded) this.lastGroundedAt = now;

    const buffered = now - this.jumpPressedAt <= CFG.jumpBufferMs;
    const canJump = now - this.lastGroundedAt <= CFG.coyoteTimeMs;
    if (buffered && canJump && this.body.velocity.y >= 0) {
      this.body.setVelocityY(CFG.jumpVelocity);
      this.jumpPressedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
      this.onJump?.();
    }

    // Salto variable: toque corto = salto bajo; mantener = salto alto.
    if (!this.jumpHeld && this.body.velocity.y < CFG.shortJumpVelocity) {
      this.body.setVelocityY(CFG.shortJumpVelocity);
    }

    // Animación placeholder: balanceo al correr, inclinación en el aire.
    this.runTime += deltaMs;
    if (grounded) {
      this.setAngle(Math.sin(this.runTime / 60) * 4);
    } else {
      this.setAngle(Phaser.Math.Clamp(this.body.velocity.y / 60, -12, 12));
    }

    // Pelota: rueda pegada al pie y sube con el jugador.
    this.ball.setPosition(this.x + 28, this.y - 11);
    this.ball.rotation += (worldSpeed * deltaMs) / 1000 / 11;
  }

  knockOut(): void {
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.setAngle(-80);
  }
}

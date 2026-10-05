import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config/gameConfig';
import { Player } from '../entities/Player';
import { Obstacles } from '../entities/Obstacles';
import { Save } from '../../save/save';
import { Telegram } from '../../telegram/telegram';

type State = 'ready' | 'playing' | 'over';

const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  fontSize: '32px',
  color: '#ffffff',
  fontStyle: 'bold',
  stroke: '#0b3d1e',
  strokeThickness: 6,
  align: 'center',
};

/** Tiempo en que se ignoran toques tras perder (evita reinicios accidentales). */
const RESTART_LOCK_MS = 600;

export class GameScene extends Phaser.Scene {
  private state: State = 'ready';
  private player!: Player;
  private obstacles!: Obstacles;
  private grass!: Phaser.GameObjects.TileSprite;
  private stands!: Phaser.GameObjects.TileSprite;
  private distanceText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private overlay!: Phaser.GameObjects.Container;

  private speed: number = GAME_CONFIG.speed.start;
  private distancePx = 0;
  private overAt = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    const { width, groundY } = GAME_CONFIG;
    this.state = 'ready';
    this.speed = GAME_CONFIG.speed.start;
    this.distancePx = 0;

    this.cameras.main.setBackgroundColor('#4aa3df');
    this.stands = this.add.tileSprite(0, groundY - 260, width, 140, 'stands').setOrigin(0, 0);
    this.add.rectangle(0, groundY - 120, width, 120, 0x1f6b31).setOrigin(0, 0); // publicidad estática / borde
    this.add
      .text(width / 2, groundY - 60, 'PROYECTO GOLAZO', { ...TEXT_STYLE, fontSize: '26px', strokeThickness: 0 })
      .setOrigin(0.5)
      .setAlpha(0.35);
    this.grass = this.add.tileSprite(0, groundY, width, GAME_CONFIG.height - groundY, 'grass').setOrigin(0, 0);

    // Piso físico invisible.
    const ground = this.add.rectangle(width / 2, groundY + 50, width * 2, 100);
    this.physics.add.existing(ground, true);

    this.player = new Player(this, GAME_CONFIG.player.x, groundY);
    this.player.onJump = () => Telegram.hapticLight();
    this.physics.add.collider(this.player, ground);

    this.obstacles = new Obstacles(this, groundY);
    this.physics.add.overlap(this.player, this.obstacles.group, () => this.gameOver());

    // HUD
    this.distanceText = this.add.text(width / 2, 80, '0 m', { ...TEXT_STYLE, fontSize: '56px' }).setOrigin(0.5);
    this.bestText = this.add
      .text(width / 2, 140, `Récord: ${Save.bestMeters} m`, { ...TEXT_STYLE, fontSize: '24px' })
      .setOrigin(0.5);

    this.overlay = this.add.container(0, 0).setDepth(10);
    this.showReady();

    this.physics.pause();
    this.setupInput();
  }

  private setupInput(): void {
    this.input.on('pointerdown', () => this.onPress());
    this.input.on('pointerup', () => this.player.releaseJump());

    const keyboard = this.input.keyboard;
    if (keyboard) {
      for (const key of ['SPACE', 'UP', 'W']) {
        keyboard.on(`keydown-${key}`, () => this.onPress());
        keyboard.on(`keyup-${key}`, () => this.player.releaseJump());
      }
    }
  }

  private onPress(): void {
    if (this.state === 'ready') {
      this.startRun();
      this.player.pressJump(this.time.now);
      return;
    }
    if (this.state === 'playing') {
      this.player.pressJump(this.time.now);
      return;
    }
    if (this.time.now - this.overAt > RESTART_LOCK_MS) {
      this.scene.restart();
    }
  }

  private startRun(): void {
    this.state = 'playing';
    this.overlay.removeAll(true);
    this.physics.resume();
  }

  private gameOver(): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overAt = this.time.now;
    this.physics.pause();
    this.player.knockOut();
    Telegram.hapticError();
    this.cameras.main.shake(180, 0.01);

    const meters = this.meters;
    const isRecord = Save.recordGame(meters);
    this.showGameOver(meters, isRecord);
  }

  update(time: number, delta: number): void {
    // Limita delta: si la pestaña se congela, evitamos saltos enormes.
    const dt = Math.min(delta, 50);
    if (this.state !== 'playing') {
      if (this.state === 'ready') this.scrollBackground(dt, this.speed * 0.4);
      return;
    }

    this.speed = Math.min(GAME_CONFIG.speed.max, this.speed + (GAME_CONFIG.speed.increasePerSecond * dt) / 1000);
    this.distancePx += (this.speed * dt) / 1000;

    this.scrollBackground(dt, this.speed);
    this.obstacles.update(dt, this.speed);
    this.player.tick(time, dt, this.speed);

    this.distanceText.setText(`${this.meters} m`);
  }

  private scrollBackground(dt: number, speed: number): void {
    this.grass.tilePositionX += (speed * dt) / 1000;
    this.stands.tilePositionX += (speed * 0.25 * dt) / 1000;
  }

  private get meters(): number {
    return Math.floor(this.distancePx / GAME_CONFIG.pixelsPerMeter);
  }

  private showReady(): void {
    const { width } = GAME_CONFIG;
    const name = Telegram.unsafeUser?.first_name;
    const title = this.add.text(width / 2, 330, name ? `¡Vamos, ${name}!` : '⚽ ¡A JUGAR!', {
      ...TEXT_STYLE,
      fontSize: '44px',
    });
    const hint = this.add.text(width / 2, 410, 'TOCÁ PARA SALTAR\nMantené para saltar más alto', {
      ...TEXT_STYLE,
      fontSize: '26px',
    });
    title.setOrigin(0.5);
    hint.setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.overlay.add([title, hint]);
  }

  private showGameOver(meters: number, isRecord: boolean): void {
    const { width, height } = GAME_CONFIG;
    const bg = this.add.rectangle(0, 0, width, height, 0x000000, 0.55).setOrigin(0, 0);
    const title = this.add.text(width / 2, 250, '💀 HAS PERDIDO', { ...TEXT_STYLE, fontSize: '48px' }).setOrigin(0.5);
    const result = this.add
      
      .text(width / 2, 320, `${meters} m${isRecord ? '\n🏆 ¡NUEVO RÉCORD!' : ''}`, {
        ...TEXT_STYLE,
        fontSize: '40px',
        color: isRecord ? '#ffd60a' : '#ffffff',
      })
      .setOrigin(0.5, 0);
    const best = this.add
      .text(width / 2, 450, `Récord: ${Save.bestMeters} m`, { ...TEXT_STYLE, fontSize: '26px' })
      .setOrigin(0.5);
    const retry = this.add
      .text(width / 2, 540, 'TOCÁ PARA REINTENTAR', { ...TEXT_STYLE, fontSize: '30px' })
      .setOrigin(0.5)
      .setAlpha(0);
    // Aparece cuando ya se puede reiniciar.
    this.tweens.add({ targets: retry, alpha: 1, delay: RESTART_LOCK_MS, duration: 200 });

    this.bestText.setText(`Récord: ${Save.bestMeters} m`);
    this.overlay.add([bg, title, result, best, retry]);
  }
}

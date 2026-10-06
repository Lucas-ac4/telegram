import * as THREE from 'three';
import type { Action, Ctx, Pose } from './Character';
import type { Look } from '../config/cosmetics';
import type { LoadedModel } from '../engine/assets';

/** Lo que el juego necesita de un jugador animado (lo cumplen el procedural y el .glb). */
export interface Avatar {
  readonly root: THREE.Group;
  update(dt: number, pose: Pose, cycle: number, ctx?: Ctx): void;
  setLook(look: Look): void;
  setBlink(on: boolean): void;
  action(kind: Action): void;
  punch(amount: number): void;
  reset(): void;
}

const POSE_CLIP: Record<Pose, string> = { idle: 'idle', run: 'run', jump: 'jump', fall: 'fall', slide: 'slide', dead: 'dead' };
const ACTION_CLIP: Record<Action, string> = { kick: 'kick', cheer: 'cheer', reach: 'reach' };

/**
 * Jugador definitivo en .glb con esqueleto: mezcla clips con fundido (crossfade).
 * Los clips deben llamarse como en `docs/ASSETS.md`. (Sin probar con un modelo real todavía.)
 */
export class GlbAvatar implements Avatar {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private pose: Pose | null = null;
  private oneShot: THREE.AnimationAction | null = null;
  private scaleY = 1;
  private springV = 0;

  constructor(model: LoadedModel) {
    this.root.add(model.scene);
    this.mixer = new THREE.AnimationMixer(model.scene);
    for (const clip of model.animations) this.clips.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    model.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  private play(name: string, fade: number, loop = true): THREE.AnimationAction | null {
    const next = this.clips.get(name);
    if (!next) return null;
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.reset().fadeIn(fade).play();
    return next;
  }

  update(dt: number, pose: Pose, cycle: number): void {
    if (pose !== this.pose) {
      this.pose = pose;
      const next = this.clips.get(POSE_CLIP[pose]);
      if (next && next !== this.current) {
        this.current?.fadeOut(0.15);
        this.current = this.play(POSE_CLIP[pose], 0.15);
      }
    }
    if (this.current && pose === 'run') this.current.timeScale = cycle;
    this.mixer.update(dt);
    // Squash & stretch con resorte (igual que el procedural).
    this.springV += (-260 * (this.scaleY - 1) - 16 * this.springV) * dt;
    this.scaleY += this.springV * dt;
    this.root.scale.set(1 - (this.scaleY - 1) * 0.55, this.scaleY, 1 - (this.scaleY - 1) * 0.55);
  }

  setLook(): void {
    /* El look (pelo / camiseta) se resuelve con materiales del propio .glb (ver docs/ASSETS.md). */
  }
  setBlink(on: boolean): void {
    this.root.visible = !on || Math.floor(performance.now() / 80) % 2 === 0;
  }
  action(kind: Action): void {
    this.oneShot?.fadeOut(0.1);
    this.oneShot = this.play(ACTION_CLIP[kind], 0.08, false);
  }
  punch(amount: number): void {
    this.springV += amount;
  }
  reset(): void {
    this.scaleY = 1;
    this.springV = 0;
    this.pose = null;
  }
}

import * as THREE from 'three';

/**
 * Ranuras para arte definitivo (modelos .glb). Hoy TODO se genera por código (0 KB de descarga);
 * cuando exista un asset profesional, se deja en `public/assets/…` con el nombre de abajo y el juego
 * lo usa solo (si el archivo no existe, sigue con el modelo procedural). Especificación completa en
 * `docs/ASSETS.md`.
 */
export const ASSET_PATHS = {
  /** Jugador principal: 1 malla con esqueleto, clips: idle, run, jump, fall, slide, dead, kick, cheer, reach. */
  player: 'assets/models/player.glb',
  ball: 'assets/models/ball.glb',
  coin: 'assets/models/coin.glb',
} as const;

export type AssetKey = keyof typeof ASSET_PATHS;

const url = (key: AssetKey) => import.meta.env.BASE_URL + ASSET_PATHS[key];

/** ¿Existe el archivo? (HEAD, barato). Siempre responde false si falla la red. */
export async function hasAsset(key: AssetKey): Promise<boolean> {
  try {
    const r = await fetch(url(key), { method: 'HEAD' });
    const type = r.headers.get('content-type') ?? '';
    // Los servidores de SPA devuelven index.html (text/html) para rutas inexistentes.
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

export interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

/** Carga un .glb bajo demanda (el cargador se descarga recién acá: no pesa en el arranque). */
export async function loadModel(key: AssetKey): Promise<LoadedModel | null> {
  if (!(await hasAsset(key))) return null;
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(url(key));
    return { scene: gltf.scene, animations: gltf.animations };
  } catch (e) {
    console.warn('[assets] no se pudo cargar', key, e);
    return null;
  }
}

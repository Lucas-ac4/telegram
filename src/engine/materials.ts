import * as THREE from 'three';
import { CONFIG } from '../config/gameConfig';

/**
 * Materiales semirrealistas con mundo curvo estilo Subway Surfers.
 *
 * - `lit*`  → Lambert (barato): ambiente, tribunas, césped.
 * - `pbr*`  → Standard (PBR con reflejos): jugadores, obstáculos, monedas, camiones.
 * El "mundo curvo" se inyecta en TODOS los materiales (el horizonte cae).
 */

/** Opciones de estilo que se pueden cambiar en vivo (por ejemplo para bajar calidad). */
export const STYLE = {
  /** Contorno negro tipo dibujito. Apagado = look realista. */
  outlines: false,
};

/** Uniforms compartidos por todos los shaders. */
export const sharedUniforms = {
  uCurve: { value: CONFIG.world.curvature },
  uTime: { value: 0 },
};

interface VertexPatch {
  key: string;
  uniforms?: Record<string, THREE.IUniform>;
  /** Código GLSL después de `begin_vertex` (puede modificar `transformed`). */
  afterBegin?: string;
  /** Declaraciones extra (atributos) al principio del vertex shader. */
  header?: string;
}

/** Inyecta la curvatura del mundo (y parches opcionales) en un material de Three. */
export function curved<T extends THREE.Material>(material: T, patch?: VertexPatch): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCurve = sharedUniforms.uCurve;
    shader.uniforms.uTime = sharedUniforms.uTime;
    Object.assign(shader.uniforms, patch?.uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCurve;\nuniform float uTime;\n' + uniformDecls(patch) + (patch?.header ?? ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (patch?.afterBegin ?? ''))
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        // Mundo curvo: lo lejano "cae" bajo el horizonte.
        mvPosition.y -= mvPosition.z * mvPosition.z * uCurve;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  material.customProgramCacheKey = () => 'curved-' + (patch?.key ?? '');
  return material;
}

function uniformDecls(patch?: VertexPatch): string {
  if (!patch?.uniforms) return '';
  return Object.keys(patch.uniforms)
    .map((name) => `uniform float ${name};`)
    .join('\n');
}

// ---------- Lambert: ambiente ----------

export function lit(color: THREE.ColorRepresentation, opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return curved(new THREE.MeshLambertMaterial({ color, ...opts }));
}

/** Toma el color de cada vértice (geometrías fusionadas). */
export function litVertexColors(opts: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  return curved(new THREE.MeshLambertMaterial({ vertexColors: true, ...opts }));
}

// ---------- Standard (PBR): jugadores, obstáculos, monedas ----------

export function pbr(color: THREE.ColorRepresentation, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return curved(new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts }));
}

export function pbrVertexColors(opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return curved(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0, ...opts }));
}

/**
 * Luz de borde (rim light) barata: un halo fresnel en los contornos del objeto.
 * Separa al jugador del fondo sin gastar una luz dinámica más.
 */
export function withRim<T extends THREE.MeshStandardMaterial>(mat: T, color: THREE.ColorRepresentation = 0xcfe8ff, strength = 0.5, power = 2.4): T {
  const c = new THREE.Color(color);
  const prev = mat.onBeforeCompile;
  const key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (shader, renderer) => {
    prev.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rimF = pow(1.0 - saturate(dot(normalize(vNormal), normalize(vViewPosition))), ${power.toFixed(1)});
      outgoingLight += vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * rimF * ${strength.toFixed(2)};
      #include <opaque_fragment>`,
    );
  };
  mat.customProgramCacheKey = () => key + '-rim';
  return mat;
}

export function basic(opts: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  return curved(new THREE.MeshBasicMaterial(opts));
}

// ---------- Nombres anteriores (se mantienen para no tocar todo el código) ----------
export const toon = lit;
export const toonRim = pbr;
export const toonVertexColors = (opts: THREE.MeshStandardMaterialParameters = {}, rim = false) =>
  rim ? pbrVertexColors(opts) : litVertexColors(opts as THREE.MeshLambertMaterialParameters);

// ---------- Contorno opcional (estilo dibujito) ----------

/** Contorno por "casco invertido": se infla la malla sobre su normal y se dibuja la cara de atrás. */
export function outlineMaterial(thickness = 0.035): THREE.MeshBasicMaterial {
  return curved(new THREE.MeshBasicMaterial({ color: 0x1a1030, side: THREE.BackSide }), {
    key: 'outline-' + thickness,
    uniforms: { uOutline: { value: thickness } },
    afterBegin: 'transformed += normal * uOutline;',
  });
}

const outlineCache = new Map<number, THREE.MeshBasicMaterial>();
const outlineOf = (t: number) => {
  let m = outlineCache.get(t);
  if (!m) outlineCache.set(t, (m = outlineMaterial(t)));
  return m;
};

/**
 * Agrega el contorno a una malla (sólo si `STYLE.outlines` está activo; por defecto no).
 * `thickness`: true = fino, false = normal, o un grosor en metros.
 */
export function withOutline<T extends THREE.Mesh>(mesh: T, thickness: boolean | number = false): T {
  if (!STYLE.outlines) return mesh;
  const t = typeof thickness === 'number' ? thickness : thickness ? 0.022 : 0.035;
  const outline = new THREE.Mesh(mesh.geometry, outlineOf(t));
  outline.name = 'outline';
  mesh.add(outline);
  return mesh;
}

/** Marca una malla (y sus hijas) para proyectar / recibir sombras. */
export function shadowed<T extends THREE.Object3D>(obj: T, cast = true, receive = false): T {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name !== 'outline') {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return obj;
}
